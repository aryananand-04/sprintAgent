// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { useEffect, useState } from 'react'
import { PLAN_NAMES, TRIAL_DAYS, usageLine, type PaidPlan, type Plan } from '../../logic/billing'

interface Billing {
  plan: Plan
  status: string
  trialEndsAt: string | null
  trialUsed: boolean
  renewsAt: string | null
  cancelAtPeriodEnd: boolean
  hasCustomer: boolean
  billingEnabled: boolean
  ai: { used: number; limit: number | null }
  contributors: { active: number; limit: number | null }
  integrations: { connected: string[]; limit: number | null }
}

const day = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
const lim = (n: number | null) => n ?? Infinity

function statusLine(b: Billing): string {
  if (b.plan === 'enterprise') return 'Set by your contract.'
  if (b.plan === 'free') return 'Rule-based triage, one connected tool, up to five active contributors.'
  if (b.status === 'trialing' && b.trialEndsAt) return `Trial until ${day(b.trialEndsAt)}. Add a card in Manage billing to keep it after that.`
  if (b.status === 'past_due') return 'The last payment didn’t go through. Stripe is retrying; update the card in Manage billing.'
  if (b.cancelAtPeriodEnd && b.renewsAt) return `Ends on ${day(b.renewsAt)}, then back to Free.`
  return b.renewsAt ? `Renews on ${day(b.renewsAt)}.` : ''
}

/** Plan and this month's usage (PM+); admins start a trial, upgrade or open Stripe's billing portal. */
export function BillingSettings({ isAdmin }: { isAdmin: boolean }) {
  const [b, setB] = useState<Billing | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    fetch('/api/billing').then((r) => (r.ok ? r.json() : null)).then(setB).catch(() => setB(null))
  }, [])
  if (!b) return null

  const go = async (path: string, body?: { plan: PaidPlan }) => {
    setBusy(true); setError(null)
    const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) }).catch(() => null)
    const data = await res?.json().catch(() => null) as { url?: string } | null
    if (data?.url) { window.location.assign(data.url); return }
    setError('Couldn’t reach Stripe. Try again in a moment.')
    setBusy(false)
  }
  const overContributors = b.contributors.active > lim(b.contributors.limit)
  const aiOut = b.ai.limit !== null && b.ai.limit > 0 && b.ai.used >= b.ai.limit

  return (
    <div>
      <p className="mb-1 text-xs font-bold text-foreground">Plan: {PLAN_NAMES[b.plan]}</p>
      <p className="mb-2 text-[11px] leading-relaxed text-muted-foreground">{statusLine(b)}</p>
      <dl className="mb-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[11px]">
        <dt className="text-muted-foreground">AI calls this month</dt>
        <dd className="font-mono text-foreground">{b.ai.limit === 0 ? 'Not on Free (rules only)' : usageLine(b.ai.used, lim(b.ai.limit))}</dd>
        <dt className="text-muted-foreground">Active contributors</dt>
        <dd className="font-mono text-foreground">{usageLine(b.contributors.active, lim(b.contributors.limit))}</dd>
        <dt className="text-muted-foreground">Connected tools</dt>
        <dd className="font-mono text-foreground">{usageLine(b.integrations.connected.length, lim(b.integrations.limit))}</dd>
      </dl>
      {aiOut && <p className="mb-2 text-[11px] text-muted-foreground">This month’s AI allowance is used up. Triage carries on with the rule engine until the 1st.</p>}
      {overContributors && <p className="mb-2 text-[11px] text-muted-foreground">More people are active than Free covers. Nothing stops working; Team covers everyone.</p>}

      {isAdmin && b.plan !== 'enterprise' && (b.billingEnabled ? (
        <div className="flex flex-wrap gap-1.5">
          {b.plan === 'free' && (['team', 'business'] as const).map((p) => (
            <button key={p} type="button" className="btn btn-secondary" disabled={busy} onClick={() => go('/api/billing/checkout', { plan: p })}>
              {b.trialUsed ? `Upgrade to ${PLAN_NAMES[p]}` : `Try ${PLAN_NAMES[p]} free for ${TRIAL_DAYS} days`}
            </button>
          ))}
          {b.hasCustomer && <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => go('/api/billing/portal')}>Manage billing</button>}
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">Billing isn’t set up on this server.</p>
      ))}
      {error && <p role="alert" className="mt-1 text-[11px] text-[var(--esc)]">{error}</p>}
    </div>
  )
}
