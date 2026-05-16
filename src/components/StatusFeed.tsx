import { motion, AnimatePresence } from 'framer-motion'
import { Zap, AlertTriangle, Activity, TrendingUp, Plus, CheckCircle, Bot, ArrowRight } from 'lucide-react'
import { useSprintStore } from '../store/useSprintStore'
import type { FeedEvent } from '../types'

/* Operational log format — event type as short fixed tag, not circle icon */
const EVENT_TAG: Record<FeedEvent['type'], { tag: string; color: string }> = {
  assign:  { tag: 'ASSIGN',  color: 'var(--act)' },
  escalate:{ tag: 'ESC',     color: 'var(--crit)' },
  triage:  { tag: 'TRIAGE',  color: 'var(--t2)' },
  status:  { tag: 'STATUS',  color: 'var(--t3)' },
  risk:    { tag: 'RISK',    color: 'var(--warn)' },
  adHoc:   { tag: 'ADHOC',   color: 'var(--t2)' },
  resolve: { tag: 'RESOLVE', color: 'var(--ok)' },
  intake:  { tag: 'INTAKE',  color: 'var(--act)' },
}

function formatTime(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'now'
  if (m < 60) return `${m}m`
  return `${Math.floor(m / 60)}h`
}

function LogRow({ event, isLatest }: { event: FeedEvent; isLatest: boolean }) {
  const tag = EVENT_TAG[event.type]
  const isEscalation = event.type === 'escalate'
  const isResolved   = event.type === 'resolve'
  const isAssign     = event.type === 'assign'
  const isRisk       = event.type === 'risk'

  const leftBorder =
    isEscalation ? '2px solid rgba(174,42,25,0.55)' :
    isResolved   ? '2px solid rgba(33,110,78,0.50)' :
    isAssign     ? '2px solid rgba(12,102,228,0.40)' :
    isRisk       ? '2px solid rgba(151,68,0,0.45)' :
                   '2px solid transparent'

  const rowBg = isEscalation ? 'rgba(174,42,25,0.04)' : isLatest ? 'rgba(12,102,228,0.03)' : 'transparent'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 6 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
      style={{
        display: 'flex', alignItems: 'baseline', gap: 8,
        padding: '7px 12px 7px 10px',
        borderBottom: '1px solid var(--b0)',
        background: rowBg,
        borderLeft: leftBorder,
      }}
    >
      {/* Event type tag — fixed width, monospace */}
      <span style={{
        fontSize: 8, fontWeight: 900, letterSpacing: '0.08em',
        fontFamily: 'JetBrains Mono, monospace',
        color: tag.color,
        minWidth: 44, flexShrink: 0,
        textTransform: 'uppercase',
        paddingTop: 1,
      }}>
        {tag.tag}
      </span>

      {/* Message */}
      <p style={{
        fontSize: 11, color: isEscalation ? 'var(--t1)' : 'var(--t2)',
        lineHeight: 1.5, flex: 1, minWidth: 0,
        fontWeight: isEscalation ? 500 : 400,
      }}>
        {event.message}
      </p>

      {/* Timestamp — right-aligned */}
      <span style={{
        fontSize: 9, color: 'var(--t3)', flexShrink: 0,
        fontFamily: 'JetBrains Mono, monospace',
        paddingTop: 1,
      }}>
        {formatTime(event.timestamp)}
      </span>
    </motion.div>
  )
}

export function StatusFeed() {
  const { feed, escalations } = useSprintStore()
  const escCount = escalations.filter(e => !e.resolved).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ flexShrink: 0, padding: '11px 12px 8px', borderBottom: '1px solid var(--b1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div className="live-dot" />
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)', letterSpacing: '-0.015em' }}>Agent Feed</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            {escCount > 0 && (
              <span style={{
                fontSize: 8, fontWeight: 900, padding: '2px 5px', borderRadius: 3,
                background: 'rgba(174,42,25,0.10)', border: '1px solid rgba(174,42,25,0.28)',
                color: 'var(--esc-t)', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.06em',
              }}>{escCount} ESC</span>
            )}
            {feed.length > 0 && (
              <motion.span key={feed.length} initial={{ scale: 1.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                style={{ fontSize: 10, color: 'var(--t3)', fontFamily: 'JetBrains Mono, monospace' }}
              >{feed.length}</motion.span>
            )}
          </div>
        </div>
        <p style={{ fontSize: 9, color: 'var(--t3)', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          live decision log
        </p>
      </div>

      {/* Log rows */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <AnimatePresence mode="popLayout" initial={false}>
          {feed.length === 0 ? (
            <motion.div
              key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '52px 16px', gap: 10 }}
            >
              <div style={{
                width: 34, height: 34, borderRadius: '50%',
                background: 'var(--s2)', border: '1px solid var(--b1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Bot size={15} style={{ color: 'var(--t3)' }} strokeWidth={1.5} />
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 12, color: 'var(--t2)', fontWeight: 600 }}>Agent is standing by</p>
                <p style={{ fontSize: 11, color: 'var(--t3)', marginTop: 4, lineHeight: 1.5 }}>
                  Trigger a scenario to<br />see live decisions here
                </p>
              </div>
            </motion.div>
          ) : feed.map((event, i) => (
            <LogRow key={event.id} event={event} isLatest={i === 0} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
