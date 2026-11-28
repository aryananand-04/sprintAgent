// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import 'server-only'
import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/db/database.types'
import type { Task } from '@/types'
import { analyzeRequest, askQuestion } from '@/logic/textSignals'
import { INTAKE_HELP, intakeReply, slackToPlain, withAnswerButtons, type SlackMessage } from '@/logic/slack'
import { taskToInsert } from '@/lib/data/mappers'
import { loadWorkspace } from '@/lib/data/loadWorkspace'
import { triageBacklog } from '@/server/agent/triageBacklog'
import type { Member } from './actions'

type Db = SupabaseClient<Database>

const MAX_TEXT = 4_000

/**
 * Files a request from Slack as a backlog task, triages it straight away with the rules (fast enough
 * for Slack's 3-second window; the same follow-through as the agent: ACT gets an owner, ESCALATE goes
 * to the PM) and returns the reply for the person who asked (with an Answer button on an ASK).
 */
export async function intakeFromSlack(db: Db, ws: string, member: Member, rawText: string): Promise<SlackMessage> {
  const text = slackToPlain(rawText).slice(0, MAX_TEXT)
  if (text.length < 3) return { text: INTAKE_HELP }

  const { task: read } = analyzeRequest(text)
  const { data: sprint } = await db.from('sprints').select('id').eq('workspace_id', ws).eq('status', 'active').maybeSingle()
  const task: Task = { ...read, id: randomUUID(), status: 'backlog', dependencies: [], source: 'Slack', createdAt: new Date().toISOString() }
  const { error } = await db.from('tasks').insert(taskToInsert(task, ws, sprint?.id ?? null, member.userId))
  if (error) throw error
  await db.from('feed_events').insert({ workspace_id: ws, type: 'intake', task_id: task.id, message: `New request from Slack: "${task.title}".` })

  const snap = await loadWorkspace(ws, db)
  if (snap) await triageBacklog(db, ws, snap, { apiKey: undefined, only: [task.id] })

  const { data: row } = await db.from('tasks').select('decision, assignee_id').eq('id', task.id).single()
  const assignee = row?.assignee_id ? snap?.team.find((m) => m.id === row.assignee_id)?.name : null
  const ask = row?.decision === 'ASK'
  const reply = intakeReply({ title: task.title, decision: row?.decision ?? null, assigneeName: assignee, question: ask ? askQuestion(task) : null })
  return ask ? withAnswerButtons(reply, [{ taskId: task.id, label: 'Answer it now' }]) : { text: reply }
}
