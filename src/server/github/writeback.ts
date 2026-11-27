// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/db/database.types'
import { DECISION_LABELS, askComment, parseIssueUrl } from '@/logic/github'
import { askQuestion } from '@/logic/textSignals'
import { GitHubError, asInstallation } from './app'

type Db = SupabaseClient<Database>
type Decision = keyof typeof DECISION_LABELS

/** An ASK comment is posted once per issue, ever (the claim never expires in practice). */
const ONCE = 10 * 365 * 24 * 3600

export type WriteBackResult = 'labelled' | 'labelled+asked' | 'off' | 'not-github' | 'no-installation' | 'no-decision'

/**
 * Mirrors a task's triage onto its GitHub issue: exactly one `sprint-agent:` label, and for ASK the
 * agent's question as a comment, once. Only for workspaces that turned write-back on.
 */
export async function writeBack(db: Db, ws: string, taskId: string): Promise<WriteBackResult> {
  const { data: task } = await db.from('tasks')
    .select('title, description, decision, external_ref, clarity, effort, risk, impact, urgency, type, external_blockers')
    .eq('workspace_id', ws).eq('id', taskId).maybeSingle()
  const ref = parseIssueUrl(task?.external_ref)
  if (!task || !ref) return 'not-github'
  if (!task.decision) return 'no-decision'

  const { data: installs } = await db.from('github_installations').select('installation_id, account_login, write_back').eq('workspace_id', ws)
  const install = installs?.find((i) => i.account_login.toLowerCase() === ref.owner.toLowerCase())
  if (!install) return 'no-installation'
  if (!install.write_back) return 'off'

  const id = install.installation_id
  const repoPath = `/repos/${ref.owner}/${ref.repo}`
  const decision = task.decision as Decision

  // Make sure our three labels exist (422 = already there).
  for (const l of Object.values(DECISION_LABELS)) {
    await asInstallation(id, `${repoPath}/labels`, { method: 'POST', body: JSON.stringify(l) })
      .catch((e) => { if (!(e instanceof GitHubError && e.status === 422)) throw e })
  }
  // Swap ours, leave the repo's own labels alone (404 = wasn't on the issue).
  for (const [d, l] of Object.entries(DECISION_LABELS)) {
    if (d === decision) continue
    await asInstallation(id, `${repoPath}/issues/${ref.number}/labels/${encodeURIComponent(l.name)}`, { method: 'DELETE' })
      .catch((e) => { if (!(e instanceof GitHubError && e.status === 404)) throw e })
  }
  await asInstallation(id, `${repoPath}/issues/${ref.number}/labels`, { method: 'POST', body: JSON.stringify({ labels: [DECISION_LABELS[decision].name] }) })

  if (decision !== 'ASK') return 'labelled'
  const question = askQuestion({
    title: task.title, description: task.description, type: task.type, urgency: task.urgency,
    impact: task.impact, effort: task.effort, risk: task.risk, clarity: task.clarity, externalBlockers: task.external_blockers,
  }) ?? 'What does “done” look like for this? One sentence is fine.'
  const { data: first } = await db.rpc('claim_agent_cooldown', { ws, check_key: `gh-ask-${taskId}`, cooldown_seconds: ONCE })
  if (!first) return 'labelled'
  await asInstallation(id, `${repoPath}/issues/${ref.number}/comments`, { method: 'POST', body: JSON.stringify({ body: askComment(question) }) })
  return 'labelled+asked'
}
