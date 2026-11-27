// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
// Provenance: sprintagent-prov-7c1e94d2b85a
import type { AutonomyConfig, EscalationItem, Sprint, Task, TeamMember } from '../types'

// Structural thresholds (not policy, so not in AutonomyConfig).
export const REBALANCE_TARGET_MAX = 75
export const BLOCKER_RESOLUTION_MAX = 70
export const VELOCITY_DAYS_REMAINING = 7
/** A check that fired is quiet for this long, so the agent doesn't repeat itself every tick. */
export const COOLDOWN_MS = 20 * 60_000

type Urgency = 'critical' | 'high' | 'medium' | 'low'
type Category = 'capacity' | 'blocker' | 'missing-criteria'

/** What the agent wants to do this tick. Applying it (store or database) is someone else's job. */
export type AgentAction =
  | { kind: 'reassign'; key: string; taskId: string; toMemberId: string; feedType: 'risk' | 'resolve'; feedTaskId: string; message: string; prompt: string }
  | { kind: 'escalate'; key: string; taskId: string; reason: string; recommendation: string; urgency: Urgency; category: Category; prompt?: string }
  | { kind: 'feed'; key: string; type: 'risk' | 'escalate'; message: string; taskId?: string; decision: 'ACT' | 'ASK' | 'ESCALATE'; prompt?: string }

export interface TickInput {
  tasks: Task[]
  team: TeamMember[]
  sprint: Sprint
  escalations: EscalationItem[]
  config: AutonomyConfig
  now: number
  /** True if the check with this key hasn't fired within COOLDOWN_MS. */
  canFire: (key: string) => boolean
}

const hoursSince = (iso: string, now: number) => (now - new Date(iso).getTime()) / 3_600_000

/**
 * One pass of the agent's periodic checks: capacity, blockers, velocity, critical unassigned work and
 * stale escalations. Pure: same input, same plan. A teammate receives at most one reassignment per tick.
 */
