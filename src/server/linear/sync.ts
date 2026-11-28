// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/db/database.types'
import { linearIdentifier, linearIssueToTask, linearRef, type LinearIssue } from '@/logic/linear'
import { DECISION_LABELS, askComment, relayedAnswerComment } from '@/logic/github'
import { askQuestion } from '@/logic/textSignals'
import { taskFromRow } from '@/lib/data/mappers'
import { accessToken, connectionFor, setMeta, type Connection } from '@/server/trackers/connections'
import { activeSprintId, upsertExternalTask, type UpsertResult } from '@/server/trackers/upsert'
import { LinearError, gql, refreshLinear } from './api'

type Db = SupabaseClient<Database>

export const MAX_IMPORT = 5_000
const ISSUE_FIELDS = 'id identifier title description url priority createdAt state { type } team { key } labels { nodes { name } }'

export const linearToken = (db: Db, conn: Connection) => accessToken(db, conn, refreshLinear)

/** Creates or updates the task for one Linear issue (keyed by its slug-free URL). */
export function syncLinearIssue(db: Db, ws: string, issue: LinearIssue, sprintId?: string | null): Promise<UpsertResult> {
  const ref = linearRef(issue.url)
  if (!ref) return Promise.resolve('skipped')
  return upsertExternalTask(db, ws, ref, (id) => linearIssueToTask(issue, id), sprintId)
}

/** Imports every open issue the app can see (paginated, capped). Webhooks keep it current afterwards. */
export async function importLinear(db: Db, ws: string) {
  const conn = await connectionFor(db, ws, 'linear')
  if (!conn) return { created: 0, updated: 0, skipped: 0 }
  const token = await linearToken(db, conn)
  const sprint = await activeSprintId(db, ws)
  const result = { created: 0, updated: 0, skipped: 0 }
  let after: string | null = null
  for (let seen = 0; seen < MAX_IMPORT;) {
    const page: { issues: { nodes: LinearIssue[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } } } = await gql(token, `
      query Open($after: String) {
        issues(first: 100, after: $after, filter: { state: { type: { nin: ["completed", "canceled"] } } }) {
          nodes { ${ISSUE_FIELDS} } pageInfo { hasNextPage endCursor }
        }
      }`, { after })
    for (const issue of page.issues.nodes.slice(0, MAX_IMPORT - seen)) result[await syncLinearIssue(db, ws, issue, sprint)]++
    seen += page.issues.nodes.length
    if (!page.issues.pageInfo.hasNextPage) break
    after = page.issues.pageInfo.endCursor
  }
  return result
}

/** Our three workspace-level labels, created once and remembered in the connection's meta. */
async function decisionLabelIds(db: Db, conn: Connection, token: string): Promise<Record<string, string>> {
  const cached = conn.meta.labelIds as Record<string, string> | undefined
  if (cached && Object.keys(cached).length === 3) return cached
  const names = Object.values(DECISION_LABELS).map((l) => l.name)
  const { issueLabels } = await gql<{ issueLabels: { nodes: Array<{ id: string; name: string; team: { id: string } | null }> } }>(token,
    'query L($names: [String!]) { issueLabels(filter: { name: { in: $names } }, first: 50) { nodes { id name team { id } } } }', { names })
  const ids: Record<string, string> = {}
  for (const [decision, l] of Object.entries(DECISION_LABELS)) {
    const found = issueLabels.nodes.find((n) => n.name === l.name && !n.team)
    if (found) { ids[decision] = found.id; continue }
    const { issueLabelCreate } = await gql<{ issueLabelCreate: { issueLabel: { id: string } } }>(token,
      'mutation C($input: IssueLabelCreateInput!) { issueLabelCreate(input: $input) { issueLabel { id } } }',
      { input: { name: l.name, color: `#${l.color}`, description: l.description } })
    ids[decision] = issueLabelCreate.issueLabel.id
  }
  await setMeta(db, conn, { labelIds: ids })
  return ids
}

export type LinearWriteBack = 'labelled' | 'labelled+asked' | 'off' | 'not-linear' | 'no-connection' | 'no-decision'

/**
 * Mirrors triage onto the Linear issue: exactly one `sprint-agent:` label, and for ASK the agent's
 * question as a comment, once. Only when the workspace turned write-back on.
 */
export async function linearWriteBack(db: Db, ws: string, taskId: string): Promise<LinearWriteBack> {
  const { data: row } = await db.from('tasks').select('*').eq('workspace_id', ws).eq('id', taskId).maybeSingle()
  const identifier = linearIdentifier(row?.external_ref)
  if (!row || !identifier) return 'not-linear'
  if (!row.decision) return 'no-decision'
  const conn = await connectionFor(db, ws, 'linear')
  if (!conn) return 'no-connection'
  if (!conn.writeBack) return 'off'

  const token = await linearToken(db, conn)
  const labels = await decisionLabelIds(db, conn, token)
  for (const [decision, labelId] of Object.entries(labels)) {
    if (decision === row.decision) continue
    await gql(token, 'mutation R($id: String!, $labelId: String!) { issueRemoveLabel(id: $id, labelId: $labelId) { success } }', { id: identifier, labelId })
      .catch((e) => { if (!(e instanceof LinearError)) throw e }) // not on the issue: fine
  }
  await gql(token, 'mutation A($id: String!, $labelId: String!) { issueAddLabel(id: $id, labelId: $labelId) { success } }', { id: identifier, labelId: labels[row.decision] })

  if (row.decision !== 'ASK') return 'labelled'
  const { data: first } = await db.rpc('claim_agent_cooldown', { ws, check_key: `lin-ask-${taskId}`, cooldown_seconds: 10 * 365 * 86_400 })
  if (!first) return 'labelled'
  const question = askQuestion(taskFromRow(row)) ?? 'What does “done” look like for this? One sentence is fine.'
  await comment(token, identifier, askComment(question))
  return 'labelled+asked'
}

async function comment(token: string, identifier: string, body: string) {
  const { issue } = await gql<{ issue: { id: string } }>(token, 'query I($id: String!) { issue(id: $id) { id } }', { id: identifier })
  await gql(token, 'mutation M($input: CommentCreateInput!) { commentCreate(input: $input) { success } }', { input: { issueId: issue.id, body } })
}

/** An answer given in Slack, mirrored onto the Linear issue (write-back workspaces only). */
export async function relayToLinear(db: Db, ws: string, taskId: string, who: string, body: string): Promise<'posted' | 'off' | 'not-linear'> {
  const { data: row } = await db.from('tasks').select('external_ref').eq('workspace_id', ws).eq('id', taskId).maybeSingle()
  const identifier = linearIdentifier(row?.external_ref)
  if (!identifier) return 'not-linear'
  const conn = await connectionFor(db, ws, 'linear')
  if (!conn?.writeBack) return 'off'
  await comment(await linearToken(db, conn), identifier, relayedAnswerComment(who, 'Slack', body))
  return 'posted'
}

/** The stable reference for a Linear issue id (for comment webhooks, which only carry the issue id). */
export async function linearRefForIssueId(db: Db, conn: Connection, issueId: string): Promise<string | null> {
  const { issue } = await gql<{ issue: { url: string } | null }>(await linearToken(db, conn), 'query U($id: String!) { issue(id: $id) { url } }', { id: issueId })
  return linearRef(issue?.url)
}
