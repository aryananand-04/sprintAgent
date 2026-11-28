// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { z } from 'zod'
import { getSession } from '@/lib/session'
import { siteOrigin } from '@/lib/origin'
import { createAdminClient } from '@/lib/supabase/admin'
import { PAID_PLANS, TRIAL_DAYS } from '@/logic/billing'
import { ensureCustomer, loadBilling } from '@/server/billing/plan'
import { StripeError, priceFor, stripe, stripeConfigured } from '@/server/billing/stripe'

const Body = z.object({ plan: z.enum(PAID_PLANS) })
const LIVE = new Set(['active', 'trialing', 'past_due'])

/**
 * Admin starts a subscription in Stripe Checkout. The first one comes with a 14-day trial and no card
 * up front. A workspace that already pays changes plan in the billing portal instead, so it can never
 * hold two subscriptions.
 */
export async function POST(req: Request): Promise<Response> {
  const session = await getSession()
  if (!session?.current) return Response.json({ error: 'UNAUTHENTICATED' }, { status: 401 })
  if (session.current.role !== 'admin') return Response.json({ error: 'FORBIDDEN' }, { status: 403 })
  if (!stripeConfigured()) return Response.json({ error: 'BILLING_NOT_CONFIGURED' }, { status: 503 })
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'INVALID_REQUEST' }, { status: 400 })

  const db = createAdminClient()
  const { id: ws, name } = session.current.workspace
  const origin = await siteOrigin()
  try {
    const row = await loadBilling(db, ws)
    const customer = await ensureCustomer(db, ws, session.user.email, name)
    if (row && LIVE.has(row.status) && row.plan !== 'free') {
      const portal = await stripe<{ url: string }>('POST', '/billing_portal/sessions', { customer, return_url: `${origin}/app?billing=updated` })
      return Response.json({ url: portal.url })
    }
    const trial = !row?.trial_used
    const s = await stripe<{ url: string }>('POST', '/checkout/sessions', {
      mode: 'subscription',
      customer,
      client_reference_id: ws,
      line_items: [{ price: priceFor(parsed.data.plan), quantity: 1 }],
      subscription_data: {
        metadata: { workspace_id: ws },
        ...(trial && { trial_period_days: TRIAL_DAYS, trial_settings: { end_behavior: { missing_payment_method: 'cancel' } } }),
      },
      ...(trial && { payment_method_collection: 'if_required' }),
      allow_promotion_codes: true,
      success_url: `${origin}/app?billing=success`,
      cancel_url: `${origin}/app?billing=cancelled`,
    })
    return Response.json({ url: s.url })
  } catch (e) {
    console.error('[billing/checkout]', e instanceof Error ? e.message : e)
    return Response.json({ error: 'STRIPE_ERROR' }, { status: e instanceof StripeError && e.status < 500 ? 400 : 502 })
  }
}
