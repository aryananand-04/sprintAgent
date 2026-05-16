import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { ArrowRight, ArrowLeft, X } from 'lucide-react'
import { useTour, TOTAL_STEPS, TOUR_VIEW } from '../hooks/useTour'
import { useSprintStore } from '../store/useSprintStore'

type Side = 'right' | 'left' | 'bottom' | 'top'

interface TourHintProps {
  step: number
  title: string
  body: string
  side?: Side
}

interface Coords { top: number; left: number }

// All layout constants in one place — change here, everything stays in sync
const PAD     = 12    // inner padding on all sides (px)
const TIP_W   = 258   // tooltip width (px)
const TIP_H   = 222   // tooltip height (px) — fixed, never changes between steps
const BTN_H   = 28    // button row height (px): 5+5 padding + ~18 content
const PBR_H   = 2     // progress bar height (px)
const PBR_GAP = 7     // gap between progress bar and buttons (px)

// Footer occupies the bottom section of the tooltip
// Layout (from bottom): PAD → buttons(BTN_H) → PBR_GAP → progress(PBR_H) → 8px gap → body
const FOOTER_H   = PBR_H + PBR_GAP + BTN_H   // = 37px
const FOOTER_BOT = PAD                        // = 12px from container bottom
const BODY_BOT   = FOOTER_BOT + FOOTER_H + 8  // = 57px from container bottom
const BODY_TOP   = PAD + 22 + 7 + 18          // badge(22) + gap(7) + title(18) = 49px from top

function getW(): number {
  return Math.min(TIP_W, window.innerWidth - 24)
}

function calcPosition(rect: DOMRect, side: Side): Coords {
  const gap = 14
  const vw  = window.innerWidth
  const vh  = window.innerHeight
  const w   = getW()

  let top: number, left: number

  switch (side) {
    case 'right':
      top  = rect.top
      left = rect.right + gap
      break
    case 'left':
      top  = rect.top
      left = rect.left - w - gap
      break
    case 'bottom':
      top  = rect.bottom + gap
      left = rect.left
      break
    case 'top':
    default:
      top  = rect.top - TIP_H - gap
      left = rect.left
      break
  }

  // Horizontal: clamp inside viewport; on small screens, centre it
  if (vw < 860) {
    left = (vw - w) / 2
  } else {
    left = Math.min(left, vw - w - 10)
    left = Math.max(left, 10)
  }

  // Vertical: clamp inside viewport; on very short screens (phones), pin near bottom
  if (vh < 600) {
    top = vh - TIP_H - 16
  } else {
    top = Math.min(top, vh - TIP_H - 10)
    top = Math.max(top, 10)
  }

  return { top, left }
}

