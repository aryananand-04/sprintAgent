// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/db/database.types'
import { answerModal, answerOutcome } from '@/logic/slack'
import { askQuestion } from '@/logic/textSignals'
import { taskFromRow } from '@/lib/data/mappers'
import { applyAnswer } from '@/server/agent/answer'
import { relayAnswer, requestWriteBack, trackersConfigured } from '@/server/trackers/jobs'
import { afterResponse } from '@/server/background'
import { slackApi } from './api'
import type { SlackLink } from './install'
import type { Member } from './actions'

type Db = SupabaseClient<Database>

const NOT_OPEN = 'That question has already been answered, or the ticket moved on.'

async function openAsk(db: Db, ws: string, taskId: string) {
  const { data: row } = await db.from('tasks').select('*').eq('workspace_id', ws).eq('id', taskId).maybeSingle()
  return row && row.decision === 'ASK' && row.status !== 'done' ? row : null
}

const questionFor = (row: Database['public']['Tables']['tasks']['Row']) =>
  askQuestion(taskFromRow(row)) ?? 'What does “done” look like for this? One sentence is fine.'

/** Opens the answer box for an open ASK ticket. Returns an error line for the clicker otherwise. */
export async function openAnswerModal(db: Db, link: SlackLink, taskId: string, triggerId: string): Promise<string | null> {
  const row = await openAsk(db, link.workspaceId, taskId)
  if (!row) return NOT_OPEN
  await slackApi('views.open', link.token, { trigger_id: triggerId, view: answerModal({ taskId: row.id, title: row.title, question: questionFor(row) }) })
  return null
}

export type Submitted = { ok: true; reply: string } | { ok: false; error: string }

/**
 * Records an answer typed into the Slack box, exactly like a reply on GitHub: comment, rules
 * re-triage, receipt. A GitHub-sourced ticket gets its label updated if the decision changed.
 */
export async function submitAnswer(db: Db, link: SlackLink, member: Member, taskId: string, text: string): Promise<Submitted> {
  if (text.trim().length < 3) return { ok: false, error: 'A few words at least, please.' }
  const row = await openAsk(db, link.workspaceId, taskId)
  if (!row) return { ok: false, error: NOT_OPEN }
  const out = await applyAnswer(db, link.workspaceId, row, { authorName: `${member.name} (Slack)`, authorId: member.userId, body: text, via: 'slack', who: member.name })
  if (out.result === 'retriaged') await requestWriteBack(link.workspaceId, [out.taskId]).catch((e) => console.error('[trackers] write-back request', e))
  if (trackersConfigured()) {
    await afterResponse(() => relayAnswer(db, link.workspaceId, taskId, member.name, text).catch((e) => console.error('[trackers] relay answer', e instanceof Error ? e.message : e)))
  }
  const after = out.decision === 'ASK' ? await openAsk(db, link.workspaceId, taskId) : null
  return { ok: true, reply: answerOutcome({ title: out.title, decision: out.decision, question: after ? questionFor(after) : null }) }
}
