'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { TriageDemo } from './TriageDemo'
import { Tally, type TallyMood } from '@/components/brand/Tally'
import type { AgentDecision } from '@/types'

const REACTION: Record<AgentDecision, { mood: TallyMood; line: string }> = {
  ACT: { mood: 'act', line: 'Clear enough. Assigning it.' },
  ASK: { mood: 'ask', line: 'One question first.' },
  ESCALATE: { mood: 'escalate', line: 'That one needs a human.' },
}

/** The triage demo with Tally reacting to each decision. */
export function HeroDemo() {
  const [decision, setDecision] = useState<AgentDecision>('ASK')
  const r = REACTION[decision]
  return (
    <div className="relative pt-24 sm:pt-0">
      <div className="pointer-events-none absolute -top-2 right-2 z-10 flex items-end gap-2 sm:-right-6 sm:-top-28">
        <AnimatePresence mode="wait">
          <motion.p key={decision} initial={{ opacity: 0, y: 6, rotate: -2 }} animate={{ opacity: 1, y: 0, rotate: -2 }} exit={{ opacity: 0 }}
            className="mb-16 max-w-[11rem] rounded-2xl border-[3px] border-ink bg-paper-2 px-3 py-2 text-sm font-semibold text-ink shadow-[3px_3px_0_var(--ink)]"
            aria-hidden>
            {r.line}
          </motion.p>
        </AnimatePresence>
        <Tally mood={r.mood} size={118} />
      </div>
      <TriageDemo onDecision={setDecision} />
    </div>
  )
}
