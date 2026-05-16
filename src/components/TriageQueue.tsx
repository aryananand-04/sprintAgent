import { motion, AnimatePresence } from 'framer-motion'
import { Activity, Zap, HelpCircle, AlertTriangle, ChevronRight, CheckCircle } from 'lucide-react'
import { GaugeCircle } from './ui/GaugeCircle'
import { useSprintStore } from '../store/useSprintStore'
import { triageTask } from '../logic/triage'
import { findBestAssignee } from '../logic/assign'
import { loadColor } from '../utils/loadColor'

const DEC_CONFIG = {
  ESCALATE: {
    icon: AlertTriangle,
    solidColor: 'var(--crit)', textColor: 'var(--esc-t)',
    bg: 'var(--esc-bg)', bd: 'var(--esc-bd)',
    label: 'ESCALATE', description: 'Human judgment required',
    scoreColor: 'var(--crit)',
  },
  ASK: {
    icon: HelpCircle,
    solidColor: 'var(--warn)', textColor: 'var(--ask-t)',
    bg: 'var(--ask-bg)', bd: 'var(--ask-bd)',
    label: 'ASK', description: 'Requesting clarification',
    scoreColor: 'var(--warn)',
  },
  ACT: {
    icon: Zap,
    solidColor: 'var(--act)', textColor: 'var(--act-t)',
    bg: 'var(--act-bg)', bd: 'var(--act-bd)',
    label: 'ACT', description: 'Agent acts autonomously',
    scoreColor: 'var(--act)',
  },
}

const MEMBER_COLORS: Record<string, string> = {
  'bg-violet-500':  '#6D28D9', 'bg-blue-500':    '#1D4ED8',
  'bg-pink-500':    '#BE185D', 'bg-emerald-500': '#047857',
  'bg-amber-500':   '#B45309', 'bg-cyan-500':    '#0891B2',
  'bg-rose-500':    '#E11D48', 'bg-indigo-500':  '#4338CA',
  'bg-teal-500':    '#0F766E', 'bg-orange-500':  '#EA580C',
  'bg-fuchsia-500': '#C026D3', 'bg-red-600':     '#DC2626',
  'bg-lime-500':    '#65A30D', 'bg-sky-500':     '#0284C7',
  'bg-purple-400':  '#A855F7',
}

