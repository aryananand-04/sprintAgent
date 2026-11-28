// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
// Provenance: sprintagent-prov-7c1e94d2b85a
import type { AgentDecision, AutonomyConfig, Task, TaskType, UrgencyLevel } from '../types'
import { analyzeRequest, answerClarityGain } from './textSignals'
import { triageTask } from './triage'

/** The fields we read from GitHub's issue payloads. */
export interface GhIssue {
  number: number
  title: string
  body: string | null
  html_url: string
  state: 'open' | 'closed'
  labels: Array<{ name?: string } | string>
  created_at: string
  pull_request?: unknown
}

/** Next page from a GitHub `Link` header, or null on the last page. */
export function nextPageUrl(link: string | null): string | null {
  const m = link?.split(',').map((p) => p.trim()).find((p) => /rel="next"/.test(p))?.match(/<([^>]+)>/)
  return m ? m[1] : null
}

const labelNames = (i: GhIssue) => i.labels.map((l) => (typeof l === 'string' ? l : l.name ?? '')).filter(Boolean)

function typeFromLabels(labels: string[]): TaskType | null {
  if (labels.some((l) => /bug|error|regression/i.test(l))) return 'bug'
  if (labels.some((l) => /design|ux|ui\b/i.test(l))) return 'design'
  if (labels.some((l) => /spike|research|investigat/i.test(l))) return 'spike'
  if (labels.some((l) => /chore|maintenance|refactor|dependenc/i.test(l))) return 'chore'
  if (labels.some((l) => /feature|enhancement/i.test(l))) return 'feature'
  return null
}

function urgencyFromLabels(labels: string[]): UrgencyLevel | null {
  if (labels.some((l) => /critical|p0|sev ?1|blocker|urgent/i.test(l))) return 'critical'
  if (labels.some((l) => /high|p1|important/i.test(l))) return 'high'
  if (labels.some((l) => /low|p3|nice.to.have|good first issue/i.test(l))) return 'low'
  return null
}

/**
 * Turns a GitHub issue into a triaged task. Text heuristics estimate the dimensions; the repo's own
 * labels win for type and urgency. `id` is supplied by the caller (existing task id on re-sync).
 */
export function issueToTask(issue: GhIssue, repoFullName: string, id: string): Task {
  const labels = labelNames(issue)
  const { task } = analyzeRequest(`${issue.title}\n${issue.body ?? ''}`)
  const base: Task = {
    ...task,
    id,
    title: `#${issue.number}: ${issue.title}`.slice(0, 300),
    description: (issue.body ?? '').slice(0, 4_000),
    type: typeFromLabels(labels) ?? task.type,
    urgency: urgencyFromLabels(labels) ?? task.urgency,
    status: issue.state === 'closed' ? 'done' : 'backlog',
    dependencies: [],
    source: `GitHub / ${repoFullName}`,
    externalRef: issue.html_url,
    tags: labels.slice(0, 5),
    createdAt: issue.created_at,
  }
  const t = triageTask(base)
  return { ...base, decision: t.decision, decisionReason: t.reason, triageScore: t.score }
}

export const isPullRequest = (i: GhIssue) => i.pull_request !== undefined

/** owner/repo/number from an issue URL we stored as external_ref; null for anything else. */
export function parseIssueUrl(url: string | undefined | null): { owner: string; repo: string; number: number } | null {
  const m = url?.match(/^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/issues\/(\d+)$/)
  return m ? { owner: m[1], repo: m[2], number: Number(m[3]) } : null
}

export const DECISION_LABELS = {
  ACT: { name: 'sprint-agent: ACT', color: 'd7ea3a', description: 'Clear enough to pick up' },
  ASK: { name: 'sprint-agent: ASK', color: 'ff9a3c', description: 'Needs one answer before work starts' },
  ESCALATE: { name: 'sprint-agent: ESCALATE', color: 'ff6b57', description: 'Needs a human decision' },
} as const

/** Marker in our own comments, so the answer handler never treats the agent's question as an answer. */
const ASK_FOOTER = 'Asked by Sprint Agent while triaging this issue.'

/** The comment posted on an ASK issue. Plain, specific, and says who is asking. */
export function askComment(question: string): string {
  return `${question}\n\n<sub>${ASK_FOOTER} An answer here helps whoever picks it up.</sub>`
}

export interface GhComment {
  id: number
  body: string | null
  user: { login: string; type: string } | null
  performed_via_github_app?: unknown
}

/** A comment a person wrote (not a bot, not an app, not our own question, not empty). */
export function isHumanAnswer(c: GhComment): boolean {
  const body = c.body?.trim() ?? ''
  return !!c.user && c.user.type === 'User' && !c.performed_via_github_app && body.length > 0 && !body.includes(ASK_FOOTER)
}

export interface Retriage { clarity: number; decision: AgentDecision; reason: string; score: number }

/**
 * Re-triages a task after someone answered on its issue. The answer can only add clarity (a reply
 * never makes the request vaguer); everything else stays as triaged. Null when nothing changes.
 */
export function retriageWithAnswer(task: Task, answer: string, config?: AutonomyConfig): Retriage | null {
  const clarity = Math.min(5, task.clarity + answerClarityGain(answer))
  const t = triageTask({ ...task, clarity }, config)
  if (clarity === task.clarity && t.decision === task.decision) return null
  return { clarity, decision: t.decision, reason: t.reason, score: t.score }
}
