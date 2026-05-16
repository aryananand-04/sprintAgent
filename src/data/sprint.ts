import type { Sprint, EscalationItem, FeedEvent } from '../types'
import { INITIAL_TASKS } from './tasks'

export const SPRINT: Sprint = {
  id: 'sprint-23',
  name: 'Sprint 23',
  goal: 'Ship redesigned checkout flow with flexible payment methods and promo code support',
  startDate: '2026-05-05',
  endDate: '2026-05-20',
  totalPoints: 89,
  completedPoints: 34,
  committedPoints: 68,
  health: 'yellow',
  // Computed dynamically from endDate in the store on every load
  daysRemaining: Math.max(0, Math.ceil((new Date('2026-05-20').getTime() - Date.now()) / 86_400_000)),
  velocity: 51,
}

export const INITIAL_ESCALATIONS: EscalationItem[] = [
  {
    id: 'esc-1',
    taskId: 'task-2',
    taskTitle: 'Auth: Redesign session token storage',
    reason: 'Missing acceptance criteria and no clear owner for the compliance sign-off. Cannot autonomously scope or assign.',
    recommendation: 'PM should clarify compliance requirements with legal before this enters the sprint. Suggest pausing and scheduling a 30-min scoping call.',
    urgency: 'high',
    category: 'missing-criteria',
    createdAt: new Date(Date.now() - 42 * 60000).toISOString(),
    resolved: false,
  },
  {
    id: 'esc-3',
    taskId: 'task-11',
    taskTitle: 'Promo code: edge case with stacked discounts',
    reason: 'Ambiguous requirements — product spec says "no stacking" but Slack thread from 2 weeks ago suggests VP of Growth wants it. Contradictory signals.',
    recommendation: 'Requires PM to arbitrate. Blocking Vikram Bose\'s current work. Recommend decision within 4 hours to prevent sprint goal risk.',
    urgency: 'high',
    category: 'ambiguous',
    createdAt: new Date(Date.now() - 7 * 60000).toISOString(),
    resolved: false,
  },
]

export const INITIAL_FEED: FeedEvent[] = [
  {
    id: 'feed-1',
    timestamp: new Date(Date.now() - 95 * 60000).toISOString(),
    type: 'triage',
    message: 'I processed 4 backlog items on sprint start. Autonomously handled 2 (ACT), flagged 1 for clarification (ASK), and escalated 1 beyond my authority threshold.',
    decision: 'ACT',
  },
  {
    id: 'feed-2',
    timestamp: new Date(Date.now() - 88 * 60000).toISOString(),
    type: 'assign',
    message: 'I assigned "Checkout: Payment fails on iOS" to Arjun Nair. Confidence: 84%. Backend/API skill match, 32% load — best available fit for a payment systems bug.',
    taskId: 'task-1',
    memberId: 'arjun',
    decision: 'ACT',
  },
  {
    id: 'feed-3',
    timestamp: new Date(Date.now() - 72 * 60000).toISOString(),
    type: 'assign',
    message: 'I assigned "Promo code UI validation" to Vikram Bose. Confidence: 76%. He has tool-calling and TypeScript skill alignment, available capacity at 38% load.',
    taskId: 'task-11',
    memberId: 'vikram',
    decision: 'ACT',
  },
  {
    id: 'feed-4',
    timestamp: new Date(Date.now() - 55 * 60000).toISOString(),
    type: 'escalate',
    message: 'I cannot proceed with "Auth redesign" — clarity score is 1/5 and there are no acceptance criteria. Blocking question: What does compliance sign-off require, and who is the authority to grant it? Escalating to PM.',
    taskId: 'task-2',
    decision: 'ESCALATE',
  },
  {
    id: 'feed-5',
    timestamp: new Date(Date.now() - 42 * 60000).toISOString(),
    type: 'risk',
    message: 'Sprint health downgraded to AT RISK. Velocity is behind expected pace — 34/68 pts with 4 days remaining. Recommend reviewing low-priority backlog items for deferral.',
    decision: 'ESCALATE',
  },
  {
    id: 'feed-6',
    timestamp: new Date(Date.now() - 30 * 60000).toISOString(),
    type: 'intake',
    message: 'Stakeholder request received: Apple Pay in checkout. I assessed this as scope-breaking — it touches 3 teams and estimates to 8+ days, well beyond the sprint boundary. I am not proceeding autonomously. This requires PM + engineering lead decision before I can act.',
    taskId: 'task-8',
    decision: 'ESCALATE',
  },
  {
    id: 'feed-6b',
    timestamp: new Date(Date.now() - 22 * 60000).toISOString(),
    type: 'resolve',
    message: 'PM resolved escalation: "Add Apple Pay support" deferred to Sprint 24. Requires payment provider selection spike and product spec before implementation. I am closing this escalation and will not re-trigger it this sprint.',
    taskId: 'task-8',
    decision: 'ACT',
  },
  {
    id: 'feed-7',
    timestamp: new Date(Date.now() - 18 * 60000).toISOString(),
    type: 'assign',
    message: 'I assigned "Checkout regression test suite" to Lakshmi Subramaniam. Confidence: 91%. Perfect QA skill match — testing, automation, cypress — lowest load on team at 20%.',
    taskId: 'task-9',
    memberId: 'lakshmi',
    decision: 'ACT',
  },
  {
    id: 'feed-8',
    timestamp: new Date(Date.now() - 7 * 60000).toISOString(),
    type: 'escalate',
    message: 'I detected a spec conflict on promo stacking: the requirements doc says max 2 promos, the VP Growth Slack thread implies unlimited stacking. I cannot resolve this ambiguity autonomously. Vikram Bose is blocked. Blocking question: Which spec is authoritative — the PRD or the Slack thread? Decision needed within 4h to protect sprint velocity.',
    taskId: 'task-11',
    decision: 'ESCALATE',
  },
  {
    id: 'feed-9',
    timestamp: new Date(Date.now() - 2 * 60000).toISOString(),
    type: 'status',
    message: 'Sprint progress: 34/68 committed pts done. 5 days remaining. 3 open escalations require PM attention.',
    decision: 'ASK',
  },
]

