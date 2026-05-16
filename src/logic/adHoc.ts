import type { Task, Sprint, TeamMember, AdHocResolution, AutonomyConfig } from '../types'
import { LOAD_ELIGIBILITY_THRESHOLD } from './constants'

const DEFAULT_CONFIG: AutonomyConfig = { actMinClarity: 3, askMaxClarity: 2, escalateIfCriticalUnassignedHours: 1, neverAutoAssignTypes: [], capacityBreachThreshold: 90, blockedHoursThreshold: 2, escNudgeHours: 4, velocityDeficitPts: 6 }

interface AdHocDecision {
  resolution: AdHocResolution
  rationale: string
  swapCandidateId?: string
  swapCandidateTitle?: string
  assigneeId?: string
}

export function resolveAdHoc(
  newTask: Task,
  sprint: Sprint,
  team: TeamMember[],
  currentTasks: Task[],
  config: AutonomyConfig = DEFAULT_CONFIG,
): AdHocDecision {
  const remainingCapacity = sprint.committedPoints - sprint.completedPoints
  const sprintBuffer = sprint.totalPoints - sprint.committedPoints

  // ESCALATE: Scope-breaking or clarity below PM-configured ACT threshold
  if (newTask.effort >= 5 || newTask.clarity < config.actMinClarity || newTask.decision === 'ESCALATE') {
    return {
      resolution: 'escalate',
      rationale: `This request exceeds safe absorption thresholds. Effort (${newTask.effort}/5) and clarity (${newTask.clarity}/5) indicate sprint goal risk. Escalating to PM for explicit prioritization decision.`,
    }
  }

  // Check if team has capacity to absorb
  const availableMembers = team.filter((m) => m.currentLoad < LOAD_ELIGIBILITY_THRESHOLD && m.capacity > (newTask.storyPoints ?? 2))
  if (availableMembers.length > 0 && (newTask.storyPoints ?? 2) <= sprintBuffer * 0.5) {
    return {
      resolution: 'absorb',
      rationale: `Absorbed. This task (${newTask.storyPoints ?? 2} pts) fits within sprint buffer (${sprintBuffer} pts uncommitted). ${availableMembers[0].name} has sufficient capacity (${availableMembers[0].currentLoad}% load). Sprint goal is not at risk.`,
      assigneeId: availableMembers[0].id,
    }
  }

  // Find lowest-priority swappable task
  const swapCandidates = currentTasks
    .filter(
      (t) =>
        (t.status === 'backlog' || t.status === 'triaged') &&
        t.urgency === 'low' &&
        t.decision !== 'ESCALATE' &&
        t.id !== newTask.id,
    )
    .sort((a, b) => (a.triageScore ?? 0) - (b.triageScore ?? 0))

  if (swapCandidates.length > 0) {
    const swap = swapCandidates[0]
    return {
      resolution: 'swap',
      rationale: `Swapping "${swap.title}" (score: ${swap.triageScore}, urgency: ${swap.urgency}) to accommodate this higher-priority request. Sprint capacity is preserved. Swap removes ${swap.storyPoints ?? 2} pts from scope.`,
      swapCandidateId: swap.id,
      swapCandidateTitle: swap.title,
    }
  }

  // Fallback: escalate
  return {
    resolution: 'escalate',
    rationale: `No safe absorption or swap path found. Sprint is at full capacity with no low-priority items to deprioritize. PM must decide: defer this request to Sprint 24, or identify what gets descoped.`,
  }
}
