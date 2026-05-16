import { motion } from 'framer-motion'
import { Zap, Inbox, AlertTriangle, BarChart2, Shield, Clock, Activity, Flag, BookOpen, Wand2, BarChart3 } from 'lucide-react'
import { useSprintStore } from '../store/useSprintStore'
import { GaugeCircle } from './ui/GaugeCircle'
import { loadColor } from '../utils/loadColor'

const NAV = [
  { id: 'sprint',      icon: Zap,           label: 'Sprint Board' },
  { id: 'intake',      icon: Inbox,         label: 'Intake' },
  { id: 'triage',      icon: Activity,      label: 'Triage Queue' },
  { id: 'escalations', icon: AlertTriangle, label: 'Escalations' },
  { id: 'briefings',   icon: BarChart2,     label: 'Briefings' },
  { id: 'review',      icon: Flag,          label: 'Sprint Review' },
  { id: 'autonomy',    icon: Shield,        label: 'Autonomy' },
  { id: 'timeline',    icon: Clock,         label: 'Timeline' },
  { id: 'rationale',   icon: BookOpen,      label: 'Rationale' },
  { id: 'planner',     icon: Wand2,         label: 'Sprint Planner' },
  { id: 'utilization', icon: BarChart3,      label: 'Team Report' },
] as const

// Semantic avatar colors — these stay as brand colors regardless of theme
const AVATAR_BG: Record<string, string> = {
  'bg-violet-500':  '#7C3AED',
  'bg-blue-500':    '#2563EB',
  'bg-pink-500':    '#DB2777',
  'bg-emerald-500': '#059669',
  'bg-amber-500':   '#D97706',
  'bg-cyan-500':    '#06B6D4',
  'bg-rose-500':    '#F43F5E',
  'bg-indigo-500':  '#6366F1',
  'bg-teal-500':    '#14B8A6',
  'bg-orange-500':  '#F97316',
  'bg-fuchsia-500': '#D946EF',
  'bg-red-600':     '#DC2626',
  'bg-lime-500':    '#84CC16',
  'bg-sky-500':     '#0EA5E9',
  'bg-purple-400':  '#C084FC',
}

