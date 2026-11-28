// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { getSession } from '@/lib/session'
import { siteOrigin } from '@/lib/origin'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadBilling } from '@/server/billing/plan'
import { stripe, stripeConfigured } from '@/server/billing/stripe'

/** Admin opens Stripe's billing portal: card, invoices, plan changes, cancelling. */
export async function POST(): Promise<Response> {
  const session = await getSession()
  if (!session?.current) return Response.json({ error: 'UNAUTHENTICATED' }, { status: 401 })
  if (session.current.role !== 'admin') return Response.json({ error: 'FORBIDDEN' }, { status: 403 })
  if (!stripeConfigured()) return Response.json({ error: 'BILLING_NOT_CONFIGURED' }, { status: 503 })
  const row = await loadBilling(createAdminClient(), session.current.workspace.id)
  if (!row?.stripe_customer_id) return Response.json({ error: 'NO_SUBSCRIPTION' }, { status: 404 })
  try {
    const p = await stripe<{ url: string }>('POST', '/billing_portal/sessions', { customer: row.stripe_customer_id, return_url: `${await siteOrigin()}/app?billing=updated` })
    return Response.json({ url: p.url })
  } catch (e) {
    console.error('[billing/portal]', e instanceof Error ? e.message : e)
    return Response.json({ error: 'STRIPE_ERROR' }, { status: 502 })
  }
}
