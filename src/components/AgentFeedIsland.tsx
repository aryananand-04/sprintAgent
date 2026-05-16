import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { motion, AnimatePresence, type Transition } from 'framer-motion'
import { X, Bot, Zap, AlertTriangle, Activity, TrendingUp, Plus, CheckCircle, ArrowRight } from 'lucide-react'
import { useSprintStore } from '../store/useSprintStore'
import type { FeedEvent } from '../types'

/* ── Shared animation config (matches DynamicIslandTOC) ── */
const islandTransition: Transition = {
  type: 'tween',
  ease: [0.22, 1, 0.36, 1],
  duration: 0.5,
}

/* ── Sprint progress ring ── */
function SprintRing({ pct }: { pct: number }) {
  const size = 22
  const sw = 2.5
  const r = (size - sw) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(9,9,11,0.12)" strokeWidth={sw} />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke="var(--act)" strokeWidth={sw}
        strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      />
    </svg>
  )
}

/* ── Event type config ── */
const EVENT_META: Record<FeedEvent['type'], { tag: string; color: string; icon: React.ElementType }> = {
  assign:  { tag: 'ASSIGN',  color: 'var(--act)',  icon: ArrowRight    },
  escalate:{ tag: 'ESC',     color: 'var(--crit)', icon: AlertTriangle },
  triage:  { tag: 'TRIAGE',  color: 'var(--t2)',   icon: Activity      },
  status:  { tag: 'STATUS',  color: 'var(--t3)',   icon: Bot           },
  risk:    { tag: 'RISK',    color: 'var(--warn)', icon: TrendingUp    },
  adHoc:   { tag: 'ADHOC',   color: 'var(--t2)',   icon: Plus          },
  resolve: { tag: 'RESOLVE', color: 'var(--ok)',   icon: CheckCircle   },
  intake:  { tag: 'INTAKE',  color: 'var(--act)',  icon: Zap           },
}

function formatTime(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'now'
  if (m < 60) return `${m}m`
  return `${Math.floor(m / 60)}h`
}

/* ── Feed item row (expanded state) ── */
function FeedRow({ event, isLatest }: { event: FeedEvent; isLatest: boolean }) {
  const meta = EVENT_META[event.type]
  const Icon = meta.icon
  const isEsc = event.type === 'escalate'
  const isResolve = event.type === 'resolve'
  const isAssign = event.type === 'assign'
  const isRisk = event.type === 'risk'

  const leftBorder =
    isEsc     ? '2px solid rgba(174,42,25,0.55)' :
    isResolve ? '2px solid rgba(33,110,78,0.50)'  :
    isAssign  ? '2px solid rgba(12,102,228,0.40)'  :
    isRisk    ? '2px solid rgba(151,68,0,0.45)'    :
                '2px solid transparent'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: isLatest ? 0 : 8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: isLatest ? 0.06 : 0.18, ease: [0.16, 1, 0.3, 1] }}
      style={{
        display: 'flex', alignItems: 'baseline', gap: 8,
        padding: '6px 12px 6px 10px',
        borderBottom: '1px solid rgba(9,9,11,0.05)',
        background: isEsc ? 'rgba(174,42,25,0.04)' : isLatest ? 'rgba(12,102,228,0.03)' : 'transparent',
        borderLeft: leftBorder,
      }}
    >
      {/* Event type tag */}
      <span style={{
        fontSize: 8, fontWeight: 900, letterSpacing: '0.08em',
        fontFamily: 'JetBrains Mono, monospace',
        color: meta.color, minWidth: 40, flexShrink: 0,
        textTransform: 'uppercase', paddingTop: 1,
      }}>
        {meta.tag}
      </span>

      {/* Message */}
      <p style={{
        fontSize: 11, flex: 1, minWidth: 0, lineHeight: 1.5, margin: 0,
        color: isEsc ? 'var(--t1)' : 'var(--t2)',
        fontWeight: isEsc ? 500 : 400,
        overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box',
        WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
      }}>
        {event.message}
      </p>

      {/* Time */}
      <span style={{
        fontSize: 9, color: 'var(--t3)', flexShrink: 0,
        fontFamily: 'JetBrains Mono, monospace', paddingTop: 1,
      }}>
        {formatTime(event.timestamp)}
      </span>
    </motion.div>
  )
}

