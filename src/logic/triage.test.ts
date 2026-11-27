// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
// Provenance: sprintagent-prov-7c1e94d2b85a
import { describe, it, expect } from 'vitest'
import { decideAutonomy, triageTask } from './triage'
import { DEFAULT_AUTONOMY_CONFIG as C } from './constants'
import { makeTask } from '../test/factories'

describe('decideAutonomy', () => {
  it.each([
    ['clarity 1', { clarity: 1 }, 'ESCALATE'],
    ['max risk + high effort', { risk: 5, effort: 4 }, 'ESCALATE'],
    ['external blocker', { externalBlockers: ['legal-review'] }, 'ESCALATE'],
    ['huge urgent task', { type: 'urgent' as const, effort: 5 }, 'ESCALATE'],
    ['low clarity', { clarity: 2 }, 'ASK'],
    ['clear task', {}, 'ACT'],
    ['internal dependency', { dependencies: ['task-9'] }, 'ACT'],
  ])('%s → %s', (_n, over, expected) => {
    expect(decideAutonomy(makeTask(over), C)).toBe(expected)
  })

  it('respects neverAutoAssignTypes', () => {
    expect(decideAutonomy(makeTask(), { ...C, neverAutoAssignTypes: ['bug'] })).toBe('ASK')
  })
  it('asks on high effort below a raised ACT bar', () => {
    expect(decideAutonomy(makeTask({ clarity: 3, effort: 4 }), { ...C, actMinClarity: 4 })).toBe('ASK')
  })
  it('falls through to ASK when clarity misses the ACT bar', () => {
    expect(decideAutonomy(makeTask({ clarity: 4 }), { ...C, actMinClarity: 5 })).toBe('ASK')
  })
})

describe('triageTask', () => {
  it('returns decision, score, reason and mapped dimensions', () => {
    const r = triageTask(makeTask())
    expect(r.decision).toBe('ACT')
    expect(r.score).toBe(84)
    expect(r.reason).toMatch(/clarity: 4\/5/)
    expect(r.dimensions).toEqual({ urgency: 4, impact: 4, effort: 2, risk: 2, clarity: 4 })
  })
})
