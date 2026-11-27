// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { analyzeRequest, askQuestion } from '@/logic/textSignals'
import { triageTask } from '@/logic/triage'
import type { AgentDecision, Task } from '@/types'

export interface GhIssue {
  number: number
  title: string
  body: string | null
  html_url: string
  labels: Array<{ name: string } | string>
  pull_request?: unknown
}

export interface TriagedIssue {
  number: number
  title: string
  url: string
  decision: AgentDecision
  score: number
  reason: string
  question: string | null
}

/** Same pipeline as the product's fallback: text → explainable dimensions → rule engine. */
export function triageIssues(issues: GhIssue[]): TriagedIssue[] {
  return issues
    .filter((i) => !i.pull_request)
    .map((i) => {
      const labels = i.labels.map((l) => (typeof l === 'string' ? l : l.name)).join(', ')
      const text = `${i.title}. ${(i.body ?? '').slice(0, 1500)}${labels ? ` Labels: ${labels}.` : ''}`
      const { task } = analyzeRequest(text)
      const full: Task = { ...task, title: i.title, id: `gh-${i.number}`, status: 'backlog', dependencies: [], source: 'GitHub', createdAt: new Date(0).toISOString() }
      const r = triageTask(full)
      return {
        number: i.number, title: i.title, url: i.html_url, decision: r.decision, score: r.score, reason: r.reason,
        question: r.decision === 'ACT' ? null : askQuestion(task),
      }
    })
    .sort((a, b) => b.score - a.score)
}

export function summarize(list: TriagedIssue[]): string {
  if (!list.length) return 'Zero open issues. Either you are extremely good, or they live somewhere else.'
  const act = list.filter((i) => i.decision === 'ACT').length / list.length
  const esc = list.filter((i) => i.decision === 'ESCALATE').length / list.length
  if (act >= 0.6) return 'This backlog is in great shape. The agent could start assigning work this afternoon.'
  if (esc >= 0.4) return 'A lot of this needs a human decision before it needs code. Good news: now you know which ones.'
  return 'Most of this needs one good question before anyone writes code. That is normal, and very fixable.'
}
