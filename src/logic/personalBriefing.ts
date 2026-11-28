// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
// Provenance: sprintagent-prov-7c1e94d2b85a
import type { Sprint, Task } from '../types'
import { slackEscape } from './slack'

export interface BriefingInput {
  name: string
  sprint: Pick<Sprint, 'name' | 'daysRemaining'>
  /** Everything assigned to this person. */
  assigned: Task[]
  /** Their own requests that are waiting on an answer from them (ASK), with the agent's question. */
  waitingOnThem: Array<{ task: Task; question: string }>
  /** Open escalations, for PMs and admins only (0 otherwise). */
  openEscalations: number
}

const MAX_ITEMS = 5
const line = (t: Task) => `• ${slackEscape(t.title.length > 90 ? `${t.title.slice(0, 89)}…` : t.title)}`

function section(title: string, tasks: Task[]): string[] {
  if (!tasks.length) return []
  const more = tasks.length > MAX_ITEMS ? [`• and ${tasks.length - MAX_ITEMS} more`] : []
  return [`*${title}*`, ...tasks.slice(0, MAX_ITEMS).map(line), ...more]
}

/**
 * One person's morning DM: their own work, the answers only they can give, and (for PMs) decisions
 * waiting. Null when there's nothing for them, because an empty briefing is just a notification.
 */
export function personalBriefing(b: BriefingInput): string | null {
  const by = (s: Task['status']) => b.assigned.filter((t) => t.status === s)
  const blocked = by('blocked'), doing = by('in-progress'), next = by('assigned')
  const body = [
    ...section('Blocked', blocked),
    ...section('In progress', doing),
    ...section('Up next', next),
    ...(b.waitingOnThem.length ? ['*Waiting on your answer*', ...b.waitingOnThem.slice(0, MAX_ITEMS).map((w) => `${line(w.task)}: ${slackEscape(w.question)}`)] : []),
    ...(b.openEscalations ? [`*${b.openEscalations} escalation${b.openEscalations === 1 ? '' : 's'} need${b.openEscalations === 1 ? 's' : ''} a decision.*`] : []),
  ]
  if (!body.length) return null
  const days = `${b.sprint.daysRemaining} day${b.sprint.daysRemaining === 1 ? '' : 's'} left`
  return [`Morning, ${slackEscape(b.name.split(' ')[0])}. ${slackEscape(b.sprint.name)}, ${days}.`, '', ...body, '', '_You get this because your workspace turned on daily DMs. No reply needed._'].join('\n')
}
