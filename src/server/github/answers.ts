// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/db/database.types'
import { DEFAULT_AUTONOMY_CONFIG } from '@/logic/constants'
import { isHumanAnswer, retriageWithAnswer, type GhComment } from '@/logic/github'
import { policyFromRow, taskFromRow } from '@/lib/data/mappers'

type Db = SupabaseClient<Database>

/** Comments are delivered at least once; the claim makes each count once. */
const ONCE = 10 * 365 * 24 * 3600
const MAX_BODY = 4_000

export type AnswerResult = { result: 'ignored' | 'duplicate' | 'recorded'; taskId?: undefined } | { result: 'retriaged'; taskId: string }

/**
 * A person replied on an issue whose task is waiting on an ASK. The reply is copied to the task's
 * comments, and the task is re-triaged by the rules. 'retriaged' (with the task id) means the
 * decision changed, so the caller can mirror the new label back to GitHub.
 */
export async function handleIssueComment(db: Db, ws: string, issueUrl: string, comment: GhComment): Promise<AnswerResult> {
  if (!isHumanAnswer(comment)) return { result: 'ignored' }
  const { data: row } = await db.from('tasks').select('*').eq('workspace_id', ws).eq('external_ref', issueUrl).maybeSingle()
  if (!row || row.decision !== 'ASK' || row.status === 'done') return { result: 'ignored' }

  const { data: first, error: claimErr } = await db.rpc('claim_agent_cooldown', { ws, check_key: `gh-comment-${comment.id}`, cooldown_seconds: ONCE })
  if (claimErr) throw claimErr
  if (!first) return { result: 'duplicate' }

  const body = comment.body!.trim().slice(0, MAX_BODY)
  const login = comment.user!.login
  const { error: cErr } = await db.from('task_comments').insert({ workspace_id: ws, task_id: row.id, author_name: `@${login} on GitHub`, body })
  if (cErr) throw cErr

  const { data: policy } = await db.from('autonomy_policies').select('*').eq('workspace_id', ws).maybeSingle()
  const r = retriageWithAnswer(taskFromRow(row), body, policy ? policyFromRow(policy) : DEFAULT_AUTONOMY_CONFIG)
  if (!r) return { result: 'recorded' }

  const { error } = await db.from('tasks')
    .update({ clarity: r.clarity, decision: r.decision, decision_reason: r.reason, triage_score: r.score })
    .eq('id', row.id).eq('workspace_id', ws)
  if (error) throw error
  if (r.decision === 'ASK') return { result: 'recorded' } // clearer, but still needs an answer

  const message = `@${login} answered on GitHub. ${row.title} is now ${r.decision}.`
  await db.from('decisions').insert({
    workspace_id: ws, task_id: row.id, kind: 'triage', source: 'rules', decision: r.decision, rationale: r.reason,
    payload: { runner: 'server', trigger: 'github-answer', from: 'ASK', clarity: { before: row.clarity, after: r.clarity } },
  })
  await db.from('feed_events').insert({ workspace_id: ws, type: 'triage', message, task_id: row.id, decision: r.decision })
  return { result: 'retriaged', taskId: row.id }
}
