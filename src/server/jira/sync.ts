// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/db/database.types'
import { askComment, relayedAnswerComment } from '@/logic/github'
import { jiraIssueToTask, jiraLabelUpdate, jiraRef, parseJiraRef, stripHtml, textToAdf, type JiraIssue } from '@/logic/jira'
import { askQuestion } from '@/logic/textSignals'
import { taskFromRow } from '@/lib/data/mappers'
import { accessToken, connectionFor, setMeta, type Connection } from '@/server/trackers/connections'
import { activeSprintId, upsertExternalTask, type UpsertResult } from '@/server/trackers/upsert'
import { jiraApi, refreshJira } from './api'

type Db = SupabaseClient<Database>

export const MAX_IMPORT = 5_000
export const ISSUE_FIELDS = ['summary', 'description', 'labels', 'priority', 'status', 'issuetype', 'created', 'project']
export const WEBHOOK_EVENTS = ['jira:issue_created', 'jira:issue_updated', 'jira:issue_deleted', 'comment_created']
/** Dynamic webhooks expire after 30 days; we extend them weekly. */
const WEBHOOK_REFRESH_MS = 7 * 86_400_000

export const jiraToken = (db: Db, conn: Connection) => accessToken(db, conn, refreshJira)

export function syncJiraIssue(db: Db, ws: string, conn: Connection, issue: JiraIssue, sprintId?: string | null): Promise<UpsertResult> {
  return upsertExternalTask(db, ws, jiraRef(conn.siteUrl, issue.key), (id) => jiraIssueToTask(issue, conn.siteUrl, id), sprintId)
}

/** Imports every open issue on the site (paginated with nextPageToken, capped). */
export async function importJira(db: Db, ws: string) {
  const conn = await connectionFor(db, ws, 'jira')
  const result = { created: 0, updated: 0, skipped: 0 }
  if (!conn) return result
  const token = await jiraToken(db, conn)
  const sprint = await activeSprintId(db, ws)
  let next: string | undefined
  for (let seen = 0; seen < MAX_IMPORT;) {
    const page = await jiraApi<{ issues: JiraIssue[]; nextPageToken?: string }>(token, conn.externalId, '/search/jql', {
      method: 'POST', body: JSON.stringify({ jql: 'statusCategory != Done ORDER BY created DESC', fields: ISSUE_FIELDS, maxResults: 100, ...(next && { nextPageToken: next }) }),
    })
    for (const issue of page.issues.slice(0, MAX_IMPORT - seen)) result[await syncJiraIssue(db, ws, conn, issue, sprint)]++
    seen += page.issues.length
    if (!page.nextPageToken || !page.issues.length) break
    next = page.nextPageToken
  }
  return result
}

/**
 * Registers our webhook for the site's projects (Jira requires a JQL filter; project keys are a
 * supported clause). The ids go in the connection's meta: they identify which workspace a delivery is for.
 */
export async function registerWebhooks(db: Db, conn: Connection, origin: string): Promise<number[]> {
  const token = await jiraToken(db, conn)
  const projects = await jiraApi<{ values: Array<{ key: string }> }>(token, conn.externalId, '/project/search?maxResults=50')
  const keys = projects.values.map((p) => p.key).filter((k) => /^[A-Z][A-Z0-9_]*$/.test(k))
  if (!keys.length) return []
  const res = await jiraApi<Array<{ createdWebhookId?: number }> | { webhookRegistrationResult?: Array<{ createdWebhookId?: number }> }>(token, conn.externalId, '/webhook', {
    method: 'POST', body: JSON.stringify({ url: `${origin}/api/jira/webhook`, webhooks: [{ events: WEBHOOK_EVENTS, jqlFilter: `project IN (${keys.join(', ')})` }] }),
  })
  const list = Array.isArray(res) ? res : res?.webhookRegistrationResult ?? []
  const ids = list.map((r) => r.createdWebhookId).filter((n): n is number => typeof n === 'number')
  await setMeta(db, conn, { webhookIds: ids, webhooksRefreshedAt: new Date().toISOString() })
  return ids
}

