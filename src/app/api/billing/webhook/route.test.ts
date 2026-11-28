// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHmac } from 'node:crypto'

const sync = vi.fn(async (id: string) => (id ? 'synced' : 'unknown'))
vi.mock('@/server/billing/plan', () => ({ syncSubscription: (_db: unknown, id: string) => sync(id) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({}) }))
const { POST } = await import('./route')

const send = (event: unknown, secret = 'whsec_test') => {
  const body = JSON.stringify(event)
  const t = Math.floor(Date.now() / 1000)
  const sig = createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')
  return POST(new Request('http://x/api/billing/webhook', { method: 'POST', body, headers: { 'stripe-signature': `t=${t},v1=${sig}` } }))
}

beforeEach(() => { process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'; sync.mockClear() })

describe('Stripe webhook', () => {
  it('refuses unsigned or wrongly signed events', async () => {
    expect((await send({ type: 'customer.subscription.updated', data: { object: { id: 'sub_1' } } }, 'whsec_other')).status).toBe(400)
    expect(sync).not.toHaveBeenCalled()
  })
  it('syncs the subscription a subscription event or a completed checkout names', async () => {
    expect((await send({ type: 'customer.subscription.deleted', data: { object: { id: 'sub_1' } } })).status).toBe(200)
    await send({ type: 'checkout.session.completed', data: { object: { mode: 'subscription', subscription: 'sub_2' } } })
    expect(sync.mock.calls).toEqual([['sub_1'], ['sub_2']])
  })
  it('ignores everything else, and asks Stripe to retry when sync fails', async () => {
    expect(await (await send({ type: 'charge.succeeded', data: { object: { id: 'ch_1' } } })).json()).toMatchObject({ ignored: 'charge.succeeded' })
    sync.mockRejectedValueOnce(new Error('down'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect((await send({ type: 'customer.subscription.updated', data: { object: { id: 'sub_3' } } })).status).toBe(500)
  })
})
