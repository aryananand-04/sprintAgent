// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
// Provenance: sprintagent-prov-7c1e94d2b85a
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { DEFAULT_LEVEL, PROMOTION, decisionsNeeded, evaluateLicense, levelFor, mayAct, wilson, type Level, type Outcome } from './earnedAutonomy'

const outcomes = (agree: number, disagree: number, start = 0): Outcome[] => [
  ...Array.from({ length: agree }, (_, i) => ({ agree: true, at: new Date(Date.UTC(2026, 10, 1, 0, start + i)).toISOString() })),
  ...Array.from({ length: disagree }, (_, i) => ({ agree: false, at: new Date(Date.UTC(2026, 10, 1, 0, start + agree + i)).toISOString() })),
]

describe('wilson', () => {
  it('is wide with little evidence and tightens with more', () => {
    expect(wilson(0, 0)).toEqual({ lower: 0, upper: 1 })
    expect(wilson(3, 3).lower).toBeLessThan(0.5) // a lucky 3/3 is not 100%
    expect(wilson(10, 10).lower).toBeCloseTo(0.722, 2)
    expect(wilson(90, 100).lower).toBeGreaterThan(wilson(9, 10).lower)
  })
  it('always brackets the observed rate', () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: 500 }), fc.integer({ min: 0, max: 500 }), (n, s0) => {
      const s = s0 % (n + 1)
      const { lower, upper } = wilson(s, n)
      return lower >= 0 && upper <= 1 && lower <= s / n + 1e-9 && upper >= s / n - 1e-9
    }))
  })
})

describe('evaluateLicense', () => {
  const base = { action: 'assign' as const, earned: 1 as Level, cap: 3 as Level }

  it('no evidence: stays at Suggest and says so', () => {
    const e = evaluateLicense({ ...base, outcomes: [] })
    expect(e).toMatchObject({ earned: 1, effective: 1, change: null, n: 0 })
    expect(e.reason).toMatch(/still watching/)
    expect(e.next).toMatchObject({ level: 2, moreDecisions: 20 })
  })

  it('promotes to Act-with-undo only when the whole record clears the bar', () => {
    expect(evaluateLicense({ ...base, outcomes: outcomes(19, 0) }).earned).toBe(1) // not enough decisions
    const e = evaluateLicense({ ...base, outcomes: outcomes(20, 0) })
    expect(e).toMatchObject({ earned: 2, change: 'promoted' })
    expect(e.reason).toMatch(/Agreed with people 20\/20 times/)
    expect(evaluateLicense({ ...base, outcomes: outcomes(20, 4) }).earned).toBe(1) // 83% observed, lower bound too low
  })

  it('moves one level at a time, even with overwhelming evidence', () => {
    expect(evaluateLicense({ ...base, outcomes: outcomes(200, 0) }).earned).toBe(2)
    expect(evaluateLicense({ ...base, earned: 2, outcomes: outcomes(200, 0) }).earned).toBe(3)
  })

  it('demotes on recent drift even with a good long record', () => {
    const history = [...outcomes(80, 0), ...outcomes(4, 12, 200)]
    const e = evaluateLicense({ ...base, earned: 3, outcomes: history })
    expect(e).toMatchObject({ earned: 2, change: 'demoted' })
    expect(e.reason).toMatch(/Recent agreement 8\/20/)
  })

  it('the admin cap limits what applies, never what was earned', () => {
    const e = evaluateLicense({ ...base, earned: 3, cap: 1, outcomes: outcomes(80, 0) })
    expect(e).toMatchObject({ earned: 3, effective: 1 })
  })

  it('never jumps two levels, and effective never exceeds earned or cap', () => {
    fc.assert(fc.property(
      fc.constantFrom<Level>(1, 2, 3), fc.constantFrom<Level>(0, 1, 2, 3), fc.integer({ min: 0, max: 120 }), fc.integer({ min: 0, max: 60 }),
      (earned, cap, a, d) => {
        const e = evaluateLicense({ action: 'assign', earned, cap, outcomes: outcomes(a, d) })
        return Math.abs(e.earned - earned) <= 1 && e.effective <= e.earned && e.effective <= cap
      },
    ))
  })
})

describe('helpers', () => {
  it('decisionsNeeded counts all-agree decisions to the bar', () => {
    expect(decisionsNeeded(0, 0, { minN: 20, minLower: 0.8 })).toBe(20)
    expect(decisionsNeeded(50, 50, { minN: 50, minLower: 0.9 })).toBe(0)
    expect(decisionsNeeded(0, 1_000, { minN: 20, minLower: 0.99 })).toBe(Infinity)
  })
  it('untracked licences default to Suggest; only L2+ acts', () => {
    expect(levelFor([], 'bug', 'assign')).toBe(DEFAULT_LEVEL)
    expect(levelFor([{ taskType: 'bug', action: 'assign', effective: 3 }], 'bug', 'assign')).toBe(3)
    expect([0, 1, 2, 3].map((l) => mayAct(l as Level))).toEqual([false, false, true, true])
  })
})

describe('demo seed history is consistent with the rules', () => {
  // Mirrors scripts/generate-seed.ts HISTORY: each seeded level must clear its own bar, so the agent
  // tick never "corrects" the demo on its first run.
  it.each([[64, 1, 3], [26, 1, 2], [30, 1, 2]] as const)('%i decisions, %i disagreements hold L%i', (n, d, level) => {
    const bar = PROMOTION[level as 2 | 3]
    expect(n).toBeGreaterThanOrEqual(bar.minN)
    expect(wilson(n - d, n).lower).toBeGreaterThanOrEqual(bar.minLower)
  })
})