/* ── Main floating island ── */
export function AgentFeedIsland({ hideIsland = false }: { hideIsland?: boolean }) {
  const { feed, sprint, escalations, actionHistory, undoLastAgentAction } = useSprintStore()
  const [isExpanded, setIsExpanded] = useState(false)
  const [feedFilter, setFeedFilter] = useState<'all' | 'ACT' | 'ASK' | 'ESCALATE'>('all')
  const feedListRef = useRef<HTMLDivElement>(null)

  const filteredFeed = feedFilter === 'all' ? feed : feed.filter(e => e.decision === feedFilter)
  const latestId = feed[0]?.id

  // Scroll to top synchronously (before paint) when expanding or new event arrives
  useLayoutEffect(() => {
    if (isExpanded && feedListRef.current) {
      feedListRef.current.scrollTop = 0
    }
  }, [isExpanded, latestId])

  const pct = Math.round((sprint.completedPoints / sprint.committedPoints) * 100)
  const latest = feed[0]
  // Count UNRESOLVED escalations — goes up when new ones appear, down when resolved
  const escCount = escalations.filter(e => !e.resolved).length

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={islandTransition}
            style={{
              position: 'fixed', inset: 0, zIndex: 9998,
              background: 'rgba(9,9,11,0.22)',
              backdropFilter: 'blur(4px)',
            }}
            onClick={() => { setIsExpanded(false); setFeedFilter('all') }}
          />
        )}
      </AnimatePresence>

      {/* Island — hidden smoothly when Agent Settings is open */}
      <AnimatePresence>
      {!hideIsland && (
      <motion.div
        initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        exit={{ y: 16, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 26, delay: hideIsland ? 0 : 0.2 }}
        style={{ position: 'fixed', bottom: 24, left: '50%', x: '-50%', zIndex: 9999 }}
      >
        <motion.div
          onClick={() => { if (!isExpanded) { setIsExpanded(true); setFeedFilter('all') } }}
          initial={false}
          animate={{
            width: isExpanded ? Math.min(360, window.innerWidth - 16) : Math.min(300, window.innerWidth - 16),
            height: isExpanded ? 420 : 50,
            borderRadius: isExpanded ? 20 : 25,
          }}
          transition={islandTransition}
          style={{
            position: 'relative', overflow: 'hidden',
            cursor: isExpanded ? 'default' : 'pointer',
            background: 'var(--card)',
            border: '1px solid var(--b2)',
            boxShadow: '0 8px 32px rgba(9,9,11,0.18), 0 2px 8px rgba(9,9,11,0.10)',
          }}
        >

          {/* ── PILL STATE ── */}
          <motion.div
            initial={false}
            animate={{
              opacity: isExpanded ? 0 : 1,
              scale: isExpanded ? 0.95 : 1,
              filter: isExpanded ? 'blur(4px)' : 'blur(0px)',
            }}
            transition={{ ...islandTransition, delay: isExpanded ? 0 : 0.1 }}
            style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px',
              pointerEvents: isExpanded ? 'none' : 'auto',
            }}
          >
            {/* Live dot */}
            <div data-tour-step="3" style={{
              width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
              background: 'var(--ok)', animation: 'pulseDot 2.4s ease-in-out infinite',
            }} />

            {/* Latest event text */}
            <div style={{ flex: 1, overflow: 'hidden', position: 'relative', height: '100%', display: 'flex', alignItems: 'center' }}>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={latest?.id || 'empty'}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  style={{
                    fontSize: 12, fontWeight: 500, color: 'var(--t1)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    display: 'block', width: '100%', letterSpacing: '-0.008em',
                  }}
                >
                  {latest
                    ? latest.message.slice(0, 48) + (latest.message.length > 48 ? '…' : '')
                    : 'Agent standing by'}
                </motion.span>
              </AnimatePresence>
            </div>

            {/* Escalation badge */}
            {escCount > 0 && (
              <motion.span
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 18 }}
                style={{
                  fontSize: 8, fontWeight: 900, padding: '2px 5px', borderRadius: 3,
                  background: 'rgba(174,42,25,0.12)', border: '1px solid rgba(174,42,25,0.28)',
                  color: 'var(--esc-t)', fontFamily: 'JetBrains Mono, monospace',
                  letterSpacing: '0.06em', flexShrink: 0,
                }}
              >
                {escCount} ESC
              </motion.span>
            )}

            {/* Sprint progress ring */}
            <SprintRing pct={pct} />
          </motion.div>

          {/* ── EXPANDED STATE ── */}
          <motion.div
            initial={false}
            animate={{ opacity: isExpanded ? 1 : 0, scale: isExpanded ? 1 : 1.04 }}
            transition={{ ...islandTransition, delay: isExpanded ? 0.1 : 0 }}
            style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column',
              pointerEvents: isExpanded ? 'auto' : 'none',
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 16px 10px', flexShrink: 0,
              borderBottom: '1px solid var(--b1)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ok)', animation: 'pulseDot 2.4s ease-in-out infinite' }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--t1)', letterSpacing: '-0.012em' }}>Agent Feed</span>
                {feed.length > 0 && (
                  <span style={{ fontSize: 9, color: 'var(--t3)', fontFamily: 'JetBrains Mono, monospace' }}>{feed.length}</span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {escCount > 0 && (
                  <span style={{
                    fontSize: 8, fontWeight: 900, padding: '2px 5px', borderRadius: 3,
                    background: 'rgba(174,42,25,0.10)', border: '1px solid rgba(174,42,25,0.28)',
                    color: 'var(--esc-t)', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.06em',
                  }}>
                    {escCount} ESC
                  </span>
                )}
                {actionHistory.length > 0 && (
                  <button
                    onClick={e => { e.stopPropagation(); undoLastAgentAction() }}
                    title="Undo last agent action"
                    style={{
                      fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 3,
                      background: 'var(--s2)', border: '1px solid var(--b2)',
                      color: 'var(--t2)', cursor: 'pointer', fontFamily: 'Outfit, sans-serif',
                      transition: 'all 0.1s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--b3)'; e.currentTarget.style.color = 'var(--t1)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--b2)'; e.currentTarget.style.color = 'var(--t2)' }}
                  >
                    ↩ Undo
                  </button>
                )}
                <button
                  onClick={e => { e.stopPropagation(); setIsExpanded(false); setFeedFilter('all') }}
                  style={{
                    color: 'var(--t3)', background: 'transparent', border: 'none',
                    cursor: 'pointer', display: 'flex', padding: 3, borderRadius: 4,
                    transition: 'color 0.1s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--t1)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--t3)')}
                >
                  <X size={15} strokeWidth={1.5} />
                </button>
              </div>
            </div>

            {/* Sprint progress bar */}
            <div style={{ padding: '8px 16px 0', flexShrink: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 9, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
                  {sprint.name}
                </span>
                <span style={{ fontSize: 9, color: 'var(--t3)', fontFamily: 'JetBrains Mono, monospace' }}>
                  {sprint.completedPoints}/{sprint.committedPoints}pt · {pct}%
                </span>
              </div>
              <div style={{ height: 2, background: 'var(--s4)', borderRadius: 2, overflow: 'hidden' }}>
                <motion.div
                  style={{ height: '100%', borderRadius: 2, background: 'var(--act)' }}
                  initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                />
              </div>
            </div>

            {/* Fix #10: filter chips */}
            <div style={{ display: 'flex', gap: 5, padding: '8px 16px 0', flexShrink: 0 }}>
              {(['all', 'ACT', 'ASK', 'ESCALATE'] as const).map(f => {
                const active = feedFilter === f
                const color = f === 'ACT' ? 'var(--act)' : f === 'ASK' ? 'var(--warn)' : f === 'ESCALATE' ? 'var(--crit)' : 'var(--t2)'
                const count = f === 'all' ? feed.length : feed.filter(e => e.decision === f).length
                return (
                  <button
                    key={f}
                    onClick={e => { e.stopPropagation(); setFeedFilter(f) }}
                    style={{
                      padding: '2px 7px', borderRadius: 4, border: '1px solid',
                      fontSize: 9, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.04em',
                      fontFamily: 'JetBrains Mono, monospace',
                      background: active ? color : 'transparent',
                      borderColor: active ? color : 'var(--b2)',
                      color: active ? '#fff' : 'var(--t3)',
                      transition: 'all 0.12s',
                    }}
                  >
                    {f === 'all' ? `ALL ${count}` : `${f} ${count}`}
                  </button>
                )
              })}
            </div>

            {/* Feed log — keyed by filter so list remounts cleanly on filter change */}
            <div ref={feedListRef} key={feedFilter} style={{ flex: 1, overflowY: 'auto', marginTop: 6 }}>
              {feed.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 16px', gap: 8 }}>
                  <Bot size={20} style={{ color: 'var(--t3)' }} strokeWidth={1.5} />
                  <p style={{ fontSize: 11, color: 'var(--t3)', textAlign: 'center', margin: 0 }}>
                    No events yet. Trigger a scenario to start.
                  </p>
                </div>
              ) : filteredFeed.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 16px', gap: 6 }}>
                  <p style={{ fontSize: 11, color: 'var(--t3)', textAlign: 'center', margin: 0 }}>
                    No <strong style={{ color: 'var(--foreground)' }}>{feedFilter}</strong> decisions in feed yet.
                  </p>
                  <button
                    onClick={e => { e.stopPropagation(); setFeedFilter('all') }}
                    style={{ fontSize: 10, color: 'var(--act)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Show all
                  </button>
                </div>
              ) : (
                filteredFeed.map((event) => (
                  <FeedRow key={event.id} event={event} isLatest={event.id === latestId} />
                ))
              )}
            </div>
          </motion.div>
        </motion.div>
      </motion.div>
      )}
      </AnimatePresence>
    </>
  )
}
