// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Tables } from '@/db/database.types'
import type { AgentDecision } from '@/types'
import { DEFAULT_AUTONOMY_CONFIG } from '@/logic/constants'
import { retriageWithAnswer } from '@/logic/github'
import { policyFromRow, taskFromRow } from '@/lib/data/mappers'
import { enqueue } from '@/server/outbox'

type Db = SupabaseClient<Database>

export const MAX_ANSWER = 4_000

export interface Answer {
  /** Shown on the comment, e.g. "@mei on GitHub" or "Mei (Slack)". */
  authorName: string
  /** The member who answered, when we know them. */
  authorId?: string | null
  body: string
  /** Where it came from, for the decision log and the feed line. */
  via: 'github' | 'slack' | 'linear' | 'jira'
  /** Who, as the feed should say it ("@mei", "Mei"). */
  who: string
}

export type AnswerOutcome =
  | { result: 'recorded'; taskId: string; title: string; decision: AgentDecision }
  | { result: 'retriaged'; taskId: string; title: string; decision: AgentDecision }

/**
 * Someone answered the agent's ASK question. The answer becomes a comment on the task and the task is
 * re-triaged by the rules (the answer can only add clarity). 'retriaged' means the decision changed,
 * with a receipt in the decision log and a line in the feed. The caller checks the task is an open ASK.
 */
export async function applyAnswer(db: Db, ws: string, row: Tables<'tasks'>, a: Answer): Promise<AnswerOutcome> {
  const body = a.body.trim().slice(0, MAX_ANSWER)
  const { error: cErr } = await db.from('task_comments').insert({ workspace_id: ws, task_id: row.id, author_id: a.authorId ?? null, author_name: a.authorName, body })
  if (cErr) throw cErr

  const { data: policy } = await db.from('autonomy_policies').select('*').eq('workspace_id', ws).maybeSingle()
  const r = retriageWithAnswer(taskFromRow(row), body, policy ? policyFromRow(policy) : DEFAULT_AUTONOMY_CONFIG)
  const same = { taskId: row.id, title: row.title }
  if (!r) return { result: 'recorded', ...same, decision: 'ASK' }

  const { error } = await db.from('tasks')
    .update({ clarity: r.clarity, decision: r.decision, decision_reason: r.reason, triage_score: r.score })
    .eq('id', row.id).eq('workspace_id', ws)
  if (error) throw error
  if (r.decision === 'ASK') return { result: 'recorded', ...same, decision: 'ASK' } // clearer, but still needs an answer

  const where = { github: 'on GitHub', slack: 'in Slack', linear: 'in Linear', jira: 'in Jira' }[a.via]
  await db.from('decisions').insert({
    workspace_id: ws, task_id: row.id, kind: 'triage', source: 'rules', decision: r.decision, rationale: r.reason, actor_id: a.authorId ?? null,
    payload: { runner: 'server', trigger: `${a.via}-answer`, from: 'ASK', clarity: { before: row.clarity, after: r.clarity } },
  })
  await db.from('feed_events').insert({ workspace_id: ws, type: 'triage', message: `${a.who} answered ${where}. ${row.title} is now ${r.decision}.`, task_id: row.id, decision: r.decision })
  if (r.decision === 'ESCALATE') {
    // Same as any escalation: a PM must see it, and it goes out to the team's channels.
    const recommendation = 'Review the answer and decide whether the agent may proceed.'
    const { data: esc } = await db.from('escalations').insert({ workspace_id: ws, task_id: row.id, task_title: row.title, reason: r.reason, recommendation, urgency: row.urgency, category: 'ambiguous' }).select('id').single()
    await enqueue(db, ws, { type: 'escalation', taskTitle: row.title, reason: r.reason, recommendation, urgency: row.urgency, escalationId: esc?.id }).catch(() => 0)
  }
  return { result: 'retriaged', ...same, decision: r.decision }
}
