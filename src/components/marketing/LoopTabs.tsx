'use client'

import { useId, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Inbox, Filter, UserCheck, Newspaper, Bell } from 'lucide-react'
import { cn } from '@/lib/utils'

const STEPS = [
  {
    id: 'intake', icon: Inbox, title: 'Intake', blurb: 'Requests arrive from Slack, GitHub or a form, and none get lost in DMs.',
    rows: [['#checkout-team', '“Promo codes broke on iOS again?”'], ['GitHub #4421', 'Crash on apply-promo (Sentry)'], ['Form', 'Loyalty points in checkout']],
  },
  {
    id: 'triage', icon: Filter, title: 'Triage', blurb: 'Each item is scored on urgency, impact, effort, risk and clarity, then gets a decision.',
    rows: [['Crash on apply-promo', 'ACT · 84'], ['Make checkout premium', 'ASK · 41'], ['Loyalty points', 'ESCALATE · 38']],
  },
  {
    id: 'assign', icon: UserCheck, title: 'Assign', blurb: 'Clear work goes to the best-fit person who has room, with confidence shown.',
    rows: [['Crash on apply-promo', 'Arjun · 91% fit'], ['Analytics event', 'Mei · 78% fit'], ['Copy fix', 'Sam · 74% fit']],
  },
  {
    id: 'brief', icon: Newspaper, title: 'Brief', blurb: 'Each role gets a briefing written for it: team status, PM trade-offs, manager confidence.',
    rows: [['Team', '2 blocked, 1 needs review'], ['PM', '1 scope decision needed'], ['Manager', 'On pace: 82% confidence']],
  },
  {
    id: 'escalate', icon: Bell, title: 'Escalate', blurb: 'Risky or ambiguous calls go to a human with the reason and a recommendation.',
    rows: [['Loyalty points', 'Scope +8 pts → PM decides'], ['Session tokens', 'Legal sign-off needed'], ['Dev at 98% load', 'Rebalance suggested']],
  },
] as const

export function LoopTabs() {
  const [active, setActive] = useState(0)
  const reduce = useReducedMotion()
  const base = useId()
  const tabs = useRef<Array<HTMLButtonElement | null>>([])
  const step = STEPS[active]

  const onKey = (e: React.KeyboardEvent) => {
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!dir) return
    e.preventDefault()
    const next = (active + dir + STEPS.length) % STEPS.length
    setActive(next)
    tabs.current[next]?.focus()
  }

  return (
    <div>
      <div role="tablist" aria-label="The sprint loop" onKeyDown={onKey}
        className="flex gap-1 overflow-x-auto rounded-2xl bg-paper-3/70 p-1 [scrollbar-width:none]">
        {STEPS.map((s, i) => (
          <button key={s.id} ref={(el) => { tabs.current[i] = el }} role="tab" type="button"
            id={`${base}-tab-${s.id}`} aria-controls={`${base}-panel`} aria-selected={i === active} tabIndex={i === active ? 0 : -1}
            onClick={() => setActive(i)}
            className={cn('relative flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors',
              i === active ? 'text-ink' : 'text-mute hover:text-ink')}>
            {i === active && (
              <motion.span layoutId="loop-tab" className="absolute inset-0 rounded-xl bg-paper shadow-soft"
                transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }} />
            )}
            <s.icon size={15} className="relative" aria-hidden />
            <span className="relative">{i + 1}. {s.title}</span>
          </button>
        ))}
      </div>

      <div id={`${base}-panel`} role="tabpanel" aria-labelledby={`${base}-tab-${step.id}`} className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.3fr] lg:items-center">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p key={step.id} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? undefined : { opacity: 0 }}
            className="display-sm text-ink">{step.blurb}</motion.p>
        </AnimatePresence>
        <div className="rounded-3xl bg-paper p-3 shadow-soft ring-1 ring-line-soft">
          <AnimatePresence mode="wait" initial={false}>
            <motion.ul key={step.id} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={reduce ? undefined : { opacity: 0 }}
              className="divide-y divide-line-soft">
              {step.rows.map(([a, b]) => (
                <li key={a} className="flex items-center justify-between gap-4 px-3 py-3.5 text-sm">
                  <span className="truncate text-ink">{a}</span>
                  <span className="shrink-0 font-mono text-xs text-mute">{b}</span>
                </li>
              ))}
            </motion.ul>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
