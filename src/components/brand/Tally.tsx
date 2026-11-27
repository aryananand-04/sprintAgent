'use client'

import { motion, useReducedMotion, type Transition } from 'framer-motion'
import { useId } from 'react'

/**
 * Tally: Sprint Agent's original mascot (© Akchhya Singh & Aryan Anand).
 * A rubber-hose clipboard with a pencil, a referee whistle and white gloves.
 * Moods map to product states:
 *   idle      waiting, waves now and then
 *   act       stamping an approval (ACT)
 *   ask       scratching its head (ASK)
 *   escalate  ringing the bell for a human (ESCALATE)
 *   nap       empty board, nothing to do
 *   cheer     sprint goal met
 */
export type TallyMood = 'idle' | 'act' | 'ask' | 'escalate' | 'nap' | 'cheer'

const INK = '#1b1b1b'
const SUN = '#ffc928'
const TOMATO = '#ff5a36'
const MINT = '#3ddc97'

// Arm rotation (degrees) around each shoulder. Right arm points right at 0; left arm points left at 0.
const POSE: Record<TallyMood, { right: number[]; left: number[]; body: number[]; dur: number }> = {
  idle: { right: [-15, -45, -15, -45, -15], left: [10], body: [0, -3, 0], dur: 2.4 },
  act: { right: [-110, -20, -20, -110], left: [10], body: [0, 2, 0, 0], dur: 1.1 },
  ask: { right: [-80, -70, -80], left: [15], body: [0, 0, 0], dur: 0.9 },
  escalate: { right: [-38, -26, -38, -26, -38], left: [20], body: [0, -2, 0, -2, 0], dur: 0.5 },
  nap: { right: [35], left: [-35], body: [0, 2, 0], dur: 3.2 },
  cheer: { right: [-62, -48, -62], left: [62, 48, 62], body: [0, -12, 0], dur: 0.8 },
}