export function TourHint({ step, title, body, side = 'bottom' }: TourHintProps) {
  const { active, step: current, next, prev, end, singleMode } = useTour()
  const setView = useSprintStore(s => s.setView)
  const nav = (view: string) => setView(view as any)

  const [coords, setCoords] = useState<Coords | null>(null)

  useEffect(() => {
    if (!active || current !== step) { setCoords(null); return }

    let cancelled = false
    let attempts  = 0

    const tryFind = () => {
      if (cancelled) return
      attempts++
      const el = document.querySelector(`[data-tour-step="${step}"]`)
      if (el) {
        const rect = el.getBoundingClientRect()
        if (rect.width > 0 || rect.height > 0) {
          setCoords(calcPosition(rect, side))
          return
        }
      }
      if (attempts < 30) setTimeout(tryFind, 100)
    }

    // 300ms gives new view time to mount even with sync AnimatePresence
    const t = setTimeout(tryFind, 300)
    return () => { cancelled = true; clearTimeout(t) }
  }, [active, current, step, side])

  if (!active || current !== step || !coords) return null

  const isLast      = step === TOTAL_STEPS
  const crossesView = !isLast && TOUR_VIEW[step + 1] !== TOUR_VIEW[step]
  const w           = getW()

  return createPortal(
    <motion.div
      key={`tour-hint-${step}`}
      initial={{ opacity: 0, y: 8, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 360, damping: 28 }}
      style={{
        // Viewport position
        position: 'fixed',
        top:  coords.top,
        left: coords.left,

        // Fixed box — never changes size between steps
        width:    w,
        height:   TIP_H,
        overflow: 'hidden',   // hard clip — nothing bleeds out

        zIndex: 99999,
        background:   'var(--card)',
        border:       '1.5px solid var(--act)',
        borderRadius: 10,
        boxShadow:    '0 12px 40px rgba(0,0,0,0.22), 0 0 0 4px rgba(12,102,228,0.08)',
        pointerEvents: 'auto',

        // Use position:relative so children with position:absolute work
        // relative to THIS box, not the viewport
      }}
    >
      {/* ── TOP SECTION: badge + close ─────────────────────────────────── */}
      <div style={{
        position: 'absolute',
        top:   PAD,
        left:  PAD,
        right: PAD,
        height: 22,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{
          fontSize: 9, fontWeight: 900, letterSpacing: '0.09em', textTransform: 'uppercase',
          fontFamily: 'JetBrains Mono, monospace',
          padding: '2px 6px', borderRadius: 4,
          background: 'var(--act-bg)', border: '1px solid var(--act-bd)', color: 'var(--act-t)',
          lineHeight: 1.5,
        }}>
          {singleMode ? 'Feature' : `${step} / ${TOTAL_STEPS}`}
        </span>
        <button
          onClick={() => end()}
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--muted-foreground)', display: 'flex', padding: 3, borderRadius: 4,
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--foreground)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted-foreground)')}
          title="Exit tour"
        >
          <X size={12} strokeWidth={1.5} />
        </button>
      </div>

      {/* ── TITLE ──────────────────────────────────────────────────────── */}
      <div style={{
        position: 'absolute',
        top:   PAD + 22 + 7,   // badge + gap
        left:  PAD,
        right: PAD,
        height: 18,             // 1 line; all titles fit in 1 line
        overflow: 'hidden',
        fontSize: 12, fontWeight: 700, color: 'var(--foreground)',
        letterSpacing: '-0.01em', lineHeight: '18px',
        whiteSpace: 'nowrap', textOverflow: 'ellipsis',
      }}>
        {title}
      </div>

      {/* ── BODY — fills the middle zone ───────────────────────────────── */}
      <div style={{
        position: 'absolute',
        top:      BODY_TOP,
        left:     PAD,
        right:    PAD,
        bottom:   BODY_BOT,
        overflow: 'hidden',
        // Soft fade so clipped text looks deliberate, not cut off
        WebkitMaskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)',
        maskImage:        'linear-gradient(to bottom, black 60%, transparent 100%)',
        fontSize: 11, color: 'var(--muted-foreground)', lineHeight: 1.65,
      }}>
        {body}
      </div>

      {/* ── FOOTER — absolutely pinned, identical Y on EVERY step ──────── */}
      <div style={{
        position: 'absolute',
        bottom: FOOTER_BOT,    // always exactly PAD from container bottom
        left:   PAD,
        right:  PAD,
        // Footer stacks: progress bar → gap → buttons
        display: 'flex',
        flexDirection: 'column',
        gap: PBR_GAP,
      }}>
        {/* Progress bar — hidden in single-step mode */}
        <div style={{ height: PBR_H, background: singleMode ? 'transparent' : 'var(--muted)', borderRadius: 2, overflow: 'hidden' }}>
          {!singleMode && <div style={{
            height: '100%', background: 'var(--act)', borderRadius: 2,
            width: `${(step / TOTAL_STEPS) * 100}%`,
            transition: 'width 0.3s ease',
          }} />}
        </div>

        {/* Buttons — always same height */}
        <div style={{ display: 'flex', gap: 6, height: BTN_H }}>
          {!singleMode && step > 1 && (
            <button
              onClick={() => prev(nav)}
              className="btn btn-secondary"
              style={{ flex: 1, height: BTN_H, padding: '0 8px', fontSize: 11, gap: 4, justifyContent: 'center' }}
            >
              <ArrowLeft size={10} strokeWidth={2} /> Back
            </button>
          )}
          <button
            onClick={() => singleMode ? end() : next(nav)}
            className="btn btn-primary"
            style={{
              flex: 2, height: BTN_H, padding: '0 10px', fontSize: 11,
              gap: 4, justifyContent: 'center',
              whiteSpace: 'nowrap', overflow: 'hidden',
            }}
          >
            {singleMode ? 'Got it' : isLast ? 'Finish' : crossesView ? `Next → ${TOUR_VIEW[step + 1]}` : 'Next'}
            {!singleMode && !isLast && <ArrowRight size={10} strokeWidth={2} />}
          </button>
        </div>
      </div>
    </motion.div>,
    document.body
  )
}
