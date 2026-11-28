// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createHmac } from 'node:crypto'
import { STRIPE_VERSION, StripeError, formEncode, planForPrice, stripe, stripeConfigured, verifyStripeSignature } from './stripe'

beforeEach(() => {
  Object.assign(process.env, { STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: 'whsec_x', STRIPE_PRICE_TEAM: 'price_team', STRIPE_PRICE_BUSINESS: 'price_biz' })
})

describe('formEncode', () => {
  it('uses Stripe bracket notation and drops empty values', () => {
    const q = new URLSearchParams(formEncode({ mode: 'subscription', line_items: [{ price: 'p', quantity: 1 }], subscription_data: { metadata: { workspace_id: 'w' } }, skip: undefined, none: null, ok: true }))
    expect(Object.fromEntries(q)).toEqual({
      mode: 'subscription', 'line_items[0][price]': 'p', 'line_items[0][quantity]': '1',
      'subscription_data[metadata][workspace_id]': 'w', ok: 'true',
    })
  })
})

describe('verifyStripeSignature', () => {
  const body = '{"id":"evt_1"}'
  const now = 1_800_000_000_000
  const sign = (t: number, secret = 'whsec_x') => createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')
  const t = now / 1000

  it('accepts a fresh, correctly signed body (any of several v1s)', () => {
    expect(verifyStripeSignature(body, `t=${t},v1=${sign(t)}`, 'whsec_x', now)).toBe(true)
    expect(verifyStripeSignature(body, `t=${t},v1=${'0'.repeat(64)},v1=${sign(t)}`, 'whsec_x', now)).toBe(true)
  })
  it('refuses another secret, a changed body, an old timestamp or no header', () => {
    expect(verifyStripeSignature(body, `t=${t},v1=${sign(t, 'whsec_other')}`, 'whsec_x', now)).toBe(false)
    expect(verifyStripeSignature(body + ' ', `t=${t},v1=${sign(t)}`, 'whsec_x', now)).toBe(false)
    expect(verifyStripeSignature(body, `t=${t - 301},v1=${sign(t - 301)}`, 'whsec_x', now)).toBe(false)
    expect(verifyStripeSignature(body, null, 'whsec_x', now)).toBe(false)
    expect(verifyStripeSignature(body, `t=${t},v1=${sign(t)}`, '', now)).toBe(false)
    expect(verifyStripeSignature(body, `v1=${sign(t)}`, 'whsec_x', now)).toBe(false)
  })
})

describe('stripe()', () => {
  it('sends form bodies with the pinned version and idempotency key', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ id: 'cus_1' }), { status: 200 }))
    await expect(stripe('POST', '/customers', { email: 'a@b.c' }, { idempotencyKey: 'k', fetchImpl: f as unknown as typeof fetch })).resolves.toEqual({ id: 'cus_1' })
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.stripe.com/v1/customers')
    expect(init.body).toBe('email=a%40b.c')
    expect(init.headers).toMatchObject({ Authorization: 'Bearer sk_test_x', 'Stripe-Version': STRIPE_VERSION, 'Idempotency-Key': 'k' })
  })
  it('puts GET params in the query and raises Stripe errors', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ error: { code: 'resource_missing', message: 'No such subscription' } }), { status: 404 }))
    const err = await stripe('GET', '/subscriptions/sub_1', { expand: ['items'] }, { fetchImpl: f as unknown as typeof fetch }).catch((e) => e)
    expect(err).toBeInstanceOf(StripeError)
    expect(err).toMatchObject({ status: 404, code: 'resource_missing' })
    expect((f.mock.calls[0] as unknown as [string])[0]).toBe('https://api.stripe.com/v1/subscriptions/sub_1?expand%5B0%5D=items')
  })
  it('refuses to run without a key', async () => {
    delete process.env.STRIPE_SECRET_KEY
    expect(stripeConfigured()).toBe(false)
    await expect(stripe('GET', '/x')).rejects.toMatchObject({ code: 'not_configured' })
  })
})

describe('planForPrice', () => {
  it('maps our prices and ignores others', () => {
    expect(planForPrice('price_team')).toBe('team')
    expect(planForPrice('price_biz')).toBe('business')
    expect(planForPrice('price_someone_else')).toBeNull()
    expect(planForPrice(undefined)).toBeNull()
  })
})
