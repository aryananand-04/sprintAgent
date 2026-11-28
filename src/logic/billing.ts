// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
// Provenance: sprintagent-prov-7c1e94d2b85a

export const PLANS = ['free', 'team', 'business', 'enterprise'] as const
export type Plan = (typeof PLANS)[number]
export const PAID_PLANS = ['team', 'business'] as const
export type PaidPlan = (typeof PAID_PLANS)[number]

export const PLAN_NAMES: Record<Plan, string> = { free: 'Free', team: 'Team', business: 'Business', enterprise: 'Enterprise' }

export type IntegrationKind = 'github' | 'slack' | 'linear' | 'jira'

export interface Entitlements {
  /** AI calls (triage, narrative, planning…) per calendar month (UTC). Past it, the rule engine carries on. */
  aiCallsPerMonth: number
  /** Distinct tools connected (GitHub, Slack, Linear, Jira). */
  integrations: number
  /** People assigned work or changing tasks in a month. Soft: shown, never blocks work. */
  activeContributors: number
  /** Admins set the agent's ceiling per task type and action (otherwise one ceiling for everything). */
  perTypePolicy: boolean
  /** Download the hash-chained decision log. Verifying it is available on every plan. */
  auditExport: boolean
}

export const ENTITLEMENTS: Record<Plan, Entitlements> = {
  free: { aiCallsPerMonth: 0, integrations: 1, activeContributors: 5, perTypePolicy: false, auditExport: false },
  team: { aiCallsPerMonth: 2_000, integrations: Infinity, activeContributors: Infinity, perTypePolicy: false, auditExport: false },
  business: { aiCallsPerMonth: 10_000, integrations: Infinity, activeContributors: Infinity, perTypePolicy: true, auditExport: true },
  enterprise: { aiCallsPerMonth: Infinity, integrations: Infinity, activeContributors: Infinity, perTypePolicy: true, auditExport: true },
}

/** Days of the paid trial (no card needed). One per workspace. */
export const TRIAL_DAYS = 14

/** Stripe subscription states that keep the paid plan. past_due is a grace period while Stripe retries the card. */
const LIVE = new Set(['active', 'trialing', 'past_due'])

export interface BillingState { plan: Plan; status: string }

/** The plan a workspace has right now. No row, or a subscription that ended, means Free. */
export function effectivePlan(billing: BillingState | null | undefined): Plan {
  if (!billing) return 'free'
  if (billing.plan === 'enterprise' && billing.status === 'active') return 'enterprise' // set by contract, not Stripe
  return LIVE.has(billing.status) ? billing.plan : 'free'
}

export const entitlementsFor = (plan: Plan): Entitlements => ENTITLEMENTS[plan]

/** The cheapest plan that has a feature, for "available on …" copy. */
export function planWith(feature: 'perTypePolicy' | 'auditExport'): Plan {
  return PLANS.find((p) => ENTITLEMENTS[p][feature])!
}

/** UTC calendar month key for usage counters: '2026-11'. */
export const usageMonth = (now: Date) => now.toISOString().slice(0, 7)
export function previousMonth(now: Date): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
  return usageMonth(d)
}

/**
 * Seats billed in advance at each renewal: the larger of last month's and this month's active
 * contributors, so a renewal early in the month doesn't bill for the few people seen so far.
 */
export const billableSeats = (lastMonth: number, thisMonth: number) => Math.max(1, lastMonth, thisMonth)

/** AI quota left; Infinity when unlimited. */
export const aiRemaining = (plan: Plan, used: number) => Math.max(0, ENTITLEMENTS[plan].aiCallsPerMonth - used)

/** Whether connecting `kind` stays within the plan, given what is already connected. Reconnecting is always fine. */
export function integrationAllowed(plan: Plan, connected: ReadonlySet<IntegrationKind>, kind: IntegrationKind): boolean {
  return connected.has(kind) || connected.size < ENTITLEMENTS[plan].integrations
}

/** Short usage line for a limit: "1,204 of 2,000" or "1,204 (unlimited)". */
export function usageLine(used: number, limit: number): string {
  const n = (x: number) => x.toLocaleString('en-US')
  return Number.isFinite(limit) ? `${n(used)} of ${n(limit)}` : `${n(used)} (no limit)`
}