/** Keeps our dynamic webhooks alive (they lapse after 30 days). Called from the agent tick; cheap when not due. */
export async function maybeRefreshJiraWebhooks(db: Db, ws: string, now = Date.now()): Promise<boolean> {
  const conn = await connectionFor(db, ws, 'jira')
  const ids = conn?.meta.webhookIds as number[] | undefined
  const last = Date.parse(String(conn?.meta.webhooksRefreshedAt ?? 0))
  if (!conn || !ids?.length || now - last < WEBHOOK_REFRESH_MS) return false
  await jiraApi(await jiraToken(db, conn), conn.externalId, '/webhook/refresh', { method: 'PUT', body: JSON.stringify({ webhookIds: ids }) })
  await setMeta(db, conn, { webhooksRefreshedAt: new Date(now).toISOString() })
  return true
}

export async function deleteWebhooks(db: Db, conn: Connection) {
  const ids = conn.meta.webhookIds as number[] | undefined
  if (ids?.length) await jiraApi(await jiraToken(db, conn), conn.externalId, '/webhook', { method: 'DELETE', body: JSON.stringify({ webhookIds: ids }) })
}

export type JiraWriteBack = 'labelled' | 'labelled+asked' | 'off' | 'not-jira' | 'no-connection' | 'no-decision'

/** Exactly one `sprint-agent-` label, and for ASK the agent's question as a comment, once. Opt-in. */
export async function jiraWriteBack(db: Db, ws: string, taskId: string): Promise<JiraWriteBack> {
  const { data: row } = await db.from('tasks').select('*').eq('workspace_id', ws).eq('id', taskId).maybeSingle()
  const ref = parseJiraRef(row?.external_ref)
  if (!row || !ref) return 'not-jira'
  if (!row.decision) return 'no-decision'
  const conn = await connectionFor(db, ws, 'jira')
  if (!conn || conn.siteUrl !== ref.site) return 'no-connection'
  if (!conn.writeBack) return 'off'

  const token = await jiraToken(db, conn)
  await jiraApi(token, conn.externalId, `/issue/${ref.key}`, { method: 'PUT', body: JSON.stringify({ update: { labels: jiraLabelUpdate(row.decision) } }) })
  if (row.decision !== 'ASK') return 'labelled'
  const { data: first } = await db.rpc('claim_agent_cooldown', { ws, check_key: `jira-ask-${taskId}`, cooldown_seconds: 10 * 365 * 86_400 })
  if (!first) return 'labelled'
  const question = askQuestion(taskFromRow(row)) ?? 'What does “done” look like for this? One sentence is fine.'
  await jiraApi(token, conn.externalId, `/issue/${ref.key}/comment`, { method: 'POST', body: JSON.stringify({ body: textToAdf(stripHtml(askComment(question))) }) })
  return 'labelled+asked'
}

/** An answer given in Slack, mirrored onto the Jira issue (write-back workspaces only). */
export async function relayToJira(db: Db, ws: string, taskId: string, who: string, body: string): Promise<'posted' | 'off' | 'not-jira'> {
  const { data: row } = await db.from('tasks').select('external_ref').eq('workspace_id', ws).eq('id', taskId).maybeSingle()
  const ref = parseJiraRef(row?.external_ref)
  if (!ref) return 'not-jira'
  const conn = await connectionFor(db, ws, 'jira')
  if (!conn?.writeBack || conn.siteUrl !== ref.site) return 'off'
  const text = stripHtml(relayedAnswerComment(who, 'Slack', body)).replace(/\*\*/g, '')
  await jiraApi(await jiraToken(db, conn), conn.externalId, `/issue/${ref.key}/comment`, { method: 'POST', body: JSON.stringify({ body: textToAdf(text) }) })
  return 'posted'
}
