import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ArrowLeft, ArrowRight, MapPin } from 'lucide-react'
import { useCategoryTour } from '../hooks/useCategoryTour'
import { useSprintStore } from '../store/useSprintStore'

const TIP_W = Math.min(300, window.innerWidth - 24)
const TIP_H = 230
const SIDEBAR_W = 226   // sidebar width — keep tooltips inside content area
const GAP = 14

interface Coords { top: number; left: number }

function calcPosition(rect: DOMRect, side: 'top' | 'bottom' | 'left' | 'right'): Coords {
  const vw = window.innerWidth
  const vh = window.innerHeight
  let top: number, left: number

  switch (side) {
    case 'right':
      top  = rect.top + rect.height / 2 - TIP_H / 2
      left = rect.right + GAP
      break
    case 'left':
      top  = rect.top + rect.height / 2 - TIP_H / 2
      left = rect.left - TIP_W - GAP
      break
    case 'top':
      top  = rect.top - TIP_H - GAP
      left = rect.left + rect.width / 2 - TIP_W / 2
      break
    case 'bottom':
    default:
      top  = rect.bottom + GAP
      left = rect.left + rect.width / 2 - TIP_W / 2
      break
  }

  // Keep inside viewport — never overlap sidebar
  left = Math.max(left, SIDEBAR_W + 8)
  left = Math.min(left, vw - TIP_W - 12)
  top  = Math.max(top, 12)
  top  = Math.min(top, vh - TIP_H - 12)
  return { top, left }
}

function getSelector(step: ReturnType<typeof useCategoryTour.getState>['steps'][0]) {
  if (step.featureId) return `[data-feature-id="${step.featureId}"]`
  if (step.tourStep)  return `[data-tour-step="${step.tourStep}"]`
  return null
}

export function CategoryTour() {
  const { active, categoryLabel, categoryColor, steps, index, next, prev, end } = useCategoryTour()
  const setView = useSprintStore(s => s.setView)
  const nav = (v: string) => setView(v as any)

  const [coords, setCoords] = useState<Coords | null>(null)
  const [floatMode, setFloatMode] = useState(false)

  const step = steps[index]

  useEffect(() => {
    if (!active || !step) { setCoords(null); return }

    setCoords(null)
    setFloatMode(false)

    let cancelled = false
    let attempts = 0

    const tryFind = () => {
      if (cancelled) return
      attempts++
      const selector = getSelector(step)
      if (selector) {
        const el = document.querySelector(selector)
        if (el) {
          const rect = el.getBoundingClientRect()
          if (rect.width > 0 || rect.height > 0) {
            setCoords(calcPosition(rect, step.side ?? 'bottom'))
            setFloatMode(false)
            return
          }
        }
      }
      // Fall back quickly — 8 retries × 120ms = ~1s max wait
      if (attempts < 8) {
        setTimeout(tryFind, 120)
      } else {
        setFloatMode(true)
      }
    }

    // 150ms if staying on same view, 350ms if navigating
    const prevStep = steps[index - 1]
    const needsNav = step.view && step.view !== prevStep?.view
    const t = setTimeout(tryFind, needsNav ? 350 : 150)
    return () => { cancelled = true; clearTimeout(t) }
  }, [active, index, step?.featureId, step?.tourStep])

  if (!active || steps.length === 0 || !step) return null

  const isFirst = index === 0
  const isLast  = index === steps.length - 1

  const style: React.CSSProperties = floatMode
    ? { position: 'fixed', bottom: 96, left: '50%', transform: 'translateX(-50%)' }
    : coords
    ? { position: 'fixed', top: coords.top, left: coords.left }
    : { display: 'none' }

  return createPortal(
    <AnimatePresence>
      {(floatMode || coords) && (
        <motion.div
          key={`${index}-${floatMode}`}
          initial={{ opacity: 0, y: 8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 340, damping: 28 }}
          style={{
            ...style,
            zIndex: 99998,
            width: TIP_W,
            background: 'var(--card)',
            border: `1.5px solid ${categoryColor}`,
            borderRadius: 10,
            boxShadow: `0 12px 40px rgba(0,0,0,0.22), 0 0 0 4px ${categoryColor}22`,
            overflow: 'hidden',
          }}
        >
          {/* Accent bar */}
          <div style={{ height: 3, background: categoryColor }} />

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 13px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{
                fontSize: 9, fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase',
                padding: '2px 6px', borderRadius: 4, fontFamily: 'JetBrains Mono, monospace',
                background: `${categoryColor}18`, color: categoryColor, border: `1px solid ${categoryColor}40`,
              }}>
                {categoryLabel}
              </span>
              <span style={{ fontSize: 9, color: 'var(--t3)', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
                {index + 1} / {steps.length}
              </span>
            </div>
            <button onClick={end} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', display: 'flex', padding: 3, borderRadius: 4 }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--t1)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--t3)')}>
              <X size={12} strokeWidth={1.5} />
            </button>
          </div>

          {/* Content */}
          <div style={{ padding: '9px 13px 12px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)', letterSpacing: '-0.015em', marginBottom: 5 }}>
              {step.title}
            </div>
            <p style={{ fontSize: 11, color: 'var(--t2)', lineHeight: 1.65, marginBottom: 8 }}>
              {step.desc}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 10 }}>
              <MapPin size={9} style={{ color: categoryColor, flexShrink: 0 }} strokeWidth={2} />
              <span style={{ fontSize: 10, color: categoryColor, fontWeight: 600 }}>Lives in: {step.liveIn}</span>
            </div>

            {/* Progress segments */}
            <div style={{ display: 'flex', gap: 3, marginBottom: 10 }}>
              {steps.map((_, i) => (
                <div key={i} style={{
                  height: 3, flex: 1, borderRadius: 2,
                  background: i === index ? categoryColor : 'var(--s4)',
                  transition: 'background 0.2s',
                }} />
              ))}
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 6 }}>
              {!isFirst && (
                <button onClick={() => prev(nav)} className="btn btn-secondary"
                  style={{ flex: 1, justifyContent: 'center', gap: 4, fontSize: 11, height: 28 }}>
                  <ArrowLeft size={10} strokeWidth={2} /> Back
                </button>
              )}
              <button
                onClick={() => isLast ? end() : next(nav)}
                style={{
                  flex: 2, height: 28, display: 'inline-flex', alignItems: 'center',
                  justifyContent: 'center', gap: 4, fontSize: 11, fontWeight: 700,
                  padding: '0 12px', borderRadius: 'var(--r-ui)', border: 'none',
                  cursor: 'pointer', fontFamily: 'Outfit, sans-serif', color: '#fff',
                  background: categoryColor, transition: 'filter 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.12)')}
                onMouseLeave={e => (e.currentTarget.style.filter = 'none')}
              >
                {isLast ? 'Done' : 'Next'}
                {!isLast && <ArrowRight size={10} strokeWidth={2} />}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
