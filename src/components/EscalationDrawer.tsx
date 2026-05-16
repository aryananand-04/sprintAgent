import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, CheckCircle, Clock, ChevronDown, ChevronUp, ShieldAlert } from 'lucide-react'
import { useState } from 'react'
import { useSprintStore } from '../store/useSprintStore'
import type { EscalationItem } from '../types'

const CAT_LABEL: Record<EscalationItem['category'], string> = {
  'missing-criteria': 'Missing Criteria',
  'scope-conflict':   'Scope Conflict',
  'blocker':          'Blocker',
  'capacity':         'Capacity',
  'ambiguous':        'Ambiguous',
  'stakeholder':      'Stakeholder',
}

const URG_CONFIG = {
  critical: {
    color: 'var(--crit)',
    bg: 'rgba(174,42,25,0.05)', bd: 'rgba(174,42,25,0.28)',
    topBand: '#AE2A19', leftAccent: '#AE2A19',
    badgeStyle: { background: 'var(--crit)', color: '#fff' } as React.CSSProperties,
    badgeLabel: 'CRITICAL',
  },
  high: {
    color: 'var(--warn)',
    bg: 'rgba(151,68,0,0.05)', bd: 'rgba(151,68,0,0.26)',
    topBand: '#974400', leftAccent: '#974400',
    badgeStyle: { background: 'var(--warn)', color: '#fff' } as React.CSSProperties,
    badgeLabel: 'HIGH',
  },
  medium: {
    color: 'var(--t3)', bg: 'var(--s1)', bd: 'var(--b1)', topBand: '', leftAccent: '',
    badgeStyle: { background: 'var(--s3)', color: 'var(--t3)', border: '1px solid var(--b2)' } as React.CSSProperties,
    badgeLabel: 'MED',
  },
  low: {
    color: 'var(--t3)', bg: 'var(--s1)', bd: 'var(--b1)', topBand: '', leftAccent: '',
    badgeStyle: { background: 'var(--s3)', color: 'var(--t3)', border: '1px solid var(--b2)' } as React.CSSProperties,
    badgeLabel: 'LOW',
  },
}

function formatTime(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  return m < 60 ? `${m}m ago` : `${Math.floor(m / 60)}h ago`
}

