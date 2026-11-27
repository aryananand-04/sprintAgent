// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
// Provenance: sprintagent-prov-7c1e94d2b85a
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { decideAutonomy, triageTask } from './triage'
import { computeTriageScore, computeTicketQuality, computeAssignmentConfidence } from './scoring'
import { standupCost } from './standupCost'
import { DEFAULT_AUTONOMY_CONFIG } from './constants'
import { arbTask, arbConfig } from '../test/arbitraries'
import type { AgentDecision } from '../types'

const SEVERITY: Record<AgentDecision, number> = { ACT: 0, ASK: 1, ESCALATE: 2 }
const cfg = arbConfig(DEFAULT_AUTONOMY_CONFIG)
const bump = (n: number) => Math.min(5, n + 1)

describe('scores stay in range', () => {
  it('triage score is an integer in 0..100', () => fc.assert(fc.property(arbTask, (t) => {
    const s = computeTriageScore(t)
    return Number.isInteger(s) && s >= 0 && s <= 100
  })))
  it('ticket quality is in 0..100', () => fc.assert(fc.property(arbTask, (t) => {
    const q = computeTicketQuality(t)
    return q >= 0 && q <= 100
  })))
  it('assignment confidence is in 10..99', () => fc.assert(fc.property(
    arbTask, fc.array(fc.string()), fc.integer({ min: 0, max: 150 }), fc.boolean(),
    (t, skills, load, dep) => { const c = computeAssignmentConfidence(t, skills, load, dep); return c >= 10 && c <= 99 },
  )))
})

describe('decisions are monotonic', () => {
  it('more clarity never makes the agent more cautious', () => fc.assert(fc.property(arbTask, cfg, (t, c) =>
    SEVERITY[decideAutonomy({ ...t, clarity: bump(t.clarity) }, c)] <= SEVERITY[decideAutonomy(t, c)])))
  it('more risk never makes the agent bolder', () => fc.assert(fc.property(arbTask, cfg, (t, c) =>
    SEVERITY[decideAutonomy({ ...t, risk: bump(t.risk) }, c)] >= SEVERITY[decideAutonomy(t, c)])))
  it('more effort never makes the agent bolder', () => fc.assert(fc.property(arbTask, cfg, (t, c) =>
    SEVERITY[decideAutonomy({ ...t, effort: bump(t.effort) }, c)] >= SEVERITY[decideAutonomy(t, c)])))
  it('an external blocker always escalates', () => fc.assert(fc.property(arbTask, cfg, (t, c) =>
    decideAutonomy({ ...t, externalBlockers: ['vendor'] }, c) === 'ESCALATE')))
  it('a never-auto-assign type is never ACT', () => fc.assert(fc.property(arbTask, cfg, (t, c) =>
    !c.neverAutoAssignTypes.includes(t.type) || decideAutonomy(t, c) !== 'ACT')))
})

describe('triage result', () => {
  it('agrees with decideAutonomy and always explains itself', () => fc.assert(fc.property(arbTask, (t) => {
    const r = triageTask(t)
    expect(r.decision).toBe(decideAutonomy(t))
    expect(r.reason.length).toBeGreaterThan(20)
  })))
})

describe('standup cost', () => {
  const input = fc.record({
    people: fc.integer({ min: 1, max: 50 }), minutes: fc.integer({ min: 1, max: 60 }),
    hourlyCost: fc.integer({ min: 0, max: 500 }), daysPerSprint: fc.integer({ min: 1, max: 15 }),
  })
  it('is never negative and grows with headcount', () => fc.assert(fc.property(input, (i) => {
    const a = standupCost(i), b = standupCost({ ...i, people: i.people + 1 })
    return a.costPerSprint >= 0 && b.costPerSprint >= a.costPerSprint
  })))
})
