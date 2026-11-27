// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
'use client'

import type { RealtimePostgresChangesPayload, SupabaseClient } from '@supabase/supabase-js'
import type { Database, Tables } from '@/db/database.types'
import type { Task, SprintArchive } from '@/types'
import { useSprintStore, computeLoadsFromTasks, type WorkspaceSnapshot } from '@/store/useSprintStore'
import { can, type Role } from '@/lib/permissions'
import { deriveBurndown } from '@/logic/burndown'
import { diffById, fieldsChanged } from './diff'
import {
  taskFromRow, taskToInsert, taskToUpdate, escalationFromRow, escalationToInsert, feedFromRow, feedToInsert,
  sprintFromRow, sprintToUpdate, policyToUpdate, commentFromRow, teamFromRow,
} from './mappers'

type State = ReturnType<typeof useSprintStore.getState>
type Client = SupabaseClient<Database>
// soft: failure is logged but doesn't roll back the board (e.g. audit-log writes).
type Op = () => PromiseLike<{ error: { code?: string; message: string } | null; soft?: boolean }>

export interface SyncContext {
  supabase: Client
  workspaceId: string
  userId: string
  role: Role
  refresh: (workspaceId: string) => Promise<WorkspaceSnapshot | null>
}

const TASK_FIELDS = [
  'title', 'description', 'type', 'status', 'urgency', 'impact', 'effort', 'risk', 'clarity', 'assigneeId',
  'externalBlockers', 'source', 'externalRef', 'storyPoints', 'tags', 'decision', 'decisionReason', 'triageScore',
  'confidence', 'isAITriaged', 'isAdHoc', 'adHocResolution', 'adHocSwappedTaskId', 'goalAlignment', 'acceptanceCriteria',
] as const satisfies readonly (keyof Task)[]

const SPRINT_FIELDS = ['name', 'goal', 'committedPoints', 'totalPoints', 'velocity', 'health'] as const

interface AgentPayload {
  decisions: Array<{ taskId: string | null; kind: 'triage' | 'assign'; source: 'ai' | 'rules'; decision: Task['decision'] | null; rationale: string; payload: Record<string, unknown> }>
  calibration?: Record<'ACT' | 'ASK' | 'ESCALATE', { correct: number; total: number }>
  policyTune?: { actMinClarity: number }
}

