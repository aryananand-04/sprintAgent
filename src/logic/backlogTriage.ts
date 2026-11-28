// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
// Provenance: sprintagent-prov-7c1e94d2b85a
import type { AgentDecision, EscalationItem, Task, TeamMember } from '../types'
import { findBestAssignee } from './assign'
import { computeLoadsFromTasks } from './load'

/** Backlog work nobody (person, rules or model) has triaged yet. */
export const needsTriage = (t: Task) => (t.status === 'backlog' || t.status === 'triaged') && !t.decision

export interface TriageOutcome { decision: AgentDecision; reason: string; score: number }

export interface TriageStep {
  taskId: string
  outcome: TriageOutcome
  /** ACT with nobody on it: who gets it. */
  assign?: { memberId: string; confidence: number; rationale: string }
  /** ESCALATE: what goes to the PM. */
  escalation?: { category: EscalationItem['category']; recommendation: string }
}

const RECOMMENDATION = 'Review the triage and either clarify the ticket or approve it.'

/**
 * Turns triage outcomes into the steps that follow them, in order. Each ACT assignment counts
 * towards the next one's load, so one quiet teammate doesn't receive the whole backlog. Pure.
 */
export function planTriageSteps(outcomes: Array<{ task: Task; outcome: TriageOutcome }>, tasks: Task[], team: TeamMember[]): TriageStep[] {
  let board = tasks
  return outcomes.map(({ task, outcome }) => {
    const step: TriageStep = { taskId: task.id, outcome }
    if (outcome.decision === 'ESCALATE') {
      const category = task.clarity <= 1 ? 'missing-criteria' : task.risk >= 5 ? 'blocker' : 'ambiguous'
      step.escalation = { category, recommendation: RECOMMENDATION }
    } else if (outcome.decision === 'ACT' && !task.assigneeId) {
      const best = findBestAssignee({ ...task, decision: 'ACT' }, computeLoadsFromTasks(board, team), board)
      if (best) {
        step.assign = { memberId: best.memberId, confidence: best.confidence, rationale: best.rationale }
        board = board.map((t) => (t.id === task.id ? { ...t, assigneeId: best.memberId, status: 'assigned' } : t))
      }
    }
    return step
  })
}

/** The feed line after a batch, e.g. "Triaged 3 new tickets: 2 ACT, 1 ASK." */
export function triageSummary(steps: TriageStep[]): string | null {
  if (!steps.length) return null
  const n = (d: AgentDecision) => steps.filter((s) => s.outcome.decision === d).length
  const parts = (['ACT', 'ASK', 'ESCALATE'] as const).filter((d) => n(d)).map((d) => `${n(d)} ${d}`)
  return `Triaged ${steps.length} new ticket${steps.length === 1 ? '' : 's'}: ${parts.join(', ')}.`
}
