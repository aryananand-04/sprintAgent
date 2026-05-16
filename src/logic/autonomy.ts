import type { AutonomyRule } from '../types'

export const AUTONOMY_RULES: AutonomyRule[] = [
  // ACT rules
  {
    id: 'act-1',
    category: 'ACT',
    condition: 'Task clarity ≥ 4 AND risk ≤ 3 AND effort ≤ 4',
    rationale: 'Well-specified, manageable risk. Agent can assign and schedule without consulting humans.',
    examples: ['Bug with reproduction steps', 'Feature with approved Figma spec', 'Standard QA task'],
  },
  {
    id: 'act-2',
    category: 'ACT',
    condition: 'Urgent bug with Sentry data AND clear reproduction path',
    rationale: 'Production issues with data support direct action. Waiting costs users more than any assignment error.',
    examples: ['iOS crash with Sentry stacktrace', 'Payment failure with transaction IDs', 'API timeout with P99 data'],
  },
  {
    id: 'act-3',
    category: 'ACT',
    condition: 'Research spike with defined output format AND ≤ 2 days effort',
    rationale: 'Time-boxed spikes have reversible outcomes. Agent can assign based on domain expertise.',
    examples: ['Tech comparison spike', 'API evaluation', 'Performance audit'],
  },
  {
    id: 'act-4',
    category: 'ACT',
    condition: 'Task is a polished, low-risk ad-hoc request that fits within remaining sprint capacity',
    rationale: 'Absorbing a low-effort task is cheaper than the overhead of escalation and re-planning.',
    examples: ['Minor copy fix', 'CSS responsive bug', 'Analytics event addition'],
  },

  // ASK rules
  {
    id: 'ask-1',
    category: 'ASK',
    condition: 'Clarity ≤ 2 OR no acceptance criteria defined',
    rationale: 'Ambiguous tasks cost more to fix than to clarify upfront. Agent pauses and requests the missing spec.',
    examples: ['Vague stakeholder ask', 'Feature with no definition of done', 'Task with contradictory requirements'],
  },
  {
    id: 'ask-2',
    category: 'ASK',
    condition: 'High effort task (≥ 4 pts) with clarity score ≤ 3',
    rationale: 'Large ambiguous tasks are sprint-goal risks. Better to spend 30 min clarifying than 3 days building the wrong thing.',
    examples: ['Major refactor with vague scope', 'New feature flow without UX spec', 'Infrastructure change without arch doc'],
  },
  {
    id: 'ask-3',
    category: 'ASK',
    condition: 'Task would push assignee over 90% load without re-prioritization',
    rationale: 'Overloaded engineers produce lower quality work. Agent asks PM to choose: what gets deprioritized?',
    examples: ['Adding to engineer already on 3 in-progress tasks', 'Critical path engineer asked to take on urgent ad-hoc'],
  },

  // ESCALATE rules
  {
    id: 'esc-1',
    category: 'ESCALATE',
    condition: 'Clarity = 1 (no requirements exist)',
    rationale: 'No spec means no safe starting point. Proceeding without clarity risks shipping the wrong thing or breaking adjacent systems.',
    examples: ['Stakeholder Slack ask with no follow-up', 'Verbal request with no ticket', 'Vague legal compliance requirement'],
  },
  {
    id: 'esc-2',
    category: 'ESCALATE',
    condition: 'Risk ≥ 5 AND effort ≥ 4 (high-stakes, high-effort)',
    rationale: 'This combination signals sprint-goal risk. The cost of a wrong decision exceeds the cost of escalation delay.',
    examples: ['Auth system redesign', 'Database migration with data loss risk', 'Payment provider switch'],
  },
  {
    id: 'esc-3',
    category: 'ESCALATE',
    condition: 'External dependency is unresolved (legal, design, external team)',
    rationale: 'Agent cannot unblock external stakeholders. Escalating ensures a human with the right authority takes ownership.',
    examples: ['Legal sign-off required', 'Design approval pending', 'Cross-team API contract needed'],
  },
  {
    id: 'esc-4',
    category: 'ESCALATE',
    condition: 'Scope-breaking request mid-sprint (adds > 5 pts to committed scope)',
    rationale: 'Sprint goals are commitments. Scope additions are trade-offs that require explicit PM and team acknowledgment.',
    examples: ['New feature from VP mid-sprint', 'Stakeholder asks for "small" scope expansion', 'Emergency feature request'],
  },
  {
    id: 'esc-5',
    category: 'ESCALATE',
    condition: 'Contradictory signals from multiple stakeholders',
    rationale: 'Agent cannot arbitrate authority conflicts. A human decision-maker must align stakeholders before work can begin.',
    examples: ['Two stakeholders disagree on feature behavior', 'Spec contradicts a Slack discussion', 'PM and Eng Lead have different priorities'],
  },
]