function EscCard({ esc, onResolve }: { esc: EscalationItem; onResolve: (id: string) => void }) {
  const [open, setOpen] = useState(!esc.resolved)
  const u = URG_CONFIG[esc.urgency]

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: esc.resolved ? 0.5 : 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.15 }}
      style={{
        width: '100%',
        borderRadius: 8,
        border: `1px solid ${esc.resolved ? 'var(--b1)' : u.bd}`,
        background: esc.resolved ? 'var(--s0)' : u.bg,
        overflow: 'hidden',
      }}
    >
      {/* Urgency band */}
      {!esc.resolved && u.topBand && (
        <div style={{ height: 3, background: u.topBand, width: '100%' }} />
      )}

      {/* Header row */}
      <div
        onClick={() => setOpen(v => !v)}
        style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '12px 14px', cursor: 'pointer', width: '100%', boxSizing: 'border-box' }}
      >
        <AlertTriangle
          size={12} strokeWidth={2.5}
          style={{ color: esc.resolved ? 'var(--t3)' : u.color, flexShrink: 0, marginTop: 1 }}
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Badges */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 5, marginBottom: 6 }}>
            {esc.resolved ? (
              <span style={{
                fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 3,
                letterSpacing: '0.08em', background: 'var(--ok)', color: '#fff',
                fontFamily: 'JetBrains Mono, monospace',
              }}>RESOLVED</span>
            ) : (
              <span style={{
                fontSize: 9, fontWeight: 900, letterSpacing: '0.10em',
                padding: '2px 6px', borderRadius: 3, lineHeight: 1,
                fontFamily: 'JetBrains Mono, monospace',
                ...u.badgeStyle,
              }}>{u.badgeLabel}</span>
            )}
            <span style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 500 }}>
              {CAT_LABEL[esc.category]}
            </span>
          </div>

          {/* Title — wraps naturally */}
          <p style={{
            fontSize: 12, fontWeight: 600, color: esc.resolved ? 'var(--t3)' : 'var(--t1)',
            lineHeight: 1.45, letterSpacing: '-0.01em', marginBottom: 5,
          }}>
            {esc.taskTitle}
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={9} style={{ color: 'var(--t3)' }} />
            <span style={{ fontSize: 10, color: 'var(--t3)' }}>{formatTime(esc.createdAt)}</span>
          </div>
        </div>

        <span style={{ color: 'var(--t3)', flexShrink: 0, marginTop: 1 }}>
          {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </span>
      </div>

      {/* Expanded body */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              padding: '12px 14px 14px',
              borderTop: `1px solid ${esc.resolved ? 'var(--b1)' : u.bd}`,
              display: 'flex', flexDirection: 'column', gap: 12,
              boxSizing: 'border-box', width: '100%',
            }}>
              <div>
                <p className="label" style={{ marginBottom: 5 }}>Why escalated</p>
                <p style={{ fontSize: 11, color: 'var(--t2)', lineHeight: 1.65 }}>
                  {esc.reason}
                </p>
              </div>

              <div style={{
                padding: '8px 10px', borderRadius: 5,
                background: 'var(--s0)', border: `1px solid ${esc.resolved ? 'var(--b1)' : u.bd}`,
                borderLeft: `3px solid ${u.leftAccent || 'var(--b3)'}`,
              }}>
                <p className="label" style={{ marginBottom: 4 }}>Agent recommendation</p>
                <p style={{ fontSize: 11, color: 'var(--t1)', lineHeight: 1.65, fontWeight: 500 }}>
                  {esc.recommendation}
                </p>
              </div>

              {!esc.resolved && (
                <button
                  onClick={e => { e.stopPropagation(); onResolve(esc.id) }}
                  className="btn btn-secondary"
                  style={{ width: '100%', justifyContent: 'center', color: 'var(--ok)', borderColor: 'rgba(33,110,78,0.28)' }}
                >
                  <CheckCircle size={12} />
                  Mark Resolved
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export function EscalationPanel() {
  const { escalations, resolveEscalation } = useSprintStore()
  const open = escalations.filter(e => !e.resolved)
  const resolved = escalations.filter(e => e.resolved)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ flexShrink: 0, padding: '13px 18px', borderBottom: '1px solid var(--b1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <ShieldAlert size={13} style={{ color: 'var(--esc)' }} />
          <span data-tour-step="6" style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)', letterSpacing: '-0.015em' }}>Escalations</span>
          {open.length > 0 && (
            <motion.span
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              style={{
                fontSize: 9, fontWeight: 900, padding: '2px 6px', borderRadius: 3,
                background: 'var(--crit)', color: '#fff',
                fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.06em',
              }}
            >{open.length} OPEN</motion.span>
          )}
        </div>
        <p style={{ fontSize: 11, color: 'var(--t3)' }}>Items requiring human judgment.</p>

      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 7 }}>
        {/* Fix #7: all resolved state */}
        {open.length === 0 && resolved.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '20px 0 12px' }}
          >
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'rgba(33,110,78,0.10)', border: '1px solid rgba(33,110,78,0.24)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <CheckCircle size={14} style={{ color: 'var(--ok)' }} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--ok)', letterSpacing: '-0.01em' }}>All {resolved.length} resolved</p>
              <p style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2, lineHeight: 1.5 }}>Agent is fully autonomous — no pending decisions.</p>
            </div>
          </motion.div>
        )}

        {open.length === 0 && resolved.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 11, padding: '48px 0' }}>
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
              style={{
                width: 38, height: 38, borderRadius: '50%',
                background: 'rgba(33,110,78,0.08)', border: '1px solid rgba(33,110,78,0.22)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <CheckCircle size={16} style={{ color: 'var(--ok)' }} />
            </motion.div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--t2)', letterSpacing: '-0.01em' }}>All clear</p>
              <p style={{ fontSize: 11, color: 'var(--t3)', marginTop: 3 }}>Agent is handling everything autonomously</p>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <AnimatePresence>
            {open.map(esc => <EscCard key={esc.id} esc={esc} onResolve={resolveEscalation} />)}
          </AnimatePresence>
        </div>

        {resolved.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div className="label" style={{ marginBottom: 7, paddingLeft: 2 }}>Resolved ({resolved.length})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {resolved.map(esc => <EscCard key={esc.id} esc={esc} onResolve={resolveEscalation} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
