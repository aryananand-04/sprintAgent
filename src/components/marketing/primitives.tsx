// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CANARY } from '@/lib/provenance'

export type Tone = 'act' | 'ask' | 'esc' | 'agent'

/** Static class maps so Tailwind can see every class at build time. */
export const TONE = {
  act: { tint: 'bg-act-tint', ink: 'text-act-ink', accent: 'text-act-accent', pop: 'bg-act-pop', ring: 'ring-act-accent/30', solid: 'bg-act-accent' },
  ask: { tint: 'bg-ask-tint', ink: 'text-ask-ink', accent: 'text-ask-accent', pop: 'bg-ask-pop', ring: 'ring-ask-accent/30', solid: 'bg-ask-accent' },
  esc: { tint: 'bg-esc-tint', ink: 'text-esc-ink', accent: 'text-esc-accent', pop: 'bg-esc-pop', ring: 'ring-esc-accent/30', solid: 'bg-esc-accent' },
  agent: { tint: 'bg-agent-tint', ink: 'text-agent-ink', accent: 'text-agent-accent', pop: 'bg-agent-pop', ring: 'ring-agent-accent/30', solid: 'bg-agent-accent' },
} as const satisfies Record<Tone, Record<string, string>>

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 font-display text-[17px] font-semibold tracking-tight text-ink', className)}>
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
        <metadata>{`Sprint Agent™ mark © 2026 Akchhya Singh & Aryan Anand. ${CANARY}`}</metadata>
        <rect width="26" height="26" rx="8" className="fill-ink" />
        {/* A backlog getting shorter; the triaged item on top in the agent colour. */}
        <rect x="6" y="7" width="14" height="3" rx="1.5" fill="#2bb3a3" />
        <rect x="6" y="11.5" width="10" height="3" rx="1.5" className="fill-paper" />
        <rect x="6" y="16" width="6" height="3" rx="1.5" className="fill-paper" />
      </svg>
      Sprint Agent
    </span>
  )
}

const BUTTON = {
  primary: 'bg-ink text-paper hover:bg-ink-2',
  secondary: 'bg-paper-2 text-ink hover:bg-paper-3',
  lime: 'bg-act-pop text-[#141311] hover:brightness-95',
  outline: 'bg-paper text-ink ring-1 ring-inset ring-line hover:bg-paper-2',
} as const

export function ButtonLink({ href, variant = 'primary', size = 'md', arrow, className, children }: {
  href: string
  variant?: keyof typeof BUTTON
  size?: 'md' | 'lg'
  arrow?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <Link href={href} className={cn(
      'group inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-[background-color,filter,transform] duration-150',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-agent-accent focus-visible:ring-offset-2 focus-visible:ring-offset-paper active:scale-[0.98]',
      size === 'md' ? 'h-10 px-4 text-sm' : 'h-12 px-5 text-base',
      BUTTON[variant], className,
    )}>
      {children}
      {arrow && <ArrowRight size={size === 'md' ? 15 : 17} className="transition-transform group-hover:translate-x-0.5" aria-hidden />}
    </Link>
  )
}

/** Pill label with the stacked-disc motif. */
export function Tag({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  const t = TONE[tone]
  return (
    <span className="inline-flex items-center">
      <span className={cn('relative z-10 rounded-full px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-paper', t.solid)}>{children}</span>
      {[0.45, 0.28, 0.15].map((o, i) => (
        <span key={i} aria-hidden className={cn('-ml-3 h-7 w-7 rounded-full', t.solid)} style={{ opacity: o, zIndex: 9 - i }} />
      ))}
    </span>
  )
}

export function Container({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('mx-auto w-full max-w-[1240px] px-4 sm:px-6 lg:px-8', className)}>{children}</div>
}

/** Large rounded, tinted section surface. */
export function Panel({ tone, className, children, id }: { tone?: Tone; className?: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className={cn('grain overflow-hidden rounded-[2rem] sm:rounded-panel', tone ? TONE[tone].tint : 'bg-paper-2', className)}>
      {children}
    </section>
  )
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-medium text-mute">{children}</p>
}
