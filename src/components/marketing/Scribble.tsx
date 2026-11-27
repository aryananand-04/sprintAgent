'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

const ARROWS = {
  // hand-drawn curves, each ending in a little arrowhead
  'down-right': 'M6 6 C 20 30, 40 44, 70 52 M58 44 L72 53 L60 60',
  'down-left': 'M70 6 C 56 30, 36 44, 6 52 M18 44 L4 53 L16 60',
  'right': 'M4 30 C 26 10, 50 12, 74 28 M62 20 L76 29 L64 38',
  'up-right': 'M6 56 C 22 36, 44 20, 72 10 M58 8 L73 9 L66 22',
} as const

/** A handwritten margin note from the agent, with a scribbled arrow. Decorative only. */
export function Scribble({ children, arrow = 'down-right', className, arrowClassName }: {
  children: React.ReactNode
  arrow?: keyof typeof ARROWS
  className?: string
  arrowClassName?: string
}) {
  return (
    <div aria-hidden className={cn('pointer-events-none select-none text-ink-2', className)}>
      <p className="max-w-[19rem] -rotate-3 font-hand text-[17px] leading-snug">{children}</p>
      <svg viewBox="0 0 80 64" className={cn('h-12 w-16', arrowClassName)} fill="none">
        <motion.path d={ARROWS[arrow]} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }}
          transition={{ duration: 0.9, delay: 0.4, ease: 'easeOut' }} />
      </svg>
    </div>
  )
}
