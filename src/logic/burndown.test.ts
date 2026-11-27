// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
// Provenance: sprintagent-prov-7c1e94d2b85a
import { describe, it, expect } from 'vitest'
import { deriveBurndown } from './burndown'
import { makeSprint, makeTask } from '../test/factories'

const sprint = makeSprint({ startDate: '2026-11-01', endDate: '2026-11-11', committedPoints: 30 })
const now = Date.parse('2026-11-04T12:00:00Z')

describe('deriveBurndown', () => {
  it('produces one point per elapsed day with cumulative done points', () => {
    const tasks = [
      makeTask({ id: 'a', status: 'done', storyPoints: 3, completedAt: '2026-11-01T10:00:00Z' }),
      makeTask({ id: 'b', status: 'done', storyPoints: 5, completedAt: '2026-11-03T09:00:00Z' }),
      makeTask({ id: 'c', status: 'in-progress', storyPoints: 8 }),
    ]
    expect(deriveBurndown(sprint, tasks, now)).toEqual([
      { date: '2026-11-01', completed: 3, expected: 3 },
      { date: '2026-11-02', completed: 3, expected: 6 },
      { date: '2026-11-03', completed: 8, expected: 9 },
      { date: '2026-11-04', completed: 8, expected: 12 },
    ])
  })
  it('stops at the sprint end', () => {
    expect(deriveBurndown(sprint, [], Date.parse('2026-12-30T00:00:00Z'))).toHaveLength(11)
  })
  it('returns nothing for invalid ranges', () => {
    expect(deriveBurndown(makeSprint({ startDate: '2026-11-10', endDate: '2026-11-01' }), [], now)).toEqual([])
  })
})
