// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/db/database.types'
import {
  ENTITLEMENTS, billableSeats, effectivePlan, integrationAllowed, previousMonth, usageMonth,
  type IntegrationKind, type Plan,
} from '@/logic/billing'
import { planForPrice, stripe, stripeConfigured, type StripeSubscription } from './stripe'

type Db = SupabaseClient<Database>
type Opts = { fetchImpl?: typeof fetch }

export async function loadBilling(db: Db, ws: string) {
  const { data } = await db.from('workspace_billing').select('*').eq('workspace_id', ws).maybeSingle()
  return data
}

export async function getPlan(db: Db, ws: string): Promise<Plan> {
  return effectivePlan(await loadBilling(db, ws))
}

/**
 * Counts one AI call against the month's allowance. False when the plan has none left: the caller
 * then uses the rule engine, exactly as when AI isn't configured.
 */
export async function consumeAi(db: Db, ws: string, now = new Date()): Promise<boolean> {
  const cap = ENTITLEMENTS[await getPlan(db, ws)].aiCallsPerMonth
  if (cap <= 0) return false
  const { data, error } = await db.rpc('consume_ai_call', { p_ws: ws, p_month: usageMonth(now), p_cap: Number.isFinite(cap) ? cap : null as unknown as number })
  if (error) throw error
  return data === true
}

/** Past the allowance (or on Free): clients treat it like AI being off and use the rules. */
export const aiQuotaResponse = () =>
  Response.json({ error: 'AI_QUOTA', message: 'This month’s AI allowance is used up. Triage carries on with the rule engine.' }, { status: 402 })

/** Tools the workspace has connected. A pasted Slack webhook and the Slack app are both "Slack". */
export async function connectedIntegrations(db: Db, ws: string): Promise<Set<IntegrationKind>> {
  const [gh, slack, hook, trackers] = await Promise.all([
    db.from('github_installations').select('workspace_id').eq('workspace_id', ws).limit(1),
    db.from('slack_installations').select('workspace_id').eq('workspace_id', ws).limit(1),
    db.from('integrations').select('kind').eq('workspace_id', ws).eq('kind', 'slack_webhook').limit(1),
    db.from('tracker_connections').select('kind').eq('workspace_id', ws),
  ])
  const kinds = new Set<IntegrationKind>()
  if (gh.data?.length) kinds.add('github')
  if (slack.data?.length || hook.data?.length) kinds.add('slack')
  for (const t of trackers.data ?? []) kinds.add(t.kind)
  return kinds
}

export async function canConnect(db: Db, ws: string, kind: IntegrationKind): Promise<boolean> {
  const [plan, connected] = await Promise.all([getPlan(db, ws), connectedIntegrations(db, ws)])
  return integrationAllowed(plan, connected, kind)
}

/** The refusal every connect route returns when the plan is full. */
export const planLimitResponse = () =>
  Response.json({ error: 'PLAN_LIMIT', message: 'Free includes one connected tool. Upgrade to Team to connect more.' }, { status: 402 })

export async function activeContributors(db: Db, ws: string, month: string): Promise<number> {
  const { count } = await db.from('contributor_activity').select('member_id', { count: 'exact', head: true }).eq('workspace_id', ws).eq('month', month)
  return count ?? 0
}

export interface Usage {
  plan: Plan
  ai: { used: number; limit: number }
  contributors: { active: number; limit: number }
  integrations: { connected: IntegrationKind[]; limit: number }
}

export async function usage(db: Db, ws: string, now = new Date()): Promise<Usage> {
  const [plan, ai, active, connected] = await Promise.all([
    getPlan(db, ws),
    db.from('ai_usage').select('calls').eq('workspace_id', ws).eq('month', usageMonth(now)).maybeSingle(),
    activeContributors(db, ws, usageMonth(now)),
    connectedIntegrations(db, ws),
  ])
  const e = ENTITLEMENTS[plan]
  return {
    plan,
    ai: { used: ai.data?.calls ?? 0, limit: e.aiCallsPerMonth },
    contributors: { active, limit: e.activeContributors },
    integrations: { connected: [...connected], limit: e.integrations },
  }
}

