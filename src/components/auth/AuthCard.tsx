import Link from 'next/link'
import { Logo } from '@/components/marketing/primitives'
import { ClayFunnel } from '@/components/marketing/clay'

export function AuthCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh bg-paper font-display text-ink lg:grid-cols-[1fr_1.05fr]">
      <div className="flex flex-col px-4 py-6 sm:px-10">
        <Link href="/" aria-label="Sprint Agent home" className="self-start rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-agent-accent">
          <Logo />
        </Link>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <h1 className="display-md text-ink">{title}</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-mute">{subtitle}</p>
          <div className="mt-10">{children}</div>
        </div>
      </div>
      <aside aria-hidden className="grain m-2 hidden flex-col justify-between rounded-[2rem] bg-agent-tint p-10 lg:flex">
        <p className="display-sm max-w-sm text-agent-ink">
          It handles the routine middle of the sprint. <span className="text-agent-accent">You decide the edges.</span>
        </p>
        <ClayFunnel className="mx-auto h-auto w-full max-w-[460px]" />
        <p className="text-sm text-agent-ink/70">Every agent decision is logged, explained and reversible.</p>
      </aside>
    </main>
  )
}

export const inputClass =
  'w-full rounded-xl bg-paper-2 px-3.5 py-2.5 text-[15px] text-ink ring-1 ring-inset ring-line placeholder:text-mute ' +
  'focus:outline-none focus:ring-2 focus:ring-agent-accent disabled:opacity-60'

export const primaryButtonClass =
  'w-full rounded-xl bg-ink px-3.5 py-2.5 text-[15px] font-medium text-paper transition-colors ' +
  'hover:bg-ink-2 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-agent-accent focus-visible:ring-offset-2 focus-visible:ring-offset-paper'

export const secondaryButtonClass =
  'flex w-full items-center justify-center gap-2 rounded-xl bg-paper px-3.5 py-2.5 text-[15px] font-medium text-ink ring-1 ring-inset ring-line ' +
  'transition-colors hover:bg-paper-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-agent-accent'
