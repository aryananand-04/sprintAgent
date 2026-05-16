import type { Task, TeamMember, Sprint, EscalationItem, BriefingView } from '../types'

export function generateBriefings(
  tasks: Task[],
  team: TeamMember[],
  sprint: Sprint,
  escalations: EscalationItem[],
): BriefingView[] {
  const inProgress = tasks.filter((t) => t.status === 'in-progress')
  const blocked = tasks.filter((t) => t.status === 'blocked')
  const done = tasks.filter((t) => t.status === 'done')
  const openEsc = escalations.filter((e) => !e.resolved)
  const completedPct = Math.round((sprint.completedPoints / sprint.committedPoints) * 100)
  const overloadedMembers = team.filter((m) => m.currentLoad > 85)

  // Team Brief
  const teamBrief: BriefingView = {
    type: 'team',
    label: 'Team Brief',
    summary: `Sprint ${sprint.name}: ${completedPct}% committed scope done. ${inProgress.length} tasks in flight, ${blocked.length} blocked. ${openEsc.length} items need PM attention.`,
    items: [
      {
        icon: '⚡',
        label: 'In Progress',
        value: `${inProgress.length} tasks across ${[...new Set(inProgress.map((t) => t.assigneeId).filter(Boolean))].length} engineers`,
        severity: inProgress.length > 5 ? 'warn' : 'ok',
      },
      {
        icon: '🚧',
        label: 'Blocked',
        value: blocked.length > 0 ? `${blocked.map((t) => t.title.split(':')[0]).join(', ')}` : 'None',
        severity: blocked.length > 0 ? 'warn' : 'ok',
      },
      {
        icon: '✅',
        label: 'Completed',
        value: `${done.length} tasks · ${sprint.completedPoints} story pts`,
        severity: 'ok',
      },
      {
        icon: '🔥',
        label: 'Overloaded',
        value: overloadedMembers.length > 0
          ? overloadedMembers.map((m) => `${m.name.split(' ')[0]} (${m.currentLoad}%)`).join(', ')
          : 'No one at risk',
        severity: overloadedMembers.length > 0 ? 'warn' : 'ok',
      },
      {
        icon: '📅',
        label: 'Days Left',
        value: `${sprint.daysRemaining} days — ${sprint.committedPoints - sprint.completedPoints} pts remaining`,
        severity: sprint.daysRemaining <= 2 ? 'critical' : sprint.daysRemaining <= 4 ? 'warn' : 'ok',
      },
    ],
  }

  // PM Brief
  const pmBrief: BriefingView = {
    type: 'pm',
    label: 'PM Brief',
    summary: `Sprint goal ${sprint.health === 'green' ? 'is on track' : sprint.health === 'yellow' ? 'is at risk' : 'is in jeopardy'}. ${openEsc.length} escalations require decisions. ${blocked.length} tasks blocked.`,
    items: [
      {
        icon: '🎯',
        label: 'Sprint Goal',
        value: sprint.health === 'green'
          ? 'On track — no action needed'
          : sprint.health === 'yellow'
            ? 'At risk — 2 escalations need PM decision within 24h'
            : 'In jeopardy — immediate action required',
        severity: sprint.health === 'green' ? 'ok' : sprint.health === 'yellow' ? 'warn' : 'critical',
      },
      {
        icon: '⚠️',
        label: 'Open Escalations',
        value: openEsc.length > 0
          ? openEsc.map((e) => e.taskTitle.split(':')[0]).join(' · ')
          : 'None',
        severity: openEsc.length >= 3 ? 'critical' : openEsc.length > 0 ? 'warn' : 'ok',
      },
      {
        icon: '🔄',
        label: 'Scope Risk',
        value: tasks.filter((t) => t.decision === 'ESCALATE' && t.status === 'backlog').length > 0
          ? 'Unscoped requests in backlog — need triage decisions'
          : 'Scope stable',
        severity: tasks.filter((t) => t.decision === 'ESCALATE' && t.status === 'backlog').length > 0 ? 'warn' : 'ok',
      },
      {
        icon: '💡',
        label: 'Trade-off',
        value: `Apple Pay request (13 pts) vs sprint goal. Recommend deferring to Sprint 24.`,
        severity: 'warn',
      },
      {
        icon: '📊',
        label: 'Delivery Confidence',
        value: completedPct >= 60 ? `${completedPct}% — high confidence` : `${completedPct}% — needs acceleration`,
        severity: completedPct >= 60 ? 'ok' : completedPct >= 40 ? 'warn' : 'critical',
      },
    ],
  }

  // Manager Brief
  const managerBrief: BriefingView = {
    type: 'manager',
    label: 'Manager Brief',
    summary: `Sprint ${sprint.name} delivery at ${completedPct}% with ${sprint.daysRemaining} days remaining. ${overloadedMembers.length > 0 ? `${overloadedMembers.length} engineer(s) above 85% load.` : 'Team load healthy.'} Key milestone risk: auth compliance task blocked.`,
    items: [
      {
        icon: '🚀',
        label: 'Delivery Confidence',
        value: completedPct >= 55 ? 'HIGH — sprint goal achievable' : completedPct >= 35 ? 'MEDIUM — at risk, needs intervention' : 'LOW — likely spillover',
        severity: completedPct >= 55 ? 'ok' : completedPct >= 35 ? 'warn' : 'critical',
      },
      {
        icon: '📉',
        label: 'Spillover Risk',
        value: blocked.length >= 2
          ? `${blocked.length} tasks likely to spill — auth + promo code blocks unresolved`
          : 'Low spillover risk',
        severity: blocked.length >= 2 ? 'warn' : 'ok',
      },
      {
        icon: '👥',
        label: 'Team Health',
        value: overloadedMembers.length > 0
          ? `${overloadedMembers.map((m) => `${m.name.split(' ')[0]} at ${m.currentLoad}%`).join(', ')}`
          : 'All engineers within healthy load range',
        severity: overloadedMembers.length > 1 ? 'critical' : overloadedMembers.length > 0 ? 'warn' : 'ok',
      },
      {
        icon: '🏁',
        label: 'Milestone Impact',
        value: 'Auth compliance block may delay Q2 payment compliance milestone. Needs legal resolution.',
        severity: 'critical',
      },
      {
        icon: '📈',
        label: 'Velocity Trend',
        value: `Current: ${sprint.velocity} pts/sprint. Target: 65. Trend: flat. Recommend addressing recurring blockers.`,
        severity: sprint.velocity < 50 ? 'warn' : 'ok',
      },
    ],
  }

  return [teamBrief, pmBrief, managerBrief]
}
