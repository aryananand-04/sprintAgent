// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
// Provenance: sprintagent-prov-7c1e94d2b85a
import { describe, it, expect } from 'vitest'
import { computeLoadsFromTasks } from './load'
import { makeTask, makeMember } from '../test/factories'

describe('computeLoadsFromTasks', () => {
  it('counts only active work against capacity, on top of the baseline', () => {
    const m = makeMember({ id: 'a', capacity: 10 })
    const tasks = [
      makeTask({ id: '1', assigneeId: 'a', status: 'in-progress', storyPoints: 5 }),
      makeTask({ id: '2', assigneeId: 'a', status: 'done', storyPoints: 8 }),
      makeTask({ id: '3', assigneeId: 'a', status: 'blocked', storyPoints: undefined }),
    ]
    expect(computeLoadsFromTasks(tasks, [m])[0].currentLoad).toBe(30 + Math.round((7 / 10) * 45))
  })
  it('caps at 99%', () => {
    const tasks = [makeTask({ assigneeId: 'a', status: 'assigned', storyPoints: 100 })]
    expect(computeLoadsFromTasks(tasks, [makeMember({ id: 'a', capacity: 1 })])[0].currentLoad).toBe(99)
  })
})
