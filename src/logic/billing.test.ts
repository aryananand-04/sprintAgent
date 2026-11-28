// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
// Provenance: sprintagent-prov-7c1e94d2b85a
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import {
  ENTITLEMENTS, PLANS, aiRemaining, billableSeats, effectivePlan, integrationAllowed, planWith, previousMonth,
  usageLine, usageMonth, type IntegrationKind,
} from './billing'

describe('effectivePlan', () => {
  it('no billing row is Free', () => {
    expect(effectivePlan(null)).toBe('free')
    expect(effectivePlan(undefined)).toBe('free')
  })
  it('keeps the paid plan while active, trialing or retrying payment', () => {
    for (const status of ['active', 'trialing', 'past_due']) expect(effectivePlan({ plan: 'team', status })).toBe('team')
  })
  it('falls back to Free once the subscription ends', () => {
    for (const status of ['canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused', 'none']) {
      expect(effectivePlan({ plan: 'business', status })).toBe('free')
    }
  })
  it('enterprise is set by contract', () => {
    expect(effectivePlan({ plan: 'enterprise', status: 'active' })).toBe('enterprise')
    expect(effectivePlan({ plan: 'enterprise', status: 'canceled' })).toBe('free')
  })
})

describe('entitlements', () => {
  it('each plan includes everything the one below it has', () => {
    for (let i = 1; i < PLANS.length; i++) {
      const lo = ENTITLEMENTS[PLANS[i - 1]], hi = ENTITLEMENTS[PLANS[i]]
      expect(hi.aiCallsPerMonth).toBeGreaterThanOrEqual(lo.aiCallsPerMonth)
      expect(hi.integrations).toBeGreaterThanOrEqual(lo.integrations)
      expect(hi.activeContributors).toBeGreaterThanOrEqual(lo.activeContributors)
      expect(Number(hi.perTypePolicy)).toBeGreaterThanOrEqual(Number(lo.perTypePolicy))
      expect(Number(hi.auditExport)).toBeGreaterThanOrEqual(Number(lo.auditExport))
    }
  })
  it('names the cheapest plan with a feature', () => {
    expect(planWith('auditExport')).toBe('business')
    expect(planWith('perTypePolicy')).toBe('business')
  })
  it('AI quota left never goes negative', () => {
    expect(aiRemaining('free', 3)).toBe(0)
    expect(aiRemaining('team', 1_500)).toBe(500)
    expect(aiRemaining('enterprise', 1e9)).toBe(Infinity)
  })
})

describe('integrationAllowed', () => {
  const set = (...k: IntegrationKind[]) => new Set(k)
  it('Free allows one tool, and reconnecting it', () => {
    expect(integrationAllowed('free', set(), 'github')).toBe(true)
    expect(integrationAllowed('free', set('github'), 'github')).toBe(true)
    expect(integrationAllowed('free', set('github'), 'slack')).toBe(false)
  })
  it('paid plans allow every tool', () => {
    expect(integrationAllowed('team', set('github', 'slack', 'linear'), 'jira')).toBe(true)
  })
})

describe('months and seats', () => {
  it('keys usage by UTC month', () => {
    expect(usageMonth(new Date('2026-11-30T23:59:59Z'))).toBe('2026-11')
    expect(previousMonth(new Date('2026-01-15T00:00:00Z'))).toBe('2025-12')
  })
  it('bills the larger of last and this month, at least one seat', () => {
    expect(billableSeats(0, 0)).toBe(1)
    expect(billableSeats(7, 2)).toBe(7)
    fc.assert(fc.property(fc.nat(500), fc.nat(500), (a, b) => billableSeats(a, b) >= Math.max(a, b, 1)))
  })
  it('usage lines read plainly', () => {
    expect(usageLine(1204, 2000)).toBe('1,204 of 2,000')
    expect(usageLine(3, Infinity)).toBe('3 (no limit)')
  })
})
