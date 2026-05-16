import type { Task, TriageResult, AgentDecision, AutonomyConfig } from '../types'
import { computeTriageScore } from './scoring'

const DEFAULT_CONFIG: AutonomyConfig = {
  actMinClarity: 3,
  askMaxClarity: 2,
  escalateIfCriticalUnassignedHours: 1,
  neverAutoAssignTypes: [],
  capacityBreachThreshold: 90,
  blockedHoursThreshold: 2,
  escNudgeHours: 4,
  velocityDeficitPts: 6,
}

function decideAutonomy(task: Task, config: AutonomyConfig = DEFAULT_CONFIG): AgentDecision {
  // ESCALATE conditions — agent must defer
  if (task.clarity <= 1) return 'ESCALATE'
  if (task.risk >= 5 && task.effort >= 4) return 'ESCALATE'
  if (task.dependencies.some((d) => !d.startsWith('task-'))) return 'ESCALATE'
  if (task.type === 'urgent' && task.effort >= 5) return 'ESCALATE'

  // ASK conditions — uses PM-configured threshold
  if (task.clarity <= config.askMaxClarity) return 'ASK'
  if (task.effort >= 4 && task.clarity < config.actMinClarity) return 'ASK'
  if (task.type === 'spike' && task.clarity <= config.askMaxClarity) return 'ASK'

  // Never auto-assign types
  if (config.neverAutoAssignTypes.includes(task.type)) return 'ASK'

  // ACT — clarity meets PM-configured minimum
  if (task.clarity >= config.actMinClarity) return 'ACT'

  return 'ASK'
}

function buildReason(task: Task, decision: AgentDecision): string {
  switch (decision) {
    case 'ESCALATE':
      if (task.clarity <= 1)
        return `Requirements clarity score is critically low (${task.clarity}/5). Cannot safely scope or assign without human input — risk of wasted effort or wrong solution.`
      if (task.risk >= 5)
        return `Maximum risk score (${task.risk}/5) combined with high effort (${task.effort}/5). Cross-functional impact requires PM and engineering lead sign-off.`
      if (task.dependencies.some((d) => !d.startsWith('task-')))
        return `External dependency detected (${task.dependencies.filter((d) => !d.startsWith('task-')).join(', ')}). Cannot resolve autonomously — human stakeholder action required.`
      return `Scope-breaking or high-ambiguity conditions detected. Agent cannot resolve without human judgment.`

    case 'ASK':
      if (task.clarity <= 2)
        return `Requirements clarity is low (${task.clarity}/5). Agent needs acceptance criteria before assigning or scheduling this work.`
      if (task.effort >= 4 && task.clarity <= 3)
        return `High-effort task (${task.effort}/5) with incomplete requirements (clarity: ${task.clarity}/5). Scoping risk is high without clarification.`
      return `Missing information prevents confident autonomous action. Requesting clarification to reduce assignment risk.`

    case 'ACT':
      return `Clear requirements (clarity: ${task.clarity}/5), manageable risk (${task.risk}/5), and known skill domain. Agent can autonomously assign and schedule.`
  }
}

export function triageTask(task: Task, config?: AutonomyConfig): TriageResult {
  const decision = decideAutonomy(task, config)
  const score = computeTriageScore(task)
  const reason = buildReason(task, decision)

  const urgencyMap = { critical: 5, high: 4, medium: 3, low: 1 }

  return {
    decision,
    score,
    reason,
    dimensions: {
      urgency: urgencyMap[task.urgency],
      impact: task.impact,
      effort: task.effort,
      risk: task.risk,
      clarity: task.clarity,
    },
  }
}