// Pre-seeded sprint history so velocity chart shows on first load
export const INITIAL_SPRINT_HISTORY = [
  {
    id: 'archive-sprint-20',
    name: 'Sprint 20',
    goal: 'Redesign onboarding flow and reduce drop-off rate by 15%',
    completedPoints: 48,
    committedPoints: 60,
    velocity: 48,
    health: 'yellow' as const,
    endDate: new Date(Date.now() - 42 * 24 * 60 * 60 * 1000).toISOString(),
    taskCount: 14,
    doneCount: 11,
    escalationCount: 2,
  },
  {
    id: 'archive-sprint-21',
    name: 'Sprint 21',
    goal: 'Launch promo code system and A/B test checkout layout variants',
    completedPoints: 57,
    committedPoints: 65,
    velocity: 57,
    health: 'green' as const,
    endDate: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString(),
    taskCount: 16,
    doneCount: 14,
    escalationCount: 1,
  },
  {
    id: 'archive-sprint-22',
    name: 'Sprint 22',
    goal: 'Payment method reliability — Apple Pay spike and mobile regression fixes',
    startDate: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    completedPoints: 34,
    committedPoints: 68,
    velocity: 51,
    health: 'yellow' as const,
    endDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    taskCount: 18,
    doneCount: 13,
    escalationCount: 2,
    snapshot: {
      tasks: INITIAL_TASKS,
      escalations: [],
      burndownSnapshots: [],
      sprint: {
        id: 'sprint-22',
        name: 'Sprint 22',
        goal: 'Payment method reliability — Apple Pay spike and mobile regression fixes',
        startDate: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        endDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        totalPoints: 88,
        committedPoints: 68,
        completedPoints: 34,
        health: 'yellow' as const,
        daysRemaining: 0,
        velocity: 51,
      },
    },
  },
]

// Burndown derived from actual done task completion timestamps (createdAt as proxy).
// Sprint: May 5–20 (15 days), 68 committed pts. Expected = linear pace.
// Done tasks: task-done-5 (2pts, 168h ago), task-done-4 (3pts, 144h ago),
//             task-done-3 (5pts, 120h ago), task-done-2 (3pts, 96h ago),
//             task-done-1 (5pts, 72h ago) = 18 pts total.
function daysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

export const INITIAL_BURNDOWN: Array<{ date: string; completed: number; expected: number }> = [
  { date: daysAgo(11), completed: 0,  expected: 0  },
  { date: daysAgo(10), completed: 0,  expected: 5  },
  { date: daysAgo(9),  completed: 0,  expected: 9  },
  { date: daysAgo(8),  completed: 0,  expected: 14 },
  { date: daysAgo(7),  completed: 2,  expected: 18 },
  { date: daysAgo(6),  completed: 5,  expected: 23 },
  { date: daysAgo(5),  completed: 10, expected: 27 },
  { date: daysAgo(4),  completed: 13, expected: 32 },
  { date: daysAgo(3),  completed: 18, expected: 36 },
  { date: daysAgo(2),  completed: 18, expected: 41 },
  { date: daysAgo(1),  completed: 18, expected: 45 },
  { date: daysAgo(0),  completed: 34, expected: 50 },
]