/** Translates one store transition into database writes the caller's role is allowed to make. */
export function planWrites(prev: State, next: State, ctx: Omit<SyncContext, 'supabase' | 'refresh'>, db: Client) {
  const ops: Op[] = []
  const agent: AgentPayload = { decisions: [] }
  const ws = ctx.workspaceId
  const sprintId = next.sprint.id || null
  const canCreate = can(ctx.role, 'task:create')

  /* tasks */
  if (next.tasks !== prev.tasks) {
    const { added, changed } = diffById(prev.tasks, next.tasks)
    for (const t of added) {
      ops.push(() => db.from('tasks').insert(taskToInsert(t, ws, sprintId, ctx.userId)))
      if (t.decision) {
        agent.decisions.push({
          taskId: t.id, kind: 'triage', source: t.isAITriaged ? 'ai' : 'rules', decision: t.decision,
          rationale: t.decisionReason || `Triaged as ${t.decision}`, payload: { score: t.triageScore ?? null },
        })
      }
      if (t.dependencies.length) {
        ops.push(() => db.from('task_dependencies').insert(t.dependencies.map((d) => ({ workspace_id: ws, task_id: t.id, depends_on_task_id: d }))))
      }
    }
    for (const { prev: a, next: b } of changed) {
      if (fieldsChanged(a, b, TASK_FIELDS)) {
        ops.push(() => db.from('tasks').update(taskToUpdate(b, sprintId)).eq('id', b.id))
      }
      const before = new Set((a.comments ?? []).map((c) => c.id))
      const fresh = (b.comments ?? []).filter((c) => !before.has(c.id))
      if (fresh.length) {
        ops.push(() => db.from('task_comments').insert(fresh.map((c) => ({
          id: c.id, workspace_id: ws, task_id: b.id, author_id: ctx.userId, author_name: c.author, body: c.text,
        }))))
      }
      if (fieldsChanged(a, b, ['dependencies'])) {
        const removed = a.dependencies.filter((d) => !b.dependencies.includes(d))
        const addedDeps = b.dependencies.filter((d) => !a.dependencies.includes(d))
        if (removed.length) ops.push(() => db.from('task_dependencies').delete().eq('task_id', b.id).in('depends_on_task_id', removed))
        if (addedDeps.length) ops.push(() => db.from('task_dependencies').insert(addedDeps.map((d) => ({ workspace_id: ws, task_id: b.id, depends_on_task_id: d }))))
      }
      // Agent decisions → append-only audit log (server route; humans can't forge agent rows).
      if (b.decision && (a.decision !== b.decision || a.decisionReason !== b.decisionReason)) {
        agent.decisions.push({
          taskId: b.id, kind: 'triage', source: b.isAITriaged ? 'ai' : 'rules', decision: b.decision,
          rationale: b.decisionReason || `Triaged as ${b.decision}`, payload: { score: b.triageScore ?? null },
        })
      }
      if (b.assigneeId && a.assigneeId !== b.assigneeId && b.confidence !== undefined && b.confidence !== a.confidence) {
        agent.decisions.push({
          taskId: b.id, kind: 'assign', source: b.isAITriaged ? 'ai' : 'rules', decision: 'ACT',
          rationale: `Assigned with ${b.confidence}% confidence.`, payload: { assigneeId: b.assigneeId, confidence: b.confidence },
        })
      }
    }
  }

  /* escalations */
  if (next.escalations !== prev.escalations) {
    const { added, changed } = diffById(prev.escalations, next.escalations)
    for (const e of added) ops.push(() => db.from('escalations').insert(escalationToInsert(e, ws)))
    for (const { prev: a, next: b } of changed) {
      if (!a.resolved && b.resolved) {
        ops.push(() => db.from('escalations').update({ resolved_at: new Date().toISOString(), resolved_by: ctx.userId }).eq('id', b.id))
      }
    }
  }

  /* feed (append-only) */
  if (next.feed !== prev.feed && canCreate) {
    const seen = new Set(prev.feed.map((f) => f.id))
    const fresh = next.feed.filter((f) => !seen.has(f.id))
    if (fresh.length) ops.push(() => db.from('feed_events').insert(fresh.map((f) => feedToInsert(f, ws))))
  }

  /* sprint fields (completed_points is trigger-owned) */
  if (next.sprint !== prev.sprint && next.sprint.id === prev.sprint.id && can(ctx.role, 'sprint:manage')
      && fieldsChanged(prev.sprint, next.sprint, SPRINT_FIELDS)) {
    ops.push(() => db.from('sprints').update(sprintToUpdate(next.sprint)).eq('id', next.sprint.id))
  }

  /* autonomy policy: admins edit directly; PM clients may only self-tune ±1 via the agent route */
  if (next.autonomyConfig !== prev.autonomyConfig) {
    if (can(ctx.role, 'policy:edit')) {
      ops.push(() => db.from('autonomy_policies').update(policyToUpdate(next.autonomyConfig)).eq('workspace_id', ws))
    } else if (can(ctx.role, 'task:manage') && Math.abs(next.autonomyConfig.actMinClarity - prev.autonomyConfig.actMinClarity) === 1) {
      agent.policyTune = { actMinClarity: next.autonomyConfig.actMinClarity }
    }
  }

  /* calibration (PM+ via agent route) */
  if (next.calibration !== prev.calibration && can(ctx.role, 'task:manage')) {
    const c = next.calibration
    agent.calibration = { ACT: c.act, ASK: c.ask, ESCALATE: c.escalate }
  }

  if (canCreate && (agent.decisions.length || agent.calibration || agent.policyTune)) {
    ops.push(async () => {
      const res = await fetch('/api/agent/events', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: ws, ...agent }),
      })
      return { error: res.ok ? null : { code: String(res.status), message: `agent events ${res.status}` }, soft: true }
    })
  }

  return ops
}

