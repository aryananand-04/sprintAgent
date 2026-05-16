import type { Task, TriageResult } from '../types'
import { LOAD_MODERATE_THRESHOLD, LOAD_ELIGIBILITY_THRESHOLD } from './constants'

export function computeTriageScore(task: Task): number {
  // Weighted scoring: impact and urgency pull up, effort and risk pull down, clarity is a modifier
  const urgencyMap = { critical: 5, high: 4, medium: 3, low: 1 }
  const urgencyScore = urgencyMap[task.urgency]

  const score =
    urgencyScore * 2.5 +
    task.impact * 2.0 -
    task.effort * 1.2 -
    task.risk * 1.0 +
    task.clarity * 0.8

  return Math.round(Math.min(100, Math.max(0, score * 5)))
}

export function computeTicketQuality(task: Task): number {
  // Based on clarity, description length, tag presence, and dependency definition
  let score = 0
  score += task.clarity * 15 // 0-75
  score += task.description.length > 80 ? 10 : 5
  score += (task.tags?.length ?? 0) > 0 ? 8 : 0
  score += task.storyPoints ? 7 : 0
  return Math.min(100, score)
}

export function computeAssignmentConfidence(
  task: Task,
  memberSkills: string[],
  memberLoad: number,
  hasDependencyConflict: boolean,
): number {
  const taskSkillTokens = [
    task.type,
    ...(task.tags ?? []),
    task.source.toLowerCase(),
  ]

  const skillMatches = taskSkillTokens.filter((token) =>
    memberSkills.some((skill) => token.includes(skill) || skill.includes(token)),
  ).length

  const skillScore = Math.min(skillMatches * 15, 45)
  const loadScore = memberLoad < LOAD_MODERATE_THRESHOLD ? 30 : memberLoad < LOAD_ELIGIBILITY_THRESHOLD ? 20 : 10
  const depPenalty = hasDependencyConflict ? -20 : 0
  const clarityBonus = task.clarity * 2

  return Math.round(Math.min(99, Math.max(10, skillScore + loadScore + depPenalty + clarityBonus + 15)))
}

export function computeSprintRisk(
  completedPct: number,
  openEscalations: number,
  blockedCount: number,
  daysRemaining: number,
  totalCommitted: number,
  completedPoints: number,
): 'green' | 'yellow' | 'red' {
  const remaining = totalCommitted - completedPoints
  const dailyNeeded = daysRemaining > 0 ? remaining / daysRemaining : 999

  if (blockedCount >= 3 || openEscalations >= 3 || dailyNeeded > 15) return 'red'
  if (completedPct < 0.45 || openEscalations >= 2 || blockedCount >= 2 || dailyNeeded > 10) return 'yellow'
  return 'green'
}
