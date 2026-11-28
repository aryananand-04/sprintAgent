// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { getSession } from '@/lib/session'
import { can } from '@/lib/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadBilling, usage } from '@/server/billing/plan'
import { stripeConfigured } from '@/server/billing/stripe'

/** Plan, subscription state and this month's usage (PM+). Limits are numbers; null means no limit. */
export async function GET(): Promise<Response> {
  const session = await getSession()
  if (!session?.current) return Response.json({ error: 'UNAUTHENTICATED' }, { status: 401 })
  if (!can(session.current.role, 'task:manage')) return Response.json({ error: 'FORBIDDEN' }, { status: 403 })
  const db = createAdminClient()
  const ws = session.current.workspace.id
  const [u, b] = await Promise.all([usage(db, ws), loadBilling(db, ws)])
  const lim = (n: number) => (Number.isFinite(n) ? n : null)
  return Response.json({
    plan: u.plan,
    status: b?.status ?? 'none',
    trialEndsAt: b?.trial_ends_at ?? null,
    trialUsed: b?.trial_used ?? false,
    renewsAt: b?.current_period_end ?? null,
    cancelAtPeriodEnd: b?.cancel_at_period_end ?? false,
    seats: b?.seats ?? 0,
    hasCustomer: Boolean(b?.stripe_customer_id),
    billingEnabled: stripeConfigured(),
    ai: { used: u.ai.used, limit: lim(u.ai.limit) },
    contributors: { active: u.contributors.active, limit: lim(u.contributors.limit) },
    integrations: { connected: u.integrations.connected, limit: lim(u.integrations.limit) },
  }, { headers: { 'Cache-Control': 'no-store' } })
}