/** Wires the store to Supabase: write-through for local changes, realtime merge for remote ones. */
export function startSync(ctx: SyncContext): () => void {
  const { supabase: db, workspaceId } = ctx
  let applyingRemote = false
  let queue: Promise<void> = Promise.resolve()
  let resyncing = false

  const applyRemote = (fn: (s: State) => Partial<State>) => {
    applyingRemote = true
    try { useSprintStore.setState(fn) } finally { applyingRemote = false }
  }

  const resync = async (message: string | null) => {
    if (resyncing) return
    resyncing = true
    try {
      const snap = await ctx.refresh(workspaceId)
      if (snap) {
        applyingRemote = true
        try { useSprintStore.getState().hydrate(snap) } finally { applyingRemote = false }
      }
      useSprintStore.getState().setSyncError(message)
    } finally {
      resyncing = false
    }
  }

  const unsubscribe = useSprintStore.subscribe((next, prev) => {
    if (applyingRemote || next.viewingArchive || prev.viewingArchive) return
    if (next.workspaceId !== workspaceId || prev.workspaceId !== workspaceId) return

    if (ctx.role === 'viewer' && (next.tasks !== prev.tasks || next.escalations !== prev.escalations)) {
      queue = queue.then(() => resync('View-only access — changes are not saved.'))
      return
    }

    // Sprint rollover: one atomic RPC, then reload everything.
    if (next.sprint.id !== prev.sprint.id && prev.sprint.id) {
      const s = next.sprint
      const snapshot: SprintArchive['snapshot'] = {
        tasks: prev.tasks, escalations: prev.escalations, burndownSnapshots: prev.burndownSnapshots, sprint: prev.sprint,
      }
      queue = queue.then(async () => {
        const { error } = await db.rpc('start_new_sprint', {
          p_workspace: workspaceId, p_name: s.name, p_goal: s.goal, p_start: s.startDate, p_end: s.endDate,
          p_committed: s.committedPoints, p_velocity: s.velocity, p_snapshot: snapshot as never,
        })
        await resync(error ? 'Could not start the new sprint — your role may not allow it.' : null)
      })
      return
    }

    const ops = planWrites(prev, next, ctx, db)
    if (!ops.length) return
    queue = queue.then(async () => {
      for (const op of ops) {
        const { error, soft } = await op()
        if (error && soft) { console.warn('[sync] agent log write failed', error); continue }
        if (error) {
          console.warn('[sync] write rejected', error)
          await resync(error.code === '42501' || error.code === '403'
            ? "Your role doesn't allow that change — showing the latest saved data."
            : "Couldn't save a change — showing the latest saved data.")
          return
        }
      }
    })
  })

  /* realtime: merge remote changes (RLS applies to the subscription) */
  const filter = `workspace_id=eq.${workspaceId}`
  const inScope = (row: Tables<'tasks'>) => {
    const sid = useSprintStore.getState().sprint.id
    return row.sprint_id === sid || row.sprint_id === null
  }
  const withDerived = (s: State, tasks: Task[]): Partial<State> => ({
    tasks, team: computeLoadsFromTasks(tasks, s.team), burndownSnapshots: deriveBurndown(s.sprint, tasks),
  })

  let disposed = false
  const channel = db.channel(`workspace:${workspaceId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter }, (p: RealtimePostgresChangesPayload<Tables<'tasks'>>) => {
      if (useSprintStore.getState().viewingArchive) return
      applyRemote((s) => {
        if (p.eventType === 'DELETE') return withDerived(s, s.tasks.filter((t) => t.id !== (p.old as { id?: string }).id))
        const row = p.new
        const local = s.tasks.find((t) => t.id === row.id)
        if (!inScope(row)) return local ? withDerived(s, s.tasks.filter((t) => t.id !== row.id)) : {}
        const merged = { ...taskFromRow(row, local?.dependencies ?? [], local?.comments ?? []), isNew: local?.isNew }
        if (local && !fieldsChanged(local, merged, [...TASK_FIELDS, 'completedAt'])) return {}
        return withDerived(s, local ? s.tasks.map((t) => (t.id === row.id ? merged : t)) : [...s.tasks, merged])
      })
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'escalations', filter }, (p: RealtimePostgresChangesPayload<Tables<'escalations'>>) => {
      if (p.eventType === 'DELETE') return
      const e = escalationFromRow(p.new)
      applyRemote((s) => {
        const local = s.escalations.find((x) => x.id === e.id)
        if (local && local.resolved === e.resolved) return {}
        return { escalations: local ? s.escalations.map((x) => (x.id === e.id ? e : x)) : [e, ...s.escalations] }
      })
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'feed_events', filter }, (p: RealtimePostgresChangesPayload<Tables<'feed_events'>>) => {
      const f = feedFromRow(p.new as Tables<'feed_events'>)
      applyRemote((s) => (s.feed.some((x) => x.id === f.id) ? {} : { feed: [f, ...s.feed].slice(0, 100) }))
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sprints', filter }, (p: RealtimePostgresChangesPayload<Tables<'sprints'>>) => {
      const row = p.new as Tables<'sprints'>
      const s = useSprintStore.getState()
      if (row.id !== s.sprint.id || s.viewingArchive) return
      // Another PM rolled the sprint over: our sprint just became archived.
      if (row.status === 'archived') { queue = queue.then(() => resync('A new sprint was started — loaded it.')); return }
      const sprint = sprintFromRow(row)
      applyRemote((st) => ({ sprint, burndownSnapshots: deriveBurndown(sprint, st.tasks) }))
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'task_comments', filter }, (p: RealtimePostgresChangesPayload<Tables<'task_comments'>>) => {
      const row = p.new as Tables<'task_comments'>
      const c = commentFromRow(row)
      applyRemote((s) => ({
        tasks: s.tasks.map((t) => (t.id !== row.task_id || (t.comments ?? []).some((x) => x.id === c.id)
          ? t : { ...t, comments: [...(t.comments ?? []), c] })),
      }))
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'team_members', filter }, (p: RealtimePostgresChangesPayload<Tables<'team_members'>>) => {
      applyRemote((s) => {
        if (p.eventType === 'DELETE') {
          const id = (p.old as { id?: string }).id
          return { team: computeLoadsFromTasks(s.tasks, s.team.filter((m) => m.id !== id)) }
        }
        const m = teamFromRow(p.new)
        const exists = s.team.some((x) => x.id === m.id)
        const team = exists ? s.team.map((x) => (x.id === m.id ? m : x)) : [...s.team, m]
        return { team: computeLoadsFromTasks(s.tasks, team) }
      })
    })

  // Join with the user's JWT, not the anon key — otherwise RLS filters out every event.
  void db.auth.getSession().then(async ({ data }) => {
    if (disposed) return
    if (data.session) await db.realtime.setAuth(data.session.access_token)
    channel.subscribe((status, err) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') console.warn('[realtime]', status, err?.message)
    })
  })

  return () => {
    disposed = true
    unsubscribe()
    void db.removeChannel(channel)
  }
}
