// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
'use client'

import { MotionConfig, motion } from 'framer-motion'

/** Honours the OS reduced-motion setting inside framer-motion without changing markup (SSR-safe). */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>
}

/** Fades content up once as it enters the viewport. */
export function Reveal({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div className={className}
      initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, delay, ease: [0.2, 0.8, 0.2, 1] }}>
      {children}
    </motion.div>
  )
}

/** Headline whose words rise in one after another on first paint. */
export function RiseWords({ text, accent, className }: { text: string; accent: string; className?: string }) {
  const words = [...text.split(' ').map((w) => ({ w, a: false })), ...accent.split(' ').map((w) => ({ w, a: true }))]
  return (
    <h1 className={className} aria-label={`${text} ${accent}`}>
      {words.map(({ w, a }, i) => (
        <span key={i} aria-hidden>
          <span className="inline-block overflow-hidden pb-[0.08em] align-bottom">
            <motion.span className={a ? 'inline-block text-agent-accent' : 'inline-block'}
              initial={{ y: '105%' }} animate={{ y: 0 }}
              transition={{ duration: 0.7, delay: 0.08 + i * 0.06, ease: [0.2, 0.8, 0.2, 1] }}>
              {w}
            </motion.span>
          </span>
          {i < words.length - 1 && ' '}
        </span>
      ))}
    </h1>
  )
}
