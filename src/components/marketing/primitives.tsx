import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MarkBadge } from '@/components/brand/LogoMarks'

export type Tone = 'act' | 'ask' | 'esc' | 'agent'

/** Static class maps so Tailwind can see every class at build time. */
export const TONE = {
  act: { tint: 'bg-act-tint', ink: 'text-act-ink', accent: 'text-act-accent', pop: 'bg-act-pop', ring: 'ring-act-accent/30', solid: 'bg-act-accent' },
  ask: { tint: 'bg-ask-tint', ink: 'text-ask-ink', accent: 'text-ask-accent', pop: 'bg-ask-pop', ring: 'ring-ask-accent/30', solid: 'bg-ask-accent' },
  esc: { tint: 'bg-esc-tint', ink: 'text-esc-ink', accent: 'text-esc-accent', pop: 'bg-esc-pop', ring: 'ring-esc-accent/30', solid: 'bg-esc-accent' },
  agent: { tint: 'bg-agent-tint', ink: 'text-agent-ink', accent: 'text-agent-accent', pop: 'bg-agent-pop', ring: 'ring-agent-accent/30', solid: 'bg-agent-accent' },
} as const satisfies Record<Tone, Record<string, string>>

/** Brand lockup: Tally mark + Lilita One wordmark. (Mark variant pending owner pick; see components/brand/LogoMarks.) */
export function Logo({ className, size = 30 }: { className?: string; size?: number }) {
  return (
    <span className={cn('inline-flex items-center gap-2 font-display text-[21px] leading-none text-ink', className)}>
      <MarkBadge size={size} />
      <span>sprint agent</span>
    </span>
  )
}

const BUTTON = {
  primary: 'bg-ink text-paper-2',
  secondary: 'bg-paper-2 text-ink',
  lime: 'bg-esc-pop text-ink',          // the loud one: tomato
  outline: 'bg-paper-2 text-ink',
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
      'group inline-flex items-center justify-center gap-2 rounded-[14px] border-[3px] border-ink font-display tracking-[0.01em]',
      'shadow-[4px_4px_0_var(--ink)] transition-[transform,box-shadow] duration-100',
      'hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0_var(--ink)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0_var(--ink)]',
      'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-agent-pop',
      size === 'md' ? 'h-11 px-4 text-[17px]' : 'h-[54px] px-6 text-xl',
      BUTTON[variant], className,
    )}>
      {children}
      {arrow && <ArrowRight size={size === 'md' ? 17 : 20} strokeWidth={3} className="transition-transform group-hover:translate-x-0.5" aria-hidden />}
    </Link>
  )
}

/** Sticker label: a tilted, outlined pill. */
export function Tag({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className={cn('inline-block -rotate-2 rounded-full border-[3px] border-ink px-3.5 py-1 font-display text-[15px] leading-none text-ink shadow-[3px_3px_0_var(--ink)]', TONE[tone].pop)}>
      {children}
    </span>
  )
}

export function Container({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('mx-auto w-full max-w-[1240px] px-4 sm:px-6 lg:px-8', className)}>{children}</div>
}

/** Section surface: tinted, ink-outlined, hard shadow. */
export function Panel({ tone, className, children, id }: { tone?: Tone; className?: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className={cn('overflow-hidden rounded-[1.5rem] border-[3px] border-ink shadow-[8px_8px_0_var(--ink)] sm:rounded-panel', tone ? TONE[tone].tint : 'bg-paper-2', className)}>
      {children}
    </section>
  )
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-medium text-mute">{children}</p>
}
