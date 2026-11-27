'use client'

import { motion } from 'framer-motion'

const RULES = [
  'Schedule a meeting to plan the meeting',
  'Ask you to fill in 14 Jira fields “for reporting”',
  'Assign work to whoever happens to be online',
  'Mark a ticket “done” because the PR merged',
  'Make a risky call and hope nobody notices',
]

/** Things the agent refuses to do, crossed out by hand as they scroll in. */
export function HouseRules() {
  return (
    <div className="grid gap-8 md:grid-cols-[0.8fr_1.2fr] md:items-start">
      <div>
        <p className="font-hand text-2xl text-ink-2 -rotate-2">House rules.</p>
        <h2 className="display-md mt-2 text-ink">Things the agent <span className="text-esc-accent">refuses</span> to do</h2>
      </div>
      <ul className="divide-y divide-line-soft border-y border-line-soft">
        {RULES.map((r, i) => (
          <li key={r} className="relative py-4 text-lg text-ink-2 sm:text-xl">
            <span className="relative inline-block">
              {r}
              <motion.span aria-hidden
                className="pointer-events-none absolute -left-[2%] top-[55%] h-[2px] w-[104%] origin-left rounded-full bg-esc-accent"
                style={{ rotate: i % 2 ? '-0.8deg' : '0.6deg' }}
                initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.45, delay: 0.12 * i, ease: [0.6, 0, 0.3, 1] }} />
            </span>
            <span className="sr-only"> (it won’t)</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
