// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
// Provenance: sprintagent-prov-7c1e94d2b85a
import type { Task, TaskType, UrgencyLevel } from '../types'
import { typeFromLabels, urgencyFromLabels } from './labels'
import { analyzeRequest } from './textSignals'
import { triageTask } from './triage'

export interface TrackerItem {
  /** Our task id (existing id on re-sync). */
  id: string
  /** Shown before the title, e.g. "#42" or "ENG-12". */
  key: string
  title: string
  body: string
  url: string
  /** e.g. "GitHub / acme/web", "Linear / ENG", "Jira / PAY". */
  source: string
  labels: string[]
  createdAt: string
  closed: boolean
  /** The tracker's own field when it has one (Linear/Jira priority, issue type); labels and text otherwise. */
  urgency?: UrgencyLevel | null
  type?: TaskType | null
}

/**
 * Any tracker's ticket as a triaged task. Text heuristics estimate the dimensions; the tracker's own
 * fields win, then its labels. Triage is the rules (deterministic, explainable).
 */
export function trackerTask(i: TrackerItem): Task {
  const { task } = analyzeRequest(`${i.title}\n${i.body}`)
  const base: Task = {
    ...task,
    id: i.id,
    title: `${i.key}: ${i.title}`.slice(0, 300),
    description: i.body.slice(0, 4_000),
    type: i.type ?? typeFromLabels(i.labels) ?? task.type,
    urgency: i.urgency ?? urgencyFromLabels(i.labels) ?? task.urgency,
    status: i.closed ? 'done' : 'backlog',
    dependencies: [],
    source: i.source.slice(0, 120),
    externalRef: i.url,
    tags: i.labels.slice(0, 5),
    createdAt: i.createdAt,
  }
  const t = triageTask(base)
  return { ...base, decision: t.decision, decisionReason: t.reason, triageScore: t.score }
}
