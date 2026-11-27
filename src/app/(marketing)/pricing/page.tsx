// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import type { Metadata } from 'next'
import { Check } from 'lucide-react'
import { ButtonLink, Container, Tag } from '@/components/marketing/primitives'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Pricing · Sprint Agent',
  description: 'Free for small teams. Pay per active contributor. Viewers and stakeholders are always free.',
}

const SALES_EMAIL = process.env.NEXT_PUBLIC_SALES_EMAIL

const TIERS = [
  {
    name: 'Free', price: '$0', unit: 'forever', blurb: 'Try the agent on a real sprint.', cta: 'Start free', href: '/login',
    features: ['1 sprint board', '1 integration (GitHub or Slack)', 'Rule-based triage', 'Up to 5 active contributors'],
  },
  {
    name: 'Team', price: '$16', unit: 'per active contributor / month', blurb: 'For a team running real sprints.', cta: 'Start free trial', href: '/login', featured: true,
    features: ['Unlimited integrations', 'AI-assisted triage (usage cap)', 'Role-based briefings', 'Escalation workflow', 'Sprint history & archive'],
  },
  {
    name: 'Business', price: '$36', unit: 'per active contributor / month', blurb: 'Several teams, one standard.', cta: 'Start free trial', href: '/login',
    features: ['Everything in Team', 'Autonomy policy per task type', 'Decision audit export', 'SSO', 'Multi-team rollups'],
  },
  {
    name: 'Enterprise', price: 'Custom', unit: 'annual', blurb: 'Regulated or large organisations.', cta: SALES_EMAIL ? 'Talk to us' : 'Coming soon', href: SALES_EMAIL ? `mailto:${SALES_EMAIL}` : '#enterprise',
    features: ['Everything in Business', 'Audit log retention', 'Data residency options', 'Bring your own model key', 'SLA'],
  },
] as const

const FAQ = [
  ['Who counts as an active contributor?', 'Anyone who was assigned work or changed a task during the billing month. Viewers and stakeholders who only read briefings never count.'],
  ['Does the free plan use AI?', 'No. Free uses the deterministic rule engine, which handles the full Act / Ask / Escalate flow. AI-assisted triage starts on Team.'],
  ['Can the agent change things without us knowing?', 'Every agent decision is written to an append-only log with its reason, and every agent action can be undone.'],
  ['Can we start with our existing backlog?', 'Yes. Import from GitHub and the agent triages the backlog before it touches anything. You can also try it on a public repo right now, no signup.'],
  ['Will it replace our PM?', 'No. It replaces the parts of the PM job nobody went to PM school for: chasing updates, re-asking the same question, moving tickets between columns.'],
] as const

export default function PricingPage() {
  return (
    <Container className="pb-10 pt-12 sm:pt-20">
      <div className="max-w-2xl">
        <Tag tone="act">Pricing</Tag>
        <h1 className="display-lg mt-6 text-ink">Pay for the people it works <span className="text-act-accent">with</span>, not the people who watch</h1>
        <p className="mt-5 text-lg text-ink-2">Billed per active contributor. Viewers, stakeholders and the VP who only reads the briefing are free forever.</p>
      </div>

      <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {TIERS.map((t) => (
          <section key={t.name} id={t.name === 'Enterprise' ? 'enterprise' : undefined} aria-labelledby={`tier-${t.name}`}
            className={cn('flex scroll-mt-24 flex-col rounded-3xl p-6', 'featured' in t && t.featured ? 'bg-ink text-paper' : 'bg-paper-2 text-ink')}>
            <div className="flex items-center justify-between">
              <h2 id={`tier-${t.name}`} className="font-display text-xl font-semibold tracking-tight">{t.name}</h2>
              {'featured' in t && t.featured && <span className="rounded-full bg-act-pop px-2.5 py-1 text-[11px] font-semibold text-[#141311]">Most teams</span>}
            </div>
            <p className={cn('mt-1 text-sm', 'featured' in t && t.featured ? 'text-paper/70' : 'text-mute')}>{t.blurb}</p>
            <p className="mt-6 font-display text-4xl font-semibold tracking-tight">{t.price}</p>
            <p className={cn('text-sm', 'featured' in t && t.featured ? 'text-paper/70' : 'text-mute')}>{t.unit}</p>
            <ul className="mt-6 flex-1 space-y-2.5 text-sm">
              {t.features.map((f) => (
                <li key={f} className="flex gap-2.5"><Check size={16} className="mt-0.5 shrink-0 text-act-accent" aria-hidden />{f}</li>
              ))}
            </ul>
            <ButtonLink href={t.href} variant={'featured' in t && t.featured ? 'lime' : 'primary'} className="mt-8 w-full">{t.cta}</ButtonLink>
          </section>
        ))}
      </div>

      <section className="mt-24 grid gap-10 lg:grid-cols-[0.8fr_1.2fr]" aria-labelledby="faq">
        <h2 id="faq" className="display-md text-ink">Questions</h2>
        <div className="divide-y divide-line-soft border-y border-line-soft">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-medium text-ink">
                {q}
                <span aria-hidden className="text-xl leading-none text-mute transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-2">{a}</p>
            </details>
          ))}
        </div>
      </section>
    </Container>
  )
}
