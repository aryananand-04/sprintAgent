import type { Task, TeamMember } from '../types'
import { computeAssignmentConfidence } from './scoring'
import { LOAD_ELIGIBILITY_THRESHOLD } from './constants'

interface AssignmentResult {
  memberId: string
  memberName: string
  confidence: number
  rationale: string
}

export function findBestAssignee(
  task: Task,
  team: TeamMember[],
  allTasks: Task[],
): AssignmentResult | null {
  if (task.decision === 'ESCALATE') return null

  const eligibleMembers = team.filter((m) => m.currentLoad < LOAD_ELIGIBILITY_THRESHOLD)

  const scored = eligibleMembers.map((member) => {
    const currentTaskCount = allTasks.filter(
      (t) => t.assigneeId === member.id && (t.status === 'in-progress' || t.status === 'assigned'),
    ).length

    const hasDependencyConflict = task.dependencies.some((dep) => {
      const depTask = allTasks.find((t) => t.id === dep)
      return depTask?.assigneeId !== member.id && dep.startsWith('task-')
    })

    const confidence = computeAssignmentConfidence(
      task,
      member.skills,
      member.currentLoad,
      hasDependencyConflict,
    )

    const skillMatches = [task.type, ...(task.tags ?? [])].filter((token) =>
      member.skills.some((s) => token.includes(s) || s.includes(token)),
    )

    return { member, confidence, skillMatches, currentTaskCount, hasDependencyConflict }
  })

  scored.sort((a, b) => b.confidence - a.confidence)

  if (scored.length === 0) return null

  const best = scored[0]
  const rationale = buildRationale(best.member, best.confidence, best.skillMatches, best.currentTaskCount)

  return {
    memberId: best.member.id,
    memberName: best.member.name,
    confidence: best.confidence,
    rationale,
  }
}

function buildRationale(
  member: TeamMember,
  confidence: number,
  skillMatches: string[],
  currentTasks: number,
): string {
  const loadLabel = member.currentLoad < 60 ? 'low' : member.currentLoad < 80 ? 'moderate' : 'high'
  const skills = skillMatches.slice(0, 3).join(', ') || member.skills.slice(0, 2).join(', ')

  return `Assigned to ${member.name} with ${confidence}% confidence. Skill alignment: ${skills}. Current load is ${loadLabel} (${member.currentLoad}%), with ${currentTasks} active task${currentTasks !== 1 ? 's' : ''}. ${member.capacity} story points remaining in sprint.`
}
