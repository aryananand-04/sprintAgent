// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import type { PaidPlan, Plan } from '@/logic/billing'

/**
 * A small Stripe REST client (form-encoded, as Stripe expects). Pinned API version, so the shapes
 * we read don't move under us when the account default changes.
 */
const API = 'https://api.stripe.com/v1'
export const STRIPE_VERSION = '2025-03-31.basil'

export const stripeConfigured = () =>
  Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET && process.env.STRIPE_PRICE_TEAM && process.env.STRIPE_PRICE_BUSINESS)

export function priceFor(plan: PaidPlan): string {
  const id = plan === 'team' ? process.env.STRIPE_PRICE_TEAM : process.env.STRIPE_PRICE_BUSINESS
  if (!id) throw new Error('STRIPE_NOT_CONFIGURED')
  return id
}

/** The plan a Stripe price buys; null for prices that aren't ours. */
export function planForPrice(priceId: string | null | undefined): Plan | null {
  if (!priceId) return null
  if (priceId === process.env.STRIPE_PRICE_TEAM) return 'team'
  if (priceId === process.env.STRIPE_PRICE_BUSINESS) return 'business'
  return null
}

type Params = Record<string, unknown>

/** Stripe's bracket notation: { a: { b: 1 }, c: [x] } → a[b]=1&c[0]=x. Undefined values are dropped. */
export function formEncode(params: Params): string {
  const out = new URLSearchParams()
  const walk = (prefix: string, v: unknown) => {
    if (v === undefined || v === null) return
    if (Array.isArray(v)) v.forEach((x, i) => walk(`${prefix}[${i}]`, x))
    else if (typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(prefix ? `${prefix}[${k}]` : k, x)
    else out.append(prefix, String(v))
  }
  walk('', params)
  return out.toString()
}

export class StripeError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message) }
}

export async function stripe<T = Record<string, unknown>>(
  method: 'GET' | 'POST', path: string, params: Params = {}, { idempotencyKey, fetchImpl = fetch }: { idempotencyKey?: string; fetchImpl?: typeof fetch } = {},
): Promise<T> {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new StripeError(503, 'not_configured', 'STRIPE_SECRET_KEY is not set')
  const body = formEncode(params)
  const url = method === 'GET' && body ? `${API}${path}?${body}` : `${API}${path}`
  const res = await fetchImpl(url, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      'Stripe-Version': STRIPE_VERSION,
      ...(method === 'POST' && { 'Content-Type': 'application/x-www-form-urlencoded' }),
      ...(idempotencyKey && { 'Idempotency-Key': idempotencyKey }),
    },
    ...(method === 'POST' && { body }),
  })
  const json = (await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string } }
  if (!res.ok) throw new StripeError(res.status, json.error?.code ?? 'stripe_error', json.error?.message ?? `HTTP ${res.status}`)
  return json as T
}

/**
 * Verifies a `Stripe-Signature` header (t=…,v1=…): HMAC-SHA256 of `${t}.${body}` with the endpoint
 * secret, within five minutes. Any matching v1 passes (Stripe sends several while a secret rolls).
 */
export function verifyStripeSignature(body: string, header: string | null, secret: string, now = Date.now(), toleranceSec = 300): boolean {
  if (!header || !secret) return false
  const parts = header.split(',').map((p) => p.split('=') as [string, string])
  const t = Number(parts.find(([k]) => k === 't')?.[1])
  if (!Number.isFinite(t) || Math.abs(now / 1000 - t) > toleranceSec) return false
  const expected = Buffer.from(createHmac('sha256', secret).update(`${t}.${body}`).digest('hex'))
  return parts.some(([k, v]) => k === 'v1' && v?.length === expected.length && timingSafeEqual(Buffer.from(v), expected))
}

/* ── The few objects we read ─────────────────────────────────────────── */
export interface StripeSubscription {
  id: string
  customer: string
  status: string
  cancel_at_period_end: boolean
  trial_end: number | null
  current_period_end?: number // pre-2025-03 API versions
  metadata: Record<string, string>
  items: { data: Array<{ id: string; quantity?: number; current_period_end?: number; price: { id: string } }> }
}
