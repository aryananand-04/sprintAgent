// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/db/database.types'
import { loadWorkspace } from '@/lib/data/loadWorkspace'
import { COOLDOWN_MS, planAgentTick, type AgentAction } from '@/logic/agentLoop'
import { computeLoadsFromTasks } from '@/logic/load'
import { generateStandupText, standupDue } from '@/logic/standup'
import { enqueue } from '@/server/outbox'
import { triageBacklog } from './triageBacklog'

type Db = SupabaseClient<Database>

export type StandupResult = 'not-due' | 'already' | 'posted' | 'no-integration'
export interface TickResult { workspaceId: string; planned: number; applied: number; skipped: number; triaged?: number; standup?: StandupResult }

/**
 * One server-side agent pass for a workspace: plan from the database, then apply each action
 * only if its cooldown can be claimed (atomic), so concurrent runners never double-act.
 */
export async function runAgentTick(db: Db, workspaceId: string, now = Date.now()): Promise<TickResult> {
  const snap = await loadWorkspace(workspaceId, db)
  if (!snap) return { workspaceId, planned: 0, applied: 0, skipped: 0 }

  const team = computeLoadsFromTasks(snap.tasks, snap.team)
  // Cooldowns are enforced at claim time; planning sees everything as eligible.
  const actions = planAgentTick({ tasks: snap.tasks, team, sprint: snap.sprint, escalations: snap.escalations, config: snap.autonomyConfig, now, canFire: () => true })

  let applied = 0
  for (const action of actions) {
    const { data: claimed, error } = await db.rpc('claim_agent_cooldown', { ws: workspaceId, check_key: action.key, cooldown_seconds: COOLDOWN_MS / 1000 })
    if (error) throw error
    if (!claimed) continue
    await apply(db, workspaceId, action, snap.tasks)
    applied++
  }
  const triaged = await triageBacklog(db, workspaceId, { ...snap, team })
  const standup = await postStandup(db, workspaceId, { ...snap, team }, new Date(now))
  return { workspaceId, planned: actions.length, applied, skipped: actions.length - applied, triaged, standup }
}

type Snapshot = NonNullable<Awaited<ReturnType<typeof loadWorkspace>>>

/**
 * The daily standup, written from the database and sent to the workspace's integrations at 9am in its
 * time zone. Claimed per local day, so it goes out once however many runners or PMs there are.
 */
export async function postStandup(db: Db, ws: string, snap: Pick<Snapshot, 'tasks' | 'team' | 'sprint' | 'escalations'>, now: Date): Promise<StandupResult> {
  const { data: w } = await db.from('workspaces').select('timezone').eq('id', ws).single()
  const tz = w?.timezone ?? 'UTC'
  const { due, day } = standupDue(now, tz)
  if (!due) return 'not-due'
  const { data: first, error } = await db.rpc('claim_agent_cooldown', { ws, check_key: `standup-${day}`, cooldown_seconds: 2 * 86_400 })
  if (error) throw error
  if (!first) return 'already'

  const text = generateStandupText(snap.tasks, snap.team, snap.sprint, snap.escalations, now, tz)
  const queued = await enqueue(db, ws, { type: 'standup', text })
  if (!queued) return 'no-integration'
  const weekday = now.toLocaleDateString('en-US', { weekday: 'long', timeZone: tz })
  await db.from('feed_events').insert({ workspace_id: ws, type: 'status', message: `Standup sent for ${weekday}: ${snap.team.length} people, ${snap.sprint.daysRemaining} days left. Nobody had to stand.` })
  return 'posted'
}

async function apply(db: Db, ws: string, a: AgentAction, tasks: { id: string; title: string; status: string }[]) {
  const feed = (row: { type: Database['public']['Enums']['feed_type']; message: string; task_id?: string | null; member_id?: string | null; decision?: 'ACT' | 'ASK' | 'ESCALATE' | null }) =>
    db.from('feed_events').insert({ workspace_id: ws, ...row })
  const audit = (row: { task_id: string | null; kind: Database['public']['Enums']['decision_kind']; decision: 'ACT' | 'ASK' | 'ESCALATE'; rationale: string; payload?: Record<string, unknown> }) =>
    db.from('decisions').insert({ workspace_id: ws, source: 'rules', ...row, payload: { runner: 'server', ...row.payload } as never })

  if (a.kind === 'reassign') {
    const task = tasks.find((t) => t.id === a.taskId)
    const status = task && (task.status === 'triaged' || task.status === 'backlog') ? 'assigned' : undefined
    await db.from('tasks').update({ assignee_id: a.toMemberId, decision_reason: a.message, ...(status && { status }) }).eq('id', a.taskId).eq('workspace_id', ws)
    await feed({ type: a.feedType, message: a.message, task_id: a.feedTaskId, member_id: a.toMemberId, decision: 'ACT' })
    await audit({ task_id: a.taskId, kind: 'rebalance', decision: 'ACT', rationale: a.message, payload: { to: a.toMemberId, check: a.key } })
    return
  }

  if (a.kind === 'escalate') {
    const { count } = await db.from('escalations').select('id', { count: 'exact', head: true })
      .eq('workspace_id', ws).eq('task_id', a.taskId).is('resolved_at', null)
    if (count) return
    const title = tasks.find((t) => t.id === a.taskId)?.title ?? 'Task'
    await db.from('escalations').insert({ workspace_id: ws, task_id: a.taskId, task_title: title, reason: a.reason, recommendation: a.recommendation, urgency: a.urgency, category: a.category })
    await db.from('tasks').update({ decision: 'ESCALATE', is_ai_triaged: false }).eq('id', a.taskId).eq('workspace_id', ws)
    await feed({ type: 'escalate', message: a.reason, task_id: a.taskId, decision: 'ESCALATE' })
    await audit({ task_id: a.taskId, kind: 'escalate', decision: 'ESCALATE', rationale: a.reason, payload: { check: a.key, category: a.category } })
    await enqueue(db, ws, { type: 'escalation', taskTitle: title, reason: a.reason, recommendation: a.recommendation, urgency: a.urgency }).catch(() => 0)
    return
  }

  await feed({ type: a.type, message: a.message, task_id: a.taskId ?? null, decision: a.decision })
}

/** Workspaces with an active sprint: the ones the agent has work to do in. */
export async function activeWorkspaceIds(db: Db): Promise<string[]> {
  const { data, error } = await db.from('sprints').select('workspace_id').eq('status', 'active')
  if (error) throw error
  return [...new Set((data ?? []).map((r) => r.workspace_id))]
}