export function TriageQueue() {
  const { tasks, team, escalations, autonomyConfig, selectTask, setTriagePanelOpen, bulkAssign } = useSprintStore()
  const triageable = tasks.filter(t => t.status !== 'done' && t.status !== 'blocked')

  function taskDecision(task: typeof triageable[number]) {
    const raw = (task.decision as 'ACT' | 'ASK' | 'ESCALATE' | undefined) ?? triageTask(task, autonomyConfig).decision
    if (raw === 'ESCALATE') {
      const hasOpenEsc = escalations.some(e => e.taskId === task.id && !e.resolved)
      if (!hasOpenEsc) return 'ASK' as const
    }
    return raw
  }

  const grouped = {
    ESCALATE: triageable.filter(t => taskDecision(t) === 'ESCALATE'),
    ASK:      triageable.filter(t => taskDecision(t) === 'ASK'),
    ACT:      triageable.filter(t => taskDecision(t) === 'ACT'),
  }

  const total = triageable.length

  // Bulk assign: uses single-pass store action, not 100 sequential state updates
  const unassignedACT = grouped.ACT.filter(t => !t.assigneeId)
  const handleAssignAll = () => {
    bulkAssign(unassignedACT.map(t => t.id))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ flexShrink: 0, padding: '13px 18px', borderBottom: '1px solid var(--b1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <Activity size={13} style={{ color: 'var(--act)' }} />
          <span data-tour-step="5" style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)', letterSpacing: '-0.015em' }}>Triage Queue</span>
          <span style={{ fontSize: 10, color: 'var(--t3)', fontFamily: 'JetBrains Mono, monospace' }}>{total} tasks</span>
        </div>
        <p style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 11 }}>
          Every active task classified by AI. Click any row to open the full scoring breakdown.
        </p>

        {/* Decision summary — inline chips */}
        <div style={{ display: 'flex', gap: 6 }}>
          {(['ESCALATE', 'ASK', 'ACT'] as const).map(d => {
            const cfg = DEC_CONFIG[d]
            const Icon = cfg.icon
            const count = grouped[d].length
            return (
              <div key={d} style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '4px 9px', borderRadius: 4,
                background: cfg.bg, border: `1px solid ${cfg.bd}`,
                fontSize: 11, fontWeight: 600, color: cfg.textColor,
              }}>
                <Icon size={10} style={{ color: cfg.solidColor }} />
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontVariantNumeric: 'tabular-nums' }}>{count}</span>
                <span>{cfg.label}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Task list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {total === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 10, padding: '48px 0' }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(33,110,78,0.08)', border: '1px solid rgba(33,110,78,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Activity size={16} style={{ color: 'var(--ok)' }} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)' }}>Nothing to triage</p>
              <p style={{ fontSize: 11, color: 'var(--t3)', marginTop: 4, lineHeight: 1.5 }}>All active tasks have decisions.<br />Add a request via Intake to see triage in action.</p>
            </div>
          </div>
        )}

        {(['ESCALATE', 'ASK', 'ACT'] as const).map(decision => {
          const cfg = DEC_CONFIG[decision]
          const Icon = cfg.icon
          const group = grouped[decision]
          if (group.length === 0) return null

          const canBulkAssign = decision === 'ACT' && unassignedACT.length > 0

          return (
            <div key={decision}>
              {/* Group header — Fix #9: bulk assign button for ACT */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, padding: '0 2px' }}>
                <Icon size={11} style={{ color: cfg.solidColor, flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: cfg.textColor, letterSpacing: '-0.01em' }}>{cfg.label}</span>
                <span style={{ fontSize: 10, color: 'var(--t3)' }}>— {cfg.description}</span>
                <span style={{ marginLeft: 'auto', fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: 'var(--t3)', fontWeight: 600 }}>{group.length}</span>
                {canBulkAssign && (
                  <button
                    data-feature-id="bulk-assign-btn"
                    onClick={handleAssignAll}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '3px 8px', borderRadius: 4, cursor: 'pointer',
                      background: 'var(--act-bg)', border: '1px solid var(--act-bd)',
                      fontSize: 10, fontWeight: 700, color: 'var(--act-t)',
                      fontFamily: 'Outfit, sans-serif', transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--act)'; e.currentTarget.style.color = '#fff' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--act-bg)'; e.currentTarget.style.color = 'var(--act-t)' }}
                  >
                    <CheckCircle size={9} />
                    Assign all ({unassignedACT.length})
                  </button>
                )}
              </div>

              {/* Tasks */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {group.map((task, i) => {
                  const score = task.triageScore ?? triageTask(task, autonomyConfig).score
                  const best = decision === 'ACT' ? findBestAssignee(task, team, tasks) : null
                  const bestMember = best ? team.find(m => m.id === best.memberId) : null

                  // Fix #2: goal alignment indicator
                  const alignScore = task.goalAlignment
                  const isLowAlignment = alignScore !== undefined && alignScore <= 4

                  return (
                    <motion.div
                      key={task.id}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      onClick={() => { selectTask(task.id); setTriagePanelOpen(true) }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '9px 11px', borderRadius: 5,
                        background: 'var(--card)', border: `1px solid ${isLowAlignment ? 'rgba(217,119,6,0.28)' : 'var(--b1)'}`,
                        boxShadow: '0 1px 2px rgba(9,9,11,0.06)',
                        cursor: 'pointer', transition: 'border-color 0.1s, box-shadow 0.1s',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = isLowAlignment ? 'rgba(217,119,6,0.5)' : 'var(--b2)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 6px rgba(9,9,11,0.12)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = isLowAlignment ? 'rgba(217,119,6,0.28)' : 'var(--b1)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 2px rgba(9,9,11,0.06)' }}
                    >
                      {/* Score */}
                      {(() => {
                        const sc = score >= 70 ? 'var(--crit)' : score >= 45 ? 'var(--warn)' : 'var(--act)'
                        return (
                          <GaugeCircle
                            value={score}
                            size={36}
                            strokeWidth={3}
                            color={sc}
                            trackColor="rgba(9,9,11,0.07)"
                            showValue={true}
                            valueStyle={{ fontSize: 8, fontWeight: 800 }}
                          />
                        )
                      })()}

                      {/* Task info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--t1)', letterSpacing: '-0.008em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>
                          {task.title}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: task.urgency === 'critical' ? 'var(--crit)' : task.urgency === 'high' ? 'var(--warn)' : 'var(--t3)' }}>
                            {task.urgency}
                          </span>
                          <span style={{ color: 'var(--b3)', fontSize: 10 }}>·</span>
                          <span style={{ fontSize: 10, color: 'var(--t3)', textTransform: 'capitalize' }}>{task.type}</span>
                          {task.storyPoints && (
                            <>
                              <span style={{ color: 'var(--b3)', fontSize: 10 }}>·</span>
                              <span style={{ fontSize: 10, color: 'var(--t3)', fontFamily: 'JetBrains Mono, monospace' }}>{task.storyPoints}pt</span>
                            </>
                          )}
                          {/* Fix #2: goal alignment badge */}
                          {isLowAlignment && (
                            <span style={{
                              fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
                              background: 'rgba(217,119,6,0.10)', border: '1px solid rgba(217,119,6,0.24)',
                              color: 'var(--warn)', letterSpacing: '0.03em',
                            }}>
                              ⊘ goal {alignScore}/10
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Dimension mini-bars */}
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        {[
                          { v: task.impact ?? 3, color: 'var(--act)' },
                          { v: task.effort ?? 2, color: 'var(--warn)' },
                          { v: task.risk ?? 2,   color: 'var(--crit)' },
                        ].map(({ v, color }, idx) => (
                          <div key={idx} style={{ width: 4, height: 20, display: 'flex', flexDirection: 'column-reverse', gap: 1 }}>
                            {Array.from({ length: 5 }).map((_, j) => (
                              <div key={j} style={{ height: 2, borderRadius: 1, background: j < v ? color : 'var(--s4)' }} />
                            ))}
                          </div>
                        ))}
                      </div>

                      {/* Assignee — shows suggestion pre-assign, actual member + load post-assign */}
                      {(() => {
                        const assignedMember = task.assigneeId ? team.find(m => m.id === task.assigneeId) : null
                        if (assignedMember) {
                          const lc = loadColor(assignedMember.currentLoad)
                          return (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                              <div style={{
                                width: 18, height: 18, borderRadius: '50%',
                                background: MEMBER_COLORS[assignedMember.color] ?? '#1D4ED8',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 7, fontWeight: 800, color: '#fff',
                              }}>{assignedMember.initials}</div>
                              <GaugeCircle
                                value={assignedMember.currentLoad}
                                size={22} strokeWidth={2.5}
                                color={lc} trackColor="var(--border)" showValue={false}
                              />
                              <span style={{ fontSize: 9, color: lc, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>
                                {assignedMember.currentLoad}%
                              </span>
                            </div>
                          )
                        }
                        if (bestMember) {
                          return (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                              <span style={{ fontSize: 9, color: 'var(--t3)' }}>→</span>
                              <div style={{
                                width: 18, height: 18, borderRadius: '50%',
                                background: MEMBER_COLORS[bestMember.color] ?? '#1D4ED8',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 7, fontWeight: 800, color: '#fff',
                              }}>{bestMember.initials}</div>
                              <GaugeCircle
                                value={best?.confidence ?? 0}
                                size={22} strokeWidth={2.5}
                                color={cfg.solidColor} trackColor="var(--border)" showValue={false}
                              />
                              <span style={{ fontSize: 9, color: 'var(--t3)', fontFamily: 'JetBrains Mono, monospace' }}>{best?.confidence}%</span>
                            </div>
                          )
                        }
                        return null
                      })()}

                      <ChevronRight size={11} style={{ color: 'var(--t3)', flexShrink: 0 }} />
                    </motion.div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
