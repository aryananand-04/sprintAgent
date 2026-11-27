// Pure conversions between database rows (snake_case) and domain types (src/types).
import type { Tables, TablesInsert, TablesUpdate } from '@/db/database.types'
import type {
  Task, TeamMember, Sprint, EscalationItem, FeedEvent, AutonomyConfig, CalibrationData, SprintArchive, TaskComment,
} from '@/types'

type TaskRow = Tables<'tasks'>
type SprintRow = Tables<'sprints'>

const undef = <T,>(v: T | null): T | undefined => (v === null ? undefined : v)

export const daysRemaining = (endDate: string, now = Date.now()) =>
  Math.max(0, Math.ceil((new Date(endDate).getTime() - now) / 86_400_000))

/* ── Tasks ─────────────────────────────────────────────────────────── */
export function taskFromRow(r: TaskRow, deps: string[] = [], comments: TaskComment[] = []): Task {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    type: r.type,
    status: r.status,
    urgency: r.urgency,
    impact: r.impact,
    effort: r.effort,
    risk: r.risk,
    clarity: r.clarity,
    assigneeId: undef(r.assignee_id),
    dependencies: deps,
    externalBlockers: r.external_blockers,
    source: r.source,
    confidence: undef(r.confidence),
    decision: undef(r.decision),
    decisionReason: undef(r.decision_reason),
    triageScore: undef(r.triage_score),
    storyPoints: undef(r.story_points),
    tags: r.tags,
    isAdHoc: r.is_ad_hoc,
    isAITriaged: r.is_ai_triaged,
    createdAt: r.created_at,
    adHocResolution: undef(r.ad_hoc_resolution),
    adHocSwappedTaskId: undef(r.ad_hoc_swapped_task_id),
    comments,
    goalAlignment: undef(r.goal_alignment),
    acceptanceCriteria: undef(r.acceptance_criteria),
    completedAt: undef(r.completed_at),
    externalRef: undef(r.external_ref),
  }
}

/** Columns a client may write. Excludes trigger-owned (completed_at, updated_at) and identity columns. */
export function taskToUpdate(t: Task, sprintId: string | null): TablesUpdate<'tasks'> {
  return {
    sprint_id: sprintId,
    title: t.title,
    description: t.description,
    type: t.type,
    status: t.status,
    urgency: t.urgency,
    impact: t.impact,
    effort: t.effort,
    risk: t.risk,
    clarity: t.clarity,
    assignee_id: t.assigneeId ?? null,
    external_blockers: t.externalBlockers,
    source: t.source,
    external_ref: t.externalRef ?? null,
    story_points: t.storyPoints ?? null,
    tags: t.tags ?? [],
    decision: t.decision ?? null,
    decision_reason: t.decisionReason ?? null,
    triage_score: t.triageScore ?? null,
    confidence: t.confidence ?? null,
    is_ai_triaged: !!t.isAITriaged,
    is_ad_hoc: !!t.isAdHoc,
    ad_hoc_resolution: t.adHocResolution ?? null,
    ad_hoc_swapped_task_id: t.adHocSwappedTaskId ?? null,
    goal_alignment: t.goalAlignment ?? null,
    acceptance_criteria: t.acceptanceCriteria ?? null,
  }
}

export function taskToInsert(t: Task, workspaceId: string, sprintId: string | null, userId: string): TablesInsert<'tasks'> {
  const { sprint_id, ...rest } = taskToUpdate(t, sprintId)
  return {
    ...rest,
    sprint_id,
    id: t.id,
    workspace_id: workspaceId,
    created_by: userId,
    impact: t.impact,
    effort: t.effort,
    risk: t.risk,
    clarity: t.clarity,
    title: t.title,
    type: t.type,
  }
}

/* ── Team ──────────────────────────────────────────────────────────── */
export const teamFromRow = (r: Tables<'team_members'>): TeamMember => ({
  id: r.id,
  name: r.name,
  initials: r.initials,
  role: r.title,
  skills: r.skills,
  currentLoad: r.current_load,
  capacity: r.capacity,
  color: r.color,
  userId: r.user_id,
})

/* ── Sprints ───────────────────────────────────────────────────────── */
export const sprintFromRow = (r: SprintRow, now = Date.now()): Sprint => ({
  id: r.id,
  name: r.name,
  goal: r.goal,
  startDate: r.start_date,
  endDate: r.end_date,
  totalPoints: r.total_points,
  committedPoints: r.committed_points,
  completedPoints: r.completed_points,
  health: r.health,
  daysRemaining: daysRemaining(r.end_date, now),
  velocity: r.velocity,
})