/** The workspace's Stripe customer, created on first checkout. */
export async function ensureCustomer(db: Db, ws: string, email: string, name: string, opts: Opts = {}): Promise<string> {
  const row = await loadBilling(db, ws)
  if (row?.stripe_customer_id) return row.stripe_customer_id
  const c = await stripe<{ id: string }>('POST', '/customers', { email, name, metadata: { workspace_id: ws } }, { idempotencyKey: `customer-${ws}`, ...opts })
  const { error } = await db.from('workspace_billing').upsert({ workspace_id: ws, stripe_customer_id: c.id }, { onConflict: 'workspace_id' })
  if (error) throw error
  return c.id
}

const iso = (sec: number | null | undefined) => (sec ? new Date(sec * 1000).toISOString() : null)
const LIVE = new Set(['active', 'trialing', 'past_due'])

/**
 * Copies a subscription's current state from Stripe (never from the webhook body, so out-of-order or
 * replayed events can't roll the plan back). Returns what was applied, or why not.
 */
export async function syncSubscription(db: Db, subscriptionId: string, opts: Opts = {}): Promise<'synced' | 'unknown' | 'stale'> {
  const sub = await stripe<StripeSubscription>('GET', `/subscriptions/${encodeURIComponent(subscriptionId)}`, {}, opts)
  const ws = sub.metadata?.workspace_id
  const item = sub.items?.data?.[0]
  const plan = planForPrice(item?.price.id)
  if (!ws || !plan) return 'unknown'

  const row = await loadBilling(db, ws)
  if (row?.stripe_customer_id && row.stripe_customer_id !== sub.customer) return 'unknown' // not this workspace's customer
  // A workspace has one subscription. An old one ending must not downgrade a newer live one.
  if (row?.stripe_subscription_id && row.stripe_subscription_id !== sub.id && LIVE.has(row.status) && !LIVE.has(sub.status)) return 'stale'

  const { error } = await db.from('workspace_billing').upsert({
    workspace_id: ws, plan, status: sub.status, stripe_customer_id: sub.customer, stripe_subscription_id: sub.id,
    stripe_item_id: item!.id, current_period_end: iso(item!.current_period_end ?? sub.current_period_end),
    trial_ends_at: iso(sub.trial_end), cancel_at_period_end: sub.cancel_at_period_end, seats: item!.quantity ?? 0,
    ...(sub.trial_end && { trial_used: true }),
  }, { onConflict: 'workspace_id' })
  if (error) throw error
  if (row?.plan !== plan || row?.status !== sub.status) {
    const now = effectivePlan({ plan, status: sub.status })
    const was = effectivePlan(row)
    if (now !== was) await db.from('feed_events').insert({ workspace_id: ws, type: 'status', message: `Plan changed from ${was} to ${now}.` })
  }
  return 'synced'
}

/**
 * Keeps the subscription's quantity at the billable seat count (no proration: the change applies at
 * the next renewal). Returns the seats billed, or null when there's nothing to sync.
 */
export async function syncSeats(db: Db, ws: string, now = new Date(), opts: Opts = {}): Promise<number | null> {
  const row = await loadBilling(db, ws)
  if (!row?.stripe_item_id || !LIVE.has(row.status) || row.plan === 'enterprise') return null
  const [last, cur] = await Promise.all([activeContributors(db, ws, previousMonth(now)), activeContributors(db, ws, usageMonth(now))])
  const seats = billableSeats(last, cur)
  if (seats === row.seats) return seats
  await stripe('POST', `/subscription_items/${encodeURIComponent(row.stripe_item_id)}`, { quantity: seats, proration_behavior: 'none' }, opts)
  await db.from('workspace_billing').update({ seats }).eq('workspace_id', ws)
  return seats
}

/** Once a day per workspace, from the agent tick. A failure releases the claim so the next tick retries. */
export async function dailySeatSync(db: Db, ws: string, now = new Date(), opts: Opts = {}): Promise<number | null> {
  if (!stripeConfigured() && !opts.fetchImpl) return null
  const key = `seats-${now.toISOString().slice(0, 10)}`
  const { data: first, error } = await db.rpc('claim_agent_cooldown', { ws, check_key: key, cooldown_seconds: 2 * 86_400 })
  if (error) throw error
  if (!first) return null
  return syncSeats(db, ws, now, opts).catch(async (e) => {
    await db.from('agent_cooldowns').delete().eq('workspace_id', ws).eq('key', key)
    throw e
  })
}