export function Sidebar({ open = true, onClose }: { open?: boolean; onClose?: () => void }) {
  const { activeView, setView, escalations, tasks, sprint, team } = useSprintStore()
  const openEsc    = escalations.filter(e => !e.resolved).length
  const inboxCount = tasks.filter(t => t.status === 'backlog').length
  // Fix #3: tasks with AI decisions that need attention (ESCALATE or ASK, not yet done/blocked)
  const triageNeedsAttention = tasks.filter(t =>
    t.status !== 'done' && t.status !== 'blocked' &&
    (t.decision === 'ESCALATE' || t.decision === 'ASK')
  ).length
  const pct        = Math.round((sprint.completedPoints / sprint.committedPoints) * 100)
  const hc         = sprint.health === 'green' ? 'var(--ok)' : sprint.health === 'yellow' ? 'var(--warn)' : 'var(--crit)'
  const daysRemaining = sprint.endDate
    ? Math.max(0, Math.ceil((new Date(sprint.endDate).getTime() - Date.now()) / 86_400_000))
    : sprint.daysRemaining

  return (
    <aside
      className={`sidebar-drawer${open ? ' open' : ''}`}
      style={{
        width: 220, flexShrink: 0, height: '100%',
        background: 'var(--muted)',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}
    >

      {/* Wordmark */}
      <div style={{
        padding: '14px 14px 12px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 6,
            background: 'var(--act)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15)',
          }}>
            <Zap size={13} color="#fff" strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)', letterSpacing: '-0.02em', lineHeight: 1 }}>
              Sprint Agent
            </div>
            <div style={{ fontSize: 9, fontFamily: 'JetBrains Mono, monospace', color: 'var(--muted-foreground)', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 2 }}>
              AI Operator
            </div>
          </div>
        </div>
      </div>

      {/* Sprint card */}
      <div style={{ padding: '10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r-card)',
          padding: '10px 12px',
          borderTop: `2px solid ${hc}`,
          boxShadow: '0 1px 3px rgba(9,9,11,0.06)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span className="label">Active Sprint</span>
            <span style={{
              fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3, letterSpacing: '0.05em',
              background: sprint.health === 'green' ? 'rgba(22,163,74,0.10)' : sprint.health === 'yellow' ? 'rgba(217,119,6,0.10)' : 'rgba(220,38,38,0.10)',
              color: hc,
            }}>
              {sprint.health === 'green' ? 'On Track' : sprint.health === 'yellow' ? 'At Risk' : 'Critical'}
            </span>
          </div>

          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', marginBottom: 9, letterSpacing: '-0.018em', lineHeight: 1.2 }}>
            {sprint.name}
          </div>

          <div className="meter" style={{ marginBottom: 6 }}>
            <motion.div className="meter-fill"
              style={{ background: hc }}
              initial={{ width: 0 }} animate={{ width: `${pct}%` }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 10, color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>
              <span style={{ color: 'var(--foreground)', fontWeight: 600 }}>{sprint.completedPoints}</span>/{sprint.committedPoints} pts
            </span>
            <span style={{ fontSize: 10, color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>
              <span style={{ color: 'var(--foreground)', fontWeight: 600 }}>{daysRemaining}</span>d left
            </span>
          </div>
        </div>
      </div>

      {/* Navigation — uses .nav-item class which respects CSS vars */}
      <nav style={{ flex: 1, overflow: 'hidden', padding: '6px', display: 'flex', flexDirection: 'column', gap: 1 }}>
        {NAV.map(item => {
          const Icon = item.icon
          const isActive = activeView === item.id
          const badge = item.id === 'escalations' ? openEsc : item.id === 'intake' ? inboxCount : item.id === 'triage' ? triageNeedsAttention : 0
          return (
            <button
              key={item.id}
              onClick={() => { setView(item.id as any); onClose?.() }}
              className={`nav-item${isActive ? ' nav-item-active' : ''}`}
            >
              <Icon size={13} style={{ flexShrink: 0 }} strokeWidth={1.5} />
              <span style={{ flex: 1, textAlign: 'left' }}>{item.label}</span>
              {badge > 0 && (
                <span style={{
                  fontSize: 10, fontWeight: 800, minWidth: 16, height: 16, borderRadius: 8,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '0 4px', flexShrink: 0,
                  fontFamily: 'JetBrains Mono, monospace',
                  background: item.id === 'escalations' ? 'var(--esc-bg)' : item.id === 'triage' ? 'rgba(217,119,6,0.10)' : 'var(--act-bg)',
                  color: item.id === 'escalations' ? 'var(--esc-t)' : item.id === 'triage' ? 'var(--warn)' : 'var(--act-t)',
                  border: `1px solid ${item.id === 'escalations' ? 'var(--esc-bd)' : item.id === 'triage' ? 'rgba(217,119,6,0.28)' : 'var(--act-bd)'}`,
                }}>{badge}</span>
              )}
            </button>
          )
        })}
      </nav>

      {/* Team load */}
      <div style={{ padding: '10px 12px 10px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <div className="label" style={{ marginBottom: 7 }}>Team</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, maxHeight: 272, overflowY: 'auto' }}>
          {team.map((m, i) => {
            const lc = loadColor(m.currentLoad)
            return (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                  background: AVATAR_BG[m.color] ?? '#2563EB',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 7, fontWeight: 800, color: '#fff',
                }}>{m.initials}</div>
                <span style={{
                  flex: 1, fontSize: 11, color: 'var(--foreground)', fontWeight: 500,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {m.name.split(' ')[0]}
                </span>
                <GaugeCircle
                  value={m.currentLoad}
                  size={28}
                  strokeWidth={2.5}
                  color={lc}
                  trackColor="var(--border)"
                  showValue={true}
                  delay={i * 0.08}
                  valueStyle={{ fontSize: 7, fontWeight: 800, color: lc }}
                />
              </div>
            )
          })}
        </div>
      </div>
    </aside>
  )
}
