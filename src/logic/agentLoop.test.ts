// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
// Provenance: sprintagent-prov-7c1e94d2b85a
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { planAgentTick, type TickInput } from './agentLoop'
import { DEFAULT_AUTONOMY_CONFIG as C } from './constants'
import { makeTask, makeMember, makeSprint } from '../test/factories'
import { arbTask } from '../test/arbitraries'
import type { EscalationItem } from '../types'

const NOW = new Date('2026-11-10T12:00:00Z').getTime()
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString()
const input = (over: Partial<TickInput> = {}): TickInput => ({
  tasks: [], team: [], sprint: makeSprint({ startDate: '2026-11-01', endDate: '2026-11-14', committedPoints: 40, completedPoints: 30, daysRemaining: 4 }),
  escalations: [], config: C, now: NOW, canFire: () => true, ...over,
})

describe('planAgentTick', () => {
  it('does nothing on a healthy sprint', () => {
    expect(planAgentTick(input({ team: [makeMember({ currentLoad: 50 })] }))).toEqual([])
  })

  it('moves the smallest task off an overloaded person to whoever has most room', () => {
    const team = [makeMember({ id: 'a', name: 'A', currentLoad: 95 }), makeMember({ id: 'b', name: 'B', currentLoad: 60 }), makeMember({ id: 'c', name: 'C', currentLoad: 30 })]
    const tasks = [makeTask({ id: 'big', assigneeId: 'a', status: 'in-progress', storyPoints: 8 }), makeTask({ id: 'small', assigneeId: 'a', status: 'assigned', storyPoints: 1 })]
    expect(planAgentTick(input({ team, tasks }))).toEqual([expect.objectContaining({ kind: 'reassign', taskId: 'small', toMemberId: 'c' })])
  })

  it('never hands two people’s overflow to the same teammate in one tick', () => {
    const team = [makeMember({ id: 'a', currentLoad: 95 }), makeMember({ id: 'b', currentLoad: 96 }), makeMember({ id: 'c', currentLoad: 10 })]
    const tasks = [makeTask({ id: 't1', assigneeId: 'a', status: 'assigned' }), makeTask({ id: 't2', assigneeId: 'b', status: 'assigned' })]
    const acts = planAgentTick(input({ team, tasks }))
    expect(acts.filter((a) => a.kind === 'reassign')).toHaveLength(1)
    expect(acts.filter((a) => a.kind === 'escalate')).toHaveLength(1)
  })

  it('unblocks by reassigning a stalled dependency, else escalates', () => {
    const team = [makeMember({ id: 'busy', currentLoad: 90 }), makeMember({ id: 'free', currentLoad: 20, skills: ['frontend'] })]
    const dep = makeTask({ id: 'dep', assigneeId: 'busy', status: 'in-progress', tags: ['frontend'] })
    const blocked = makeTask({ id: 'blk', status: 'blocked', dependencies: ['dep'], createdAt: hoursAgo(5) })
    expect(planAgentTick(input({ team, tasks: [dep, blocked] }))).toContainEqual(expect.objectContaining({ kind: 'reassign', taskId: 'dep', toMemberId: 'free', feedTaskId: 'blk' }))
    expect(planAgentTick(input({ team: [], tasks: [dep, blocked] }))).toContainEqual(expect.objectContaining({ kind: 'escalate', taskId: 'blk', category: 'blocker' }))
  })

  it('warns about velocity only late in the sprint', () => {
    const behind = makeSprint({ startDate: '2026-11-01', endDate: '2026-11-14', committedPoints: 40, completedPoints: 5 })
    expect(planAgentTick(input({ sprint: { ...behind, daysRemaining: 4 } }))).toContainEqual(expect.objectContaining({ key: 'velocity' }))
    expect(planAgentTick(input({ sprint: { ...behind, daysRemaining: 10 } }))).toEqual([])
  })

  it('escalates critical work nobody owns, and nudges stale escalations', () => {
    const tasks = [makeTask({ id: 'crit', urgency: 'critical', status: 'triaged', assigneeId: undefined, createdAt: hoursAgo(3) })]
    const escalations = [{ id: 'e1', taskId: 'x', taskTitle: 'Old one', createdAt: hoursAgo(9), resolved: false }] as EscalationItem[]
    const keys = planAgentTick(input({ tasks, escalations })).map((a) => a.key)
    expect(keys).toEqual(['critical-unassigned-crit', 'esc-nudge-e1'])
  })

  it('respects cooldowns', () => {
    const escalations = [{ id: 'e1', taskId: 'x', taskTitle: 'Old', createdAt: hoursAgo(9), resolved: false }] as EscalationItem[]
    expect(planAgentTick(input({ escalations, canFire: () => false }))).toEqual([])
  })

  it('never emits the same key twice and never assigns to the overloaded person (property)', () => fc.assert(fc.property(
    fc.array(arbTask, { maxLength: 12 }), fc.array(fc.integer({ min: 0, max: 120 }), { minLength: 1, maxLength: 5 }),
    (tasks, loads) => {
      const team = loads.map((l, i) => makeMember({ id: `m${i}`, name: `M${i}`, currentLoad: l }))
      const owned = tasks.map((t, i) => ({ ...t, assigneeId: `m${i % team.length}` }))
      const acts = planAgentTick(input({ tasks: owned, team }))
      const keys = acts.map((a) => a.key)
      expect(new Set(keys).size).toBe(keys.length)
      for (const a of acts) if (a.kind === 'reassign') expect(team.find((m) => m.id === a.toMemberId)!.currentLoad).toBeLessThan(75)
    },
  )))
})
