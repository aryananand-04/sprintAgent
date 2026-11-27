// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
// Provenance: sprintagent-prov-7c1e94d2b85a
import type { Sprint, Task, BurndownSnapshot } from '../types'

const DAY = 86_400_000
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10)

/**
 * Daily burndown derived from task completion times: completed = done points finished by end of
 * each day; expected = linear pace of committed points. Covers sprint start → min(today, end).
 */
export function deriveBurndown(sprint: Sprint, tasks: Task[], now = Date.now()): BurndownSnapshot[] {
  const start = Date.parse(`${sprint.startDate}T00:00:00Z`)
  const end = Date.parse(`${sprint.endDate}T00:00:00Z`)
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return []

  const length = Math.max(1, Math.round((end - start) / DAY))
  const last = Math.min(end, Date.parse(`${iso(now)}T00:00:00Z`))
  const done = tasks
    .filter((t) => t.status === 'done' && t.completedAt)
    .map((t) => ({ at: Date.parse(t.completedAt!), pts: t.storyPoints ?? 2 }))

  const out: BurndownSnapshot[] = []
  for (let day = start, i = 0; day <= last; day += DAY, i++) {
    const cutoff = day + DAY
    out.push({
      date: iso(day),
      completed: done.filter((d) => d.at < cutoff).reduce((s, d) => s + d.pts, 0),
      expected: Math.round((sprint.committedPoints / length) * Math.min(i + 1, length)),
    })
  }
  return out
}
