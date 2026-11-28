// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
// Provenance: sprintagent-prov-7c1e94d2b85a
import type { Task, UrgencyLevel } from '../types'
import { trackerTask } from './trackerTask'

/** The Linear issue fields we read (GraphQL and webhook payloads share these names). */
export interface LinearIssue {
  id: string
  identifier: string
  title: string
  description?: string | null
  url: string
  /** 0 none, 1 urgent, 2 high, 3 medium, 4 low. */
  priority?: number | null
  createdAt: string
  state?: { type?: string | null } | null
  team?: { key?: string | null } | null
  labels?: { nodes?: Array<{ name: string }> } | Array<{ name: string }> | null
}

export const LINEAR_PRIORITY: Record<number, UrgencyLevel> = { 1: 'critical', 2: 'high', 3: 'medium', 4: 'low' }

/** Completed and canceled issues count as done; everything else (triage, backlog, unstarted, started) is open. */
export const isLinearClosed = (i: Pick<LinearIssue, 'state'>) => i.state?.type === 'completed' || i.state?.type === 'canceled'

const labelNames = (i: LinearIssue) => (Array.isArray(i.labels) ? i.labels : i.labels?.nodes ?? []).map((l) => l.name).filter(Boolean)

/** A Linear issue as a triaged task. Linear's priority wins over text and labels; "no priority" doesn't. */
export function linearIssueToTask(i: LinearIssue, id: string): Task {
  return trackerTask({
    id, key: i.identifier, title: i.title, body: i.description ?? '', url: linearRef(i.url) ?? i.url,
    source: `Linear / ${i.team?.key ?? i.identifier.split('-')[0]}`, labels: labelNames(i), createdAt: i.createdAt,
    closed: isLinearClosed(i), urgency: i.priority ? LINEAR_PRIORITY[i.priority] ?? null : null,
  })
}

const LINEAR_URL = /^https:\/\/linear\.app\/([\w-]+)\/issue\/([A-Z0-9]+-\d+)/

/**
 * The stable reference we store for a Linear issue: its URL without the title slug, which changes
 * whenever someone renames the issue. Null for anything that isn't a Linear issue URL.
 */
export function linearRef(url: string | null | undefined): string | null {
  const m = url?.match(LINEAR_URL)
  return m ? `https://linear.app/${m[1]}/issue/${m[2]}` : null
}

/** The issue identifier (ENG-12) from a stored reference; Linear's API accepts it in place of the id. */
export const linearIdentifier = (ref: string | null | undefined) => ref?.match(LINEAR_URL)?.[2] ?? null
