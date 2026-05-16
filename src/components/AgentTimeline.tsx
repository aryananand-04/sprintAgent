import { motion } from 'framer-motion'
import { Clock, Zap, AlertTriangle, Activity, TrendingUp, Plus, CheckCircle, Bot, ArrowRight } from 'lucide-react'
import { useSprintStore } from '../store/useSprintStore'
import type { FeedEvent } from '../types'

const EVENT_CONFIG: Record<FeedEvent['type'], { icon: React.ElementType; color: string; label: string }> = {
  assign:  { icon: ArrowRight,    color: 'var(--act)',  label: 'Assignment' },
  escalate:{ icon: AlertTriangle, color: 'var(--crit)', label: 'Escalation' },
  triage:  { icon: Activity,      color: 'var(--act)',  label: 'Triage' },
  status:  { icon: Bot,           color: 'var(--t3)',   label: 'Status' },
  risk:    { icon: TrendingUp,    color: 'var(--warn)', label: 'Risk Flag' },
  adHoc:   { icon: Plus,          color: 'var(--t2)',   label: 'Ad-hoc' },
  resolve: { icon: CheckCircle,   color: 'var(--ok)',   label: 'Resolved' },
  intake:  { icon: Zap,           color: 'var(--act)',  label: 'Intake' },
}

const DEC_STYLE: Record<string, { color: string; bg: string; bd: string }> = {
  ACT:     { color: 'var(--act-t)', bg: 'var(--act-bg)', bd: 'var(--act-bd)' },
  ASK:     { color: 'var(--ask-t)', bg: 'var(--ask-bg)', bd: 'var(--ask-bd)' },
  ESCALATE:{ color: 'var(--esc-t)', bg: 'var(--esc-bg)', bd: 'var(--esc-bd)' },
}

function formatFullTime(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m ago`
}

export function AgentTimeline() {
  const { feed, tasks } = useSprintStore()

  const summary = {
    total: feed.length,
    act: feed.filter(e => e.decision === 'ACT').length,
    ask: feed.filter(e => e.decision === 'ASK').length,
    esc: feed.filter(e => e.decision === 'ESCALATE').length,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ flexShrink: 0, padding: '13px 18px', borderBottom: '1px solid var(--b1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <Clock size={13} style={{ color: 'var(--t2)' }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)', letterSpacing: '-0.015em' }}>Agent Timeline</span>
        </div>
        <p style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 12 }}>
          Full audit trail of every agent decision. Transparent, reviewable, accountable.
        </p>

        {/* Summary stats — inline, no nested cards */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          {[
            { label: 'Events', value: summary.total, color: 'var(--t2)' },
            { label: 'ACT', value: summary.act, color: 'var(--act-t)' },
            { label: 'ASK', value: summary.ask, color: 'var(--ask-t)' },
            { label: 'ESC', value: summary.esc, color: 'var(--esc-t)' },
          ].map((s, i, arr) => (
            <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
              <div style={{ textAlign: 'center', padding: '0 12px' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: s.color, fontFamily: 'JetBrains Mono, monospace', lineHeight: 1 }}>{s.value}</div>
                <div className="label" style={{ marginTop: 2 }}>{s.label}</div>
              </div>
              {i < arr.length - 1 && <div style={{ width: 1, height: 24, background: 'var(--b2)' }} />}
            </div>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px' }}>
        {feed.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--s2)', border: '1px solid var(--b1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={16} style={{ color: 'var(--t3)' }} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)' }}>No events yet</p>
              <p style={{ fontSize: 11, color: 'var(--t3)', marginTop: 3 }}>Trigger a scenario to see the agent's decision log</p>
            </div>
          </div>
        ) : (
          <div style={{ position: 'relative' }}>
            {/* Vertical connector */}
            <div style={{ position: 'absolute', left: 13, top: 0, bottom: 0, width: 1, background: 'var(--b2)' }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {feed.map((event, i) => {
                const cfg = EVENT_CONFIG[event.type]
                const Icon = cfg.icon
                const dec = event.decision ? DEC_STYLE[event.decision] : null
                const relatedTask = event.taskId ? tasks.find(t => t.id === event.taskId) : null
                const isEscalation = event.type === 'escalate'

                return (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.025 }}
                    style={{ display: 'flex', gap: 12, position: 'relative' }}
                  >
                    {/* Icon dot */}
                    <div style={{
                      width: 27, height: 27, borderRadius: '50%', flexShrink: 0, zIndex: 1,
                      background: isEscalation ? 'rgba(174,42,25,0.10)' : 'var(--s1)',
                      border: `1px solid ${isEscalation ? 'rgba(174,42,25,0.28)' : 'var(--b2)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 1px 3px rgba(9,9,11,0.10)',
                    }}>
                      <Icon size={11} style={{ color: cfg.color }} />
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0, paddingTop: 3 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: cfg.color }}>
                          {cfg.label}
                        </span>
                        {dec && event.decision && (
                          <span className={`chip chip-${event.decision === 'ACT' ? 'act' : event.decision === 'ASK' ? 'ask' : 'esc'}`}>
                            {event.decision === 'ESCALATE' ? 'ESC' : event.decision}
                          </span>
                        )}
                        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--t3)', fontFamily: 'JetBrains Mono, monospace' }}>
                          {formatFullTime(event.timestamp)}
                        </span>
                      </div>

                      <div style={{
                        padding: '9px 12px', borderRadius: 5, fontSize: 11,
                        color: isEscalation ? 'var(--t1)' : 'var(--t2)',
                        lineHeight: 1.6,
                        background: isEscalation ? 'rgba(174,42,25,0.05)' : 'var(--s2)',
                        border: `1px solid ${isEscalation ? 'rgba(174,42,25,0.18)' : 'var(--b1)'}`,
                        borderLeft: isEscalation ? '3px solid var(--crit)' : `1px solid ${isEscalation ? 'rgba(174,42,25,0.18)' : 'var(--b1)'}`,
                      }}>
                        {event.message}
                      </div>

                      {relatedTask && (
                        <div style={{ marginTop: 5, display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ fontSize: 9, color: 'var(--t3)' }}>Task:</span>
                          <span style={{ fontSize: 9, color: 'var(--t2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 240 }}>
                            {relatedTask.title.split(':')[0]}
                          </span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