export function Tally({ mood = 'idle', size = 160, className, title }: {
  mood?: TallyMood
  size?: number
  className?: string
  /** Accessible name; omit for decorative use. */
  title?: string
}) {
  const reduce = useReducedMotion()
  const id = useId().replace(/:/g, '')
  const p = POSE[mood]
  const loop = (dur: number): Transition => (reduce ? { duration: 0 } : { duration: dur, repeat: Infinity, ease: 'easeInOut' })
  const still = (v: number[]) => (reduce ? [v[0]] : v)
  const sleeping = mood === 'nap'

  return (
    <svg viewBox="-26 -30 212 245" width={size} height={size * (245 / 212)} className={className}
      role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <defs>
        <clipPath id={`${id}-body`}><rect x="34" y="40" width="92" height="138" rx="14" /></clipPath>
      </defs>

      {/* ground shadow */}
      <ellipse cx="80" cy="206" rx="52" ry="7" fill={INK} opacity="0.12" />

      <motion.g animate={{ y: still(p.body) }} transition={loop(p.dur)}>
        {/* legs + shoes */}
        <g fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round">
          <path d="M62 176 C 60 188, 56 194, 50 198" />
          <path d="M98 176 C 100 188, 104 194, 110 198" />
        </g>
        <ellipse cx="45" cy="200" rx="14" ry="6.5" fill={INK} />
        <ellipse cx="115" cy="200" rx="14" ry="6.5" fill={INK} />

        {/* left arm */}
        <motion.g style={{ transformBox: 'view-box', transformOrigin: '34px 118px' }} animate={{ rotate: still(p.left) }} transition={loop(p.dur)}>
          <path d="M34 118 C 14 118, 0 112, -10 100" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" />
          <circle cx="-12" cy="98" r="9" fill="#fff" stroke={INK} strokeWidth="3" />
        </motion.g>

        {/* body (clipboard) */}
        <rect x="34" y="40" width="92" height="138" rx="14" fill={SUN} stroke={INK} strokeWidth="4" />
        <g clipPath={`url(#${id}-body)`}>
          <rect x="34" y="150" width="92" height="40" fill={INK} opacity="0.06" />
          {/* tally marks on the sheet: a wink at the name */}
          <g stroke={INK} strokeWidth="3" strokeLinecap="round" opacity="0.55">
            <path d="M52 132 V 150" /><path d="M60 132 V 150" /><path d="M68 132 V 150" /><path d="M76 132 V 150" /><path d="M46 147 L 82 135" />
            <path d="M92 132 V 150" /><path d="M100 132 V 150" />
          </g>
        </g>
        {/* clip */}
        <rect x="58" y="28" width="44" height="22" rx="7" fill={INK} />
        <rect x="70" y="33" width="20" height="6" rx="3" fill="#fff" opacity="0.35" />

        {/* face */}
        {sleeping ? (
          <g fill="none" stroke={INK} strokeWidth="4" strokeLinecap="round">
            <path d="M58 84 Q 66 90 74 84" /><path d="M86 84 Q 94 90 102 84" />
          </g>
        ) : (
          <g>
            <ellipse cx="66" cy="82" rx="9.5" ry="12.5" fill="#fff" stroke={INK} strokeWidth="3" />
            <ellipse cx="94" cy="82" rx="9.5" ry="12.5" fill="#fff" stroke={INK} strokeWidth="3" />
            <motion.g animate={mood === 'ask' && !reduce ? { x: [0, 3, 0] } : undefined} transition={loop(1.6)}>
              <circle cx={mood === 'ask' ? 70 : 68} cy={mood === 'ask' ? 79 : 85} r="4.8" fill={INK} />
              <circle cx={mood === 'ask' ? 98 : 96} cy={mood === 'ask' ? 79 : 85} r="4.8" fill={INK} />
            </motion.g>
            {/* blink */}
            {!reduce && (
              <motion.g animate={{ scaleY: [0, 0, 1, 0] }} style={{ transformBox: 'view-box', transformOrigin: '80px 82px' }}
                transition={{ duration: 4, times: [0, 0.92, 0.96, 1], repeat: Infinity }}>
                <rect x="56" y="69" width="20" height="26" rx="10" fill={SUN} />
                <rect x="84" y="69" width="20" height="26" rx="10" fill={SUN} />
              </motion.g>
            )}
          </g>
        )}
        {/* mouth */}
        {mood === 'ask' ? (
          <path d="M70 108 Q 80 104 90 110" fill="none" stroke={INK} strokeWidth="4" strokeLinecap="round" />
        ) : mood === 'escalate' ? (
          <ellipse cx="80" cy="108" rx="7" ry="6" fill={INK} />
        ) : mood === 'nap' ? (
          <path d="M74 108 Q 80 111 86 108" fill="none" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
        ) : (
          <path d={mood === 'cheer' ? 'M64 102 Q 80 122 96 102 Z' : 'M66 103 Q 80 116 94 103'} fill={mood === 'cheer' ? INK : 'none'}
            stroke={INK} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        )}

        {/* whistle on a cord */}
        <path d="M44 52 Q 80 76 116 52" fill="none" stroke={INK} strokeWidth="2" opacity="0.7" />
        <g transform="translate(108 60) rotate(-20)">
          <rect x="0" y="0" width="16" height="10" rx="4" fill={MINT} stroke={INK} strokeWidth="2.5" />
          <circle cx="16" cy="5" r="3.5" fill={MINT} stroke={INK} strokeWidth="2.5" />
        </g>

        {/* pencil behind the clip */}
        <g transform="rotate(28 120 26)">
          <rect x="114" y="-2" width="11" height="44" rx="3" fill={TOMATO} stroke={INK} strokeWidth="2.5" />
          <path d="M114 42 L 119.5 53 L 125 42 Z" fill="#f5deb3" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M117.6 49 L 119.5 53 L 121.4 49 Z" fill={INK} />
        </g>

        {/* right arm (with mood prop in hand) */}
        <motion.g style={{ transformBox: 'view-box', transformOrigin: '126px 118px' }} animate={{ rotate: still(p.right) }} transition={loop(p.dur)}>
          <path d="M126 118 C 146 118, 160 112, 170 100" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" />
          {mood === 'act' && (
            <g transform="translate(164 82)">
              <rect x="0" y="0" width="16" height="12" rx="3" fill={INK} />
              <rect x="-3" y="12" width="22" height="6" rx="2" fill={MINT} stroke={INK} strokeWidth="2" />
            </g>
          )}
          {mood === 'escalate' && (
            <g transform="translate(164 74)">
              <path d="M0 18 Q 0 2 10 1 Q 20 2 20 18 Z" fill={TOMATO} stroke={INK} strokeWidth="2.5" />
              <rect x="-3" y="17" width="26" height="5" rx="2.5" fill={INK} />
            </g>
          )}
          <circle cx="172" cy="98" r="9" fill="#fff" stroke={INK} strokeWidth="3" />
        </motion.g>
      </motion.g>

      {/* mood extras floating above */}
      {mood === 'ask' && (
        <motion.text x="14" y="20" fontSize="34" fontWeight="900" fill={INK} fontFamily="var(--font-toon), system-ui"
          animate={reduce ? undefined : { y: [20, 14, 20], rotate: [0, 8, 0] }} transition={loop(1.4)}>?</motion.text>
      )}
      {mood === 'nap' && (
        <motion.text x="118" y="24" fontSize="22" fontWeight="900" fill={INK} fontFamily="var(--font-toon), system-ui"
          animate={reduce ? undefined : { opacity: [0, 1, 0], y: [26, 8, -4] }} transition={loop(2.8)}>z</motion.text>
      )}
      {mood === 'escalate' && !reduce && (
        <motion.g animate={{ opacity: [0, 1, 0] }} transition={loop(0.5)} stroke={TOMATO} strokeWidth="4" strokeLinecap="round">
          <path d="M150 40 l 8 -10" /><path d="M168 54 l 12 -4" /><path d="M136 34 l 0 -12" />
        </motion.g>
      )}
    </svg>
  )
}
