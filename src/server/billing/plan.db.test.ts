// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
// Runs against the local Supabase (npm run test:db). Uses its own throwaway workspace.
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/db/database.types'
import { usageMonth } from '@/logic/billing'
import { canConnect, consumeAi, dailySeatSync, getPlan, syncSeats, syncSubscription, usage } from './plan'

const db = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } })
let ws = ''
let member = ''
const now = new Date()

const sub = (over: Record<string, unknown> = {}) => ({
  id: 'sub_test_1', customer: 'cus_test_1', status: 'active', cancel_at_period_end: false, trial_end: null,
  metadata: { workspace_id: ws },
  items: { data: [{ id: 'si_test_1', quantity: 1, current_period_end: Math.floor(now.getTime() / 1000) + 86_400 * 30, price: { id: 'price_team' } }] },
  ...over,
})
const fakeStripe = (body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch & ReturnType<typeof vi.fn>

beforeAll(async () => {
  Object.assign(process.env, { STRIPE_PRICE_TEAM: 'price_team', STRIPE_PRICE_BUSINESS: 'price_biz', STRIPE_SECRET_KEY: 'sk_test_x' })
  ws = (await db.from('workspaces').insert({ name: 'Billing test', slug: `billing-test-${Date.now()}` }).select('id').single()).data!.id
  member = (await db.from('team_members').insert({ workspace_id: ws, name: 'Bo', initials: 'BO', title: 'Engineer', color: '#000' }).select('id').single()).data!.id
})
afterAll(async () => { await db.from('workspaces').delete().eq('id', ws) })
beforeEach(async () => { await db.from('workspace_billing').delete().eq('workspace_id', ws) })

describe('plan and AI allowance', () => {
  it('a workspace without billing is on Free, which has no AI', async () => {
    expect(await getPlan(db, ws)).toBe('free')
    expect(await consumeAi(db, ws)).toBe(false)
    expect((await usage(db, ws)).ai).toEqual({ used: 0, limit: 0 })
  })
  it('Team counts each call against the month', async () => {
    await db.from('workspace_billing').insert({ workspace_id: ws, plan: 'team', status: 'active' })
    await db.from('ai_usage').upsert({ workspace_id: ws, month: usageMonth(now), calls: 1_999 })
    expect(await consumeAi(db, ws)).toBe(true)
    expect(await consumeAi(db, ws)).toBe(false) // 2,000 used
    expect((await usage(db, ws)).ai).toEqual({ used: 2_000, limit: 2_000 })
    await db.from('ai_usage').delete().eq('workspace_id', ws)
  })
  it('a cancelled subscription is Free again', async () => {
    await db.from('workspace_billing').insert({ workspace_id: ws, plan: 'business', status: 'canceled' })
    expect(await getPlan(db, ws)).toBe('free')
  })
})

describe('connected tools', () => {
  afterAll(async () => { await db.from('integrations').delete().eq('workspace_id', ws) })
  it('Free allows one tool; paid plans allow more', async () => {
    expect(await canConnect(db, ws, 'github')).toBe(true)
    await db.from('integrations').insert({ workspace_id: ws, kind: 'slack_webhook', url: 'https://hooks.slack.com/services/T/B/billing' })
    expect(await canConnect(db, ws, 'slack')).toBe(true) // reconnecting
    expect(await canConnect(db, ws, 'github')).toBe(false)
    await db.from('workspace_billing').insert({ workspace_id: ws, plan: 'team', status: 'trialing' })
    expect(await canConnect(db, ws, 'github')).toBe(true)
  })
})

describe('syncSubscription', () => {
  it('copies the subscription from Stripe, reading it back by id', async () => {
    const f = fakeStripe(sub({ status: 'trialing', trial_end: Math.floor(now.getTime() / 1000) + 86_400 * 14 }))
    expect(await syncSubscription(db, 'sub_test_1', { fetchImpl: f })).toBe('synced')
    expect((f.mock.calls[0] as unknown as [string])[0]).toContain('/subscriptions/sub_test_1')
    const row = (await db.from('workspace_billing').select('*').eq('workspace_id', ws).single()).data!
    expect(row).toMatchObject({ plan: 'team', status: 'trialing', stripe_customer_id: 'cus_test_1', stripe_item_id: 'si_test_1', trial_used: true })
    expect(await getPlan(db, ws)).toBe('team')
    const feed = await db.from('feed_events').select('message').eq('workspace_id', ws).like('message', 'Plan changed%')
    expect(feed.data?.at(-1)?.message).toBe('Plan changed from free to team.')
  })
  it('ignores prices and customers that are not this workspace’s', async () => {
    expect(await syncSubscription(db, 'x', { fetchImpl: fakeStripe(sub({ items: { data: [{ id: 'si', price: { id: 'price_other' } }] } })) })).toBe('unknown')
    await db.from('workspace_billing').insert({ workspace_id: ws, stripe_customer_id: 'cus_mine' })
    expect(await syncSubscription(db, 'x', { fetchImpl: fakeStripe(sub()) })).toBe('unknown')
  })
  it('an old subscription ending does not downgrade a newer live one', async () => {
    await db.from('workspace_billing').insert({ workspace_id: ws, plan: 'business', status: 'active', stripe_customer_id: 'cus_test_1', stripe_subscription_id: 'sub_new' })
    expect(await syncSubscription(db, 'sub_test_1', { fetchImpl: fakeStripe(sub({ status: 'canceled' })) })).toBe('stale')
    expect(await getPlan(db, ws)).toBe('business')
  })
})

describe('seats', () => {
  it('bills the active contributors, once a day', async () => {
    await db.from('workspace_billing').insert({ workspace_id: ws, plan: 'team', status: 'active', stripe_item_id: 'si_test_1', seats: 0 })
    await db.from('tasks').insert({ workspace_id: ws, title: 'Seat', type: 'bug', impact: 3, effort: 2, risk: 2, clarity: 4, assignee_id: member })
    const f = fakeStripe({ id: 'si_test_1', quantity: 1 })
    expect(await dailySeatSync(db, ws, now, { fetchImpl: f })).toBe(1)
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toContain('/subscription_items/si_test_1')
    expect(init.body).toBe('quantity=1&proration_behavior=none')
    expect(await dailySeatSync(db, ws, now, { fetchImpl: f })).toBeNull() // claimed for today
    expect(await syncSeats(db, ws, now, { fetchImpl: f })).toBe(1) // unchanged: no second call
    expect(f).toHaveBeenCalledTimes(1)
    await db.from('agent_cooldowns').delete().eq('workspace_id', ws)
  })
})
