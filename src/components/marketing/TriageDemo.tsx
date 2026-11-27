'use client'

import { useEffect, useId, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { CornerDownLeft } from 'lucide-react'
import { analyzeRequest, type TextAnalysis } from '@/logic/textSignals'
import { triageTask } from '@/logic/triage'
import type { AgentDecision, Task, TriageResult } from '@/types'
import { TONE, type Tone } from './primitives'
import { cn } from '@/lib/utils'

const EXAMPLES = [
  { label: 'VP wish', text: 'Can we make the checkout feel more premium before end of month?' },
  { label: 'Bug report', text: 'iOS app crashes when applying promo code SAVE10 at checkout. Steps to reproduce: add item, apply code, tap pay. Expected: discount applied. Sentry CHK-4421.' },
  { label: 'Blocked ask', text: 'Change how we store session tokens; this needs legal sign-off before it ships.' },
]

const LANES: Array<{ d: AgentDecision; tone: Tone; title: string; sub: string }> = [
  { d: 'ACT', tone: 'act', title: 'Act', sub: 'Assigns it now' },
  { d: 'ASK', tone: 'ask', title: 'Ask', sub: 'One sharp question' },
  { d: 'ESCALATE', tone: 'esc', title: 'Escalate', sub: 'Hands to a human' },
]

const DIMS: Array<[keyof TriageResult['dimensions'], string]> = [
  ['urgency', 'Urgency'], ['impact', 'Impact'], ['effort', 'Effort'], ['risk', 'Risk'], ['clarity', 'Clarity'],
]

interface Outcome { analysis: TextAnalysis; result: TriageResult }

function run(text: string): Outcome {
  const analysis = analyzeRequest(text)
  const task: Task = {
    ...analysis.task, id: 'demo', status: 'backlog', dependencies: [], source: 'Demo', createdAt: new Date(0).toISOString(),
  }
  return { analysis, result: triageTask(task) }
}

export function TriageDemo() {
  const [text, setText] = useState(EXAMPLES[0].text)
  const [outcome, setOutcome] = useState<Outcome>(() => run(EXAMPLES[0].text))
  const [auto, setAuto] = useState(true)
  const reduce = useReducedMotion()
  const inputId = useId()

  // Self-playing demo: type the next example, triage it, pause, repeat. Any interaction stops it for good.
  useEffect(() => {
    if (!auto || reduce) return
    let cancelled = false
    const timers: ReturnType<typeof setTimeout>[] = []
    const later = (fn: () => void, ms: number) => timers.push(setTimeout(() => { if (!cancelled) fn() }, ms))

    const play = (i: number) => {
      const target = EXAMPLES[i % EXAMPLES.length].text
      const step = Math.max(10, Math.min(22, 1400 / target.length))
      for (let n = 1; n <= target.length; n++) later(() => setText(target.slice(0, n)), n * step)
      later(() => setOutcome(run(target)), target.length * step + 250)
      later(() => play(i + 1), target.length * step + 3400)
    }
    later(() => play(1), 3200)
    return () => { cancelled = true; timers.forEach(clearTimeout) }
  }, [auto, reduce])

  const stopAuto = () => { if (auto) setAuto(false) }

  const submit = (value = text) => {
    stopAuto()
    if (!value.trim()) return
    setOutcome(run(value))
  }

  const lane = LANES.find((l) => l.d === outcome.result.decision)!

  return (
    <div className="rounded-[1.75rem] bg-paper p-4 shadow-lift ring-1 ring-line-soft sm:p-6">
      <form onSubmit={(e) => { e.preventDefault(); submit() }}>
        <div className="flex items-center justify-between gap-3">
          <label htmlFor={inputId} className="text-sm font-medium text-ink">Paste a messy request</label>
          {auto && (
            <span className="flex items-center gap-1.5 text-[11px] text-mute motion-reduce:hidden">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-act-accent opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-act-accent" />
              </span>
              Live demo. Click to try your own
            </span>
          )}
        </div>
        <div className="mt-2 rounded-2xl bg-paper-2 ring-1 ring-inset ring-line focus-within:ring-2 focus-within:ring-agent-accent">
          <textarea
            id={inputId}
            value={text}
            onChange={(e) => { stopAuto(); setText(e.target.value) }}
            onFocus={stopAuto}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit() } }}
            rows={3}
            maxLength={600}
            className="block w-full resize-none bg-transparent px-4 pt-3 text-[15px] leading-relaxed text-ink placeholder:text-mute focus:outline-none"
            placeholder="e.g. Customers say login is broken on Android since Friday"
          />
          <div className="flex flex-wrap items-center gap-2 px-3 pb-3 pt-1">
            {EXAMPLES.map((ex) => (
              <button key={ex.label} type="button" onClick={() => { setText(ex.text); submit(ex.text) }}
                className="rounded-full bg-paper px-3 py-1 text-xs font-medium text-ink-2 ring-1 ring-line transition-colors hover:bg-paper-3">
                {ex.label}
              </button>
            ))}
            <button type="submit"
              className="ml-auto inline-flex h-9 items-center gap-2 rounded-xl bg-ink px-3.5 text-sm font-medium text-paper transition-colors hover:bg-ink-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-agent-accent">
              Triage it <CornerDownLeft size={14} aria-hidden />
            </button>
          </div>
        </div>
      </form>

      {/* Lanes */}
      <div className="mt-5 grid grid-cols-3 gap-2" role="list" aria-label="Possible decisions">
        {LANES.map((l) => {
          const on = l.d === outcome.result.decision
          return (
            <div key={l.d} role="listitem" aria-current={on ? 'true' : undefined}
              className={cn('relative rounded-2xl px-3 py-2.5 transition-colors duration-300', on ? TONE[l.tone].tint : 'bg-paper-2')}>
              {on && (
                <motion.span layoutId="lane-glow" className={cn('absolute inset-0 rounded-2xl ring-2', TONE[l.tone].ring)}
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }} />
              )}
              <p className={cn('text-sm font-semibold', on ? TONE[l.tone].ink : 'text-mute')}>{l.title}</p>
              <p className="hidden text-xs text-mute sm:block">{l.sub}</p>
            </div>
          )
        })}
      </div>

      {/* Result */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={outcome.analysis.task.description + outcome.result.decision}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
          className="mt-4 rounded-2xl bg-paper-2 p-4" aria-live={auto ? 'off' : 'polite'}>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm text-ink">
              <span className={cn('font-semibold', TONE[lane.tone].accent)}>{lane.title}</span>
              <span className="text-mute"> · score {outcome.result.score}/100</span>
            </p>
            <span className="text-xs text-mute">{outcome.analysis.task.type}</span>
          </div>
          <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{outcome.result.reason}</p>

          <dl className="mt-4 grid grid-cols-5 gap-2">
            {DIMS.map(([k, label]) => (
              <div key={k}>
                <dt className="text-[11px] text-mute">{label}</dt>
                <dd className="mt-1">
                  <span className="sr-only">{outcome.result.dimensions[k]} of 5</span>
                  <span className="flex gap-0.5" aria-hidden>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <span key={i} className={cn('h-1.5 flex-1 rounded-full', i <= outcome.result.dimensions[k] ? 'bg-ink' : 'bg-line')} />
                    ))}
                  </span>
                </dd>
              </div>
            ))}
          </dl>

          {outcome.analysis.signals.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="What the agent noticed">
              {outcome.analysis.signals.slice(0, 5).map((s) => (
                <li key={s.label} className="rounded-full bg-paper px-2.5 py-1 text-[11px] text-ink-2 ring-1 ring-line">
                  {s.label} <span className="text-mute">· {s.effect}</span>
                </li>
              ))}
            </ul>
          )}
        </motion.div>
      </AnimatePresence>

      <p className="mt-3 text-[11px] text-mute">Same rule engine as the product, running in your browser. No AI call, nothing stored.</p>
    </div>
  )
}
