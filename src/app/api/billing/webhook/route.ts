// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { createAdminClient } from '@/lib/supabase/admin'
import { syncSubscription } from '@/server/billing/plan'
import { verifyStripeSignature } from '@/server/billing/stripe'

const SUBSCRIPTION_EVENTS = new Set([
  'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted',
  'customer.subscription.paused', 'customer.subscription.resumed', 'customer.subscription.trial_will_end',
])

/**
 * Stripe webhooks. The event only says which subscription changed; its state is read back from Stripe,
 * so replays and out-of-order deliveries settle on the truth. A non-2xx makes Stripe retry.
 */
export async function POST(req: Request): Promise<Response> {
  const body = await req.text()
  if (!verifyStripeSignature(body, req.headers.get('stripe-signature'), process.env.STRIPE_WEBHOOK_SECRET ?? '')) {
    return Response.json({ error: 'BAD_SIGNATURE' }, { status: 400 })
  }
  const event = JSON.parse(body) as { type: string; data: { object: { id?: string; object?: string; subscription?: string | null; mode?: string } } }
  const o = event.data?.object ?? {}
  const sub = SUBSCRIPTION_EVENTS.has(event.type) ? o.id
    : event.type === 'checkout.session.completed' && o.mode === 'subscription' ? o.subscription
    : null
  if (!sub) return Response.json({ ok: true, ignored: event.type })
  try {
    return Response.json({ ok: true, result: await syncSubscription(createAdminClient(), sub) })
  } catch (e) {
    console.error('[billing/webhook]', event.type, e instanceof Error ? e.message : e)
    return Response.json({ error: 'SYNC_FAILED' }, { status: 500 })
  }
}
