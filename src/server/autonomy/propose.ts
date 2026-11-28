// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/db/database.types'
import { findBestAssignee } from '@/logic/assign'
import { computeLoadsFromTasks } from '@/logic/load'
import { LEVEL_NAMES, mayAct } from '@/logic/earnedAutonomy'
import { loadWorkspace } from '@/lib/data/loadWorkspace'
import { licenseLevel, loadLicenses, recordPrediction } from './licenses'

type Db = SupabaseClient<Database>

export type Proposal = { result: 'assigned' | 'suggested' | 'observed'; memberId: string } | { result: 'not-applicable' | 'no-candidate' }

/**
 * The agent's owner for one ACT task, subject to its licence: it assigns at L2+, suggests at L1 and only
 * records its prediction at L0. Used when someone files work in the app (the tick does the same for backlog).
 */
export async function proposeAssignment(db: Db, ws: string, taskId: string): Promise<Proposal> {
  const snap = await loadWorkspace(ws, db)
  const task = snap?.tasks.find((t) => t.id === taskId)
  if (!snap || !task || task.decision !== 'ACT' || task.assigneeId || task.status === 'done') return { result: 'not-applicable' }
  const best = findBestAssignee(task, computeLoadsFromTasks(snap.tasks, snap.team), snap.tasks)
  if (!best) return { result: 'no-candidate' }

  const level = licenseLevel(await loadLicenses(db, ws), task.type, 'assign')
  if (mayAct(level)) {
    const { data: done } = await db.from('tasks').update({ assignee_id: best.memberId, confidence: best.confidence, decision_reason: best.rationale, status: 'assigned' })
      .eq('id', taskId).eq('workspace_id', ws).is('assignee_id', null).select('id')
    if (!done?.length) return { result: 'not-applicable' } // someone assigned it meanwhile
  }
  await recordPrediction(db, ws, { taskId, taskType: task.type, action: 'assign', level, predictedMemberId: best.memberId, confidence: best.confidence, rationale: best.rationale })
  if (mayAct(level)) {
    await db.from('feed_events').insert({ workspace_id: ws, type: 'assign', message: best.rationale, task_id: taskId, member_id: best.memberId, decision: 'ACT' })
    await db.from('decisions').insert({ workspace_id: ws, task_id: taskId, kind: 'assign', source: 'rules', decision: 'ACT', rationale: best.rationale, payload: { runner: 'server', mode: 'acted', to: best.memberId, confidence: best.confidence, level } })
    return { result: 'assigned', memberId: best.memberId }
  }
  if (level === 1) {
    await db.from('feed_events').insert({ workspace_id: ws, type: 'assign', task_id: taskId, member_id: best.memberId, decision: 'ACT', message: `Suggests ${best.memberName} for "${task.title}". A person decides: ${task.type} assignments are at “${LEVEL_NAMES[1]}”.` })
    await db.from('decisions').insert({ workspace_id: ws, task_id: taskId, kind: 'assign', source: 'rules', decision: null, rationale: best.rationale, payload: { runner: 'server', mode: 'shadow', suggested: best.memberId, confidence: best.confidence, level } })
  }
  return { result: level === 1 ? 'suggested' : 'observed', memberId: best.memberId }
}
