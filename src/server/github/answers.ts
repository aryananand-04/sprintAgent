// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/db/database.types'
import { isHumanAnswer, type GhComment } from '@/logic/github'
import { applyAnswer } from '@/server/agent/answer'

type Db = SupabaseClient<Database>

/** Comments are delivered at least once; the claim makes each count once. */
const ONCE = 10 * 365 * 24 * 3600

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

  const login = comment.user!.login
  const out = await applyAnswer(db, ws, row, { authorName: `@${login} on GitHub`, body: comment.body!, via: 'github', who: `@${login}` })
  return out.result === 'retriaged' ? { result: 'retriaged', taskId: out.taskId } : { result: 'recorded' }
}