/** Client-writable sprint columns. completed_points is trigger-owned. */
export const sprintToUpdate = (s: Sprint): TablesUpdate<'sprints'> => ({
  name: s.name,
  goal: s.goal,
  start_date: s.startDate,
  end_date: s.endDate,
  total_points: s.totalPoints,
  committed_points: s.committedPoints,
  velocity: s.velocity,
  health: s.health,
})

interface ArchiveSnapshot {
  taskCount?: number
  doneCount?: number
  escalationCount?: number
  full?: SprintArchive['snapshot']
}

export function archiveFromRow(r: SprintRow): SprintArchive {
  const snap = (r.snapshot ?? {}) as ArchiveSnapshot
  return {
    id: r.id,
    name: r.name,
    goal: r.goal,
    startDate: r.start_date,
    endDate: r.end_date,
    completedPoints: r.completed_points,
    committedPoints: r.committed_points,
    velocity: r.velocity,
    health: r.health,
    taskCount: snap.taskCount ?? 0,
    doneCount: snap.doneCount ?? 0,
    escalationCount: snap.escalationCount ?? 0,
    snapshot: snap.full,
  }
}

/* ── Escalations / feed / comments ─────────────────────────────────── */
export const escalationFromRow = (r: Tables<'escalations'>): EscalationItem => ({
  id: r.id,
  taskId: r.task_id ?? '',
  taskTitle: r.task_title,
  reason: r.reason,
  recommendation: r.recommendation,
  urgency: r.urgency,
  category: r.category,
  createdAt: r.created_at,
  resolved: r.resolved_at !== null,
})

export const escalationToInsert = (e: EscalationItem, workspaceId: string): TablesInsert<'escalations'> => ({
  id: e.id,
  workspace_id: workspaceId,
  task_id: e.taskId || null,
  task_title: e.taskTitle,
  reason: e.reason,
  recommendation: e.recommendation,
  urgency: e.urgency,
  category: e.category,
  resolved_at: e.resolved ? new Date().toISOString() : null,
})

export const feedFromRow = (r: Tables<'feed_events'>): FeedEvent => ({
  id: r.id,
  timestamp: r.created_at,
  type: r.type,
  message: r.message,
  taskId: undef(r.task_id),
  memberId: undef(r.member_id),
  decision: undef(r.decision),
})

export const feedToInsert = (f: FeedEvent, workspaceId: string): TablesInsert<'feed_events'> => ({
  id: f.id,
  workspace_id: workspaceId,
  type: f.type,
  message: f.message,
  task_id: f.taskId ?? null,
  member_id: f.memberId ?? null,
  decision: f.decision ?? null,
  created_at: f.timestamp,
})

export const commentFromRow = (r: Tables<'task_comments'>): TaskComment => ({
  id: r.id,
  text: r.body,
  author: r.author_name,
  timestamp: r.created_at,
})

/* ── Policy & calibration ──────────────────────────────────────────── */
export const policyFromRow = (r: Tables<'autonomy_policies'>): AutonomyConfig => ({
  actMinClarity: r.act_min_clarity,
  askMaxClarity: r.ask_max_clarity,
  escalateIfCriticalUnassignedHours: r.escalate_if_critical_unassigned_hours,
  neverAutoAssignTypes: r.never_auto_assign_types,
  capacityBreachThreshold: r.capacity_breach_threshold,
  blockedHoursThreshold: r.blocked_hours_threshold,
  escNudgeHours: r.esc_nudge_hours,
  velocityDeficitPts: r.velocity_deficit_pts,
})

export const policyToUpdate = (c: AutonomyConfig): TablesUpdate<'autonomy_policies'> => ({
  act_min_clarity: c.actMinClarity,
  ask_max_clarity: c.askMaxClarity,
  escalate_if_critical_unassigned_hours: c.escalateIfCriticalUnassignedHours,
  never_auto_assign_types: c.neverAutoAssignTypes,
  capacity_breach_threshold: c.capacityBreachThreshold,
  blocked_hours_threshold: c.blockedHoursThreshold,
  esc_nudge_hours: c.escNudgeHours,
  velocity_deficit_pts: c.velocityDeficitPts,
})

export function calibrationFromRows(rows: Tables<'calibration'>[]): CalibrationData {
  const pick = (d: 'ACT' | 'ASK' | 'ESCALATE') => {
    const r = rows.find((x) => x.decision === d)
    return { correct: r?.correct ?? 0, total: r?.total ?? 0 }
  }
  return { act: pick('ACT'), ask: pick('ASK'), escalate: pick('ESCALATE') }
}