export function planAgentTick({ tasks, team, sprint, escalations, config, now, canFire }: TickInput): AgentAction[] {
  const actions: AgentAction[] = []
  const fired = new Set<string>()
  const may = (key: string) => !fired.has(key) && canFire(key) && (fired.add(key), true)
  const usedCandidates = new Set<string>()

  // 1. Capacity breach → move the smallest task to whoever has the most room, else escalate.
  for (const member of team.filter((m) => m.currentLoad > config.capacityBreachThreshold)) {
    const key = `cap-${member.id}`
    if (!may(key)) continue
    const memberTasks = tasks
      .filter((t) => t.assigneeId === member.id && t.status !== 'done' && t.status !== 'blocked')
      .sort((a, b) => (a.storyPoints ?? 2) - (b.storyPoints ?? 2))
    const smallest = memberTasks[0]
    if (!smallest) {
      actions.push({ kind: 'feed', key, type: 'escalate', decision: 'ESCALATE', message: `${member.name} at ${member.currentLoad}% — no tasks to reassign and no available teammates.` })
      continue
    }
    const candidate = team
      .filter((m) => m.id !== member.id && m.currentLoad < REBALANCE_TARGET_MAX && !usedCandidates.has(m.id))
      .sort((a, b) => a.currentLoad - b.currentLoad)[0]
    if (candidate) {
      usedCandidates.add(candidate.id)
      actions.push({
        kind: 'reassign', key, taskId: smallest.id, toMemberId: candidate.id, feedType: 'risk', feedTaskId: smallest.id,
        message: `Capacity rebalance: ${member.name} at ${member.currentLoad}%. Moving "${smallest.title}" to ${candidate.name}.`,
        prompt: `Sprint agent, 1 sentence, first person: ${member.name} at ${member.currentLoad}% load. Reassigning "${smallest.title}" to ${candidate.name} (${candidate.currentLoad}% load) to rebalance.`,
      })
    } else {
      actions.push({
        kind: 'escalate', key, taskId: smallest.id, urgency: 'high', category: 'capacity',
        reason: `${member.name} at ${member.currentLoad}% load — no teammates available to absorb work. PM decision needed on scope or deferral.`,
        recommendation: 'Review team capacity and decide: defer a task, add a resource, or descope.',
      })
    }
  }

  // 2. Blocked work → reassign an unfinished dependency to someone with room, else escalate.
  for (const task of tasks.filter((t) => t.status === 'blocked')) {
    const hours = hoursSince(task.createdAt, now)
    if (hours < config.blockedHoursThreshold) continue
    const key = `blocked-${task.id}`
    if (!may(key)) continue

    let resolved = false
    for (const depId of task.dependencies) {
      const dep = tasks.find((t) => t.id === depId)
      if (!dep || dep.status === 'done') continue
      const owner = dep.assigneeId ? team.find((m) => m.id === dep.assigneeId) : undefined
      if (owner && owner.currentLoad <= 80) continue
      const fits = (m: TeamMember) => m.skills.some((s) => dep.tags?.includes(s)) || (dep.type === 'bug' && m.skills.includes('backend'))
      const candidate = team
        .filter((m) => m.id !== dep.assigneeId && m.currentLoad < BLOCKER_RESOLUTION_MAX && !usedCandidates.has(m.id))
        .sort((a, b) => Number(fits(b)) - Number(fits(a)) || a.currentLoad - b.currentLoad)[0]
      if (!candidate) continue
      usedCandidates.add(candidate.id)
      actions.push({
        kind: 'reassign', key, taskId: dep.id, toMemberId: candidate.id, feedType: 'resolve', feedTaskId: task.id,
        message: `Resolved blocker: reassigned "${dep.title}" to ${candidate.name} to unblock "${task.title}" — blocked ${Math.round(hours)}h.`,
        prompt: `Sprint agent, 1 sentence: "${task.title}" is blocked because "${dep.title}" isn't done. I've reassigned the dependency to ${candidate.name} (${candidate.currentLoad}% load) to unblock it.`,
      })
      resolved = true
      break
    }
    if (!resolved) {
      actions.push({
        kind: 'escalate', key, taskId: task.id, category: 'blocker', urgency: task.urgency === 'critical' ? 'critical' : 'high',
        reason: `"${task.title}" blocked ${Math.round(hours)}h — no auto-resolution available. PM needs to: ${task.decisionReason?.slice(0, 80) ?? 'clarify the blocker and assign next action'}.`,
        recommendation: 'Clarify the blocker and assign a next action so the agent can proceed.',
        prompt: `Sprint agent, 1 sentence, urgent: "${task.title}" blocked ${Math.round(hours)}h with no autonomous resolution path. State what specifically needs to happen.`,
      })
    }
  }

  // 3. Velocity: behind pace late in the sprint → say so.
  const length = Math.max(1, Math.ceil((new Date(sprint.endDate).getTime() - new Date(sprint.startDate).getTime()) / 86_400_000))
  const elapsed = Math.max(1, Math.ceil((now - new Date(sprint.startDate).getTime()) / 86_400_000))
  const deficit = (sprint.committedPoints / length) * Math.min(elapsed, length) - sprint.completedPoints
  if (deficit > config.velocityDeficitPts && sprint.daysRemaining <= VELOCITY_DAYS_REMAINING && may('velocity')) {
    actions.push({
      kind: 'feed', key: 'velocity', type: 'risk', decision: 'ASK',
      message: `Velocity alert: ${Math.round(deficit)} points behind pace with ${sprint.daysRemaining} days remaining — recommend de-scoping low-priority backlog items.`,
      prompt: `Sprint agent, 1 sentence: ${sprint.completedPoints}/${sprint.committedPoints} pts, ${sprint.daysRemaining} days left, ${Math.round(deficit)}-pt deficit. State risk and what I recommend dropping or accelerating.`,
    })
  }

  // 4. Critical work nobody owns, past the PM's threshold → escalate.
  for (const task of tasks.filter((t) => t.urgency === 'critical' && !t.assigneeId && t.status !== 'done' && t.status !== 'blocked')) {
    const hours = hoursSince(task.createdAt, now)
    if (hours < config.escalateIfCriticalUnassignedHours) continue
    const key = `critical-unassigned-${task.id}`
    if (!may(key)) continue
    actions.push({
      kind: 'escalate', key, taskId: task.id, urgency: 'critical', category: 'missing-criteria',
      reason: `Critical task unassigned for ${Math.round(hours)}h — exceeds the configured ${config.escalateIfCriticalUnassignedHours}h threshold. Sprint goal at risk.`,
      recommendation: 'Assign this task immediately or explicitly defer it to unblock the agent.',
    })
  }

  // 5. Escalations waiting too long → nudge.
  for (const esc of escalations.filter((e) => !e.resolved)) {
    const hours = hoursSince(esc.createdAt, now)
    if (hours < config.escNudgeHours) continue
    const key = `esc-nudge-${esc.id}`
    if (!may(key)) continue
    actions.push({
      kind: 'feed', key, type: 'escalate', decision: 'ESCALATE', taskId: esc.taskId,
      message: `"${esc.taskTitle}" — ${Math.round(hours)}h without a decision. I cannot proceed autonomously. Nudging PM for resolution.`,
    })
  }

  return actions
}
