import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import { BurndownChart } from './BurndownChart'
import { Flag, TrendingUp, CheckCircle, AlertTriangle, RotateCcw, Zap, ThumbsUp, ThumbsDown, Lightbulb, Archive, Plus, X, ChevronDown, ChevronUp } from 'lucide-react'
import { useSprintStore } from '../store/useSprintStore'
import { GaugeCircle } from './ui/GaugeCircle'
import { VelocityChart } from './VelocityChart'
import { Download, RotateCcw as UndoIcon } from 'lucide-react'

function generateRetro(
  completedPct: number, blockedCount: number, escalationCount: number,
  overloadedNames: string[], spilledTasks: { title: string }[],
  doneTasks: { title: string }[],
) {
  const wentWell: string[] = []
  const didntGo: string[] = []
  const tryNext: string[] = []

  if (completedPct >= 70) wentWell.push(`Strong delivery: ${Math.round(completedPct)}% of committed scope shipped.`)
  if (doneTasks.length >= 4) wentWell.push(`${doneTasks.length} tasks completed. Team maintained consistent throughput.`)
  if (escalationCount <= 1) wentWell.push('Low escalation rate — agent handled most decisions autonomously.')
  if (blockedCount === 0) wentWell.push('Zero blocked tasks at sprint close. Dependencies resolved cleanly.')
  if (overloadedNames.length === 0) wentWell.push('Team load stayed healthy. No engineer was overextended.')
  if (wentWell.length === 0) wentWell.push('Sprint executed. Core loop (intake → triage → assign → ship) ran without major incident.')

  if (completedPct < 60) didntGo.push(`Delivery fell short: only ${Math.round(completedPct)}% of committed scope shipped.`)
  if (blockedCount >= 2) didntGo.push(`${blockedCount} tasks ended the sprint blocked. Dependency resolution took too long.`)
  if (escalationCount >= 3) didntGo.push(`${escalationCount} escalations required PM intervention. Requirements clarity was a recurring bottleneck.`)
  if (overloadedNames.length > 0) didntGo.push(`${overloadedNames.join(', ')} exceeded 85% load. Ad-hoc requests absorbed capacity without explicit trade-off decisions.`)
  if (spilledTasks.length > 0) didntGo.push(`${spilledTasks.length} task${spilledTasks.length > 1 ? 's' : ''} spilled to next sprint.`)
  if (didntGo.length === 0) didntGo.push('Spec quality was inconsistent — several tasks arrived without acceptance criteria.')

  tryNext.push('Start sprint with a clarity audit: no task enters planning without clarity ≥ 3/5.')
  if (blockedCount >= 1) tryNext.push('Assign dependency owners at sprint kickoff, not at the moment of blocking.')
  if (escalationCount >= 2) tryNext.push('Schedule a 30-min escalation retro to review each escalation for preventable patterns.')
  if (spilledTasks.length > 0) tryNext.push('Buffer 10% of sprint capacity for ad-hoc rather than fully committing.')
  tryNext.push("Tune agent autonomy thresholds based on this sprint's false positives.")

  return { wentWell, didntGo, tryNext }
}

const MEMBER_COLORS: Record<string, string> = {
  'bg-violet-500': '#6D28D9', 'bg-blue-500': '#1D4ED8',
  'bg-pink-500': '#BE185D',   'bg-emerald-500': '#047857', 'bg-amber-500': '#B45309',
}

import type { SprintArchive } from '../types'

function SprintHistorySection({ sprintHistory }: { sprintHistory: SprintArchive[] }) {
  const { openArchivedSprint, setView } = useSprintStore()
  const [expanded, setExpanded] = useState<string | null>(sprintHistory[0]?.id ?? null)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
        <Archive size={12} style={{ color: 'var(--t2)' }} strokeWidth={1.5} />
        <div className="label">Sprint History</div>
        <span style={{ fontSize: 10, color: 'var(--t3)', fontFamily: 'JetBrains Mono, monospace' }}>{sprintHistory.length} archived</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {sprintHistory.map(s => {
          const pct = Math.round((s.completedPoints / s.committedPoints) * 100)
          const hColor = s.health === 'green' ? 'var(--ok)' : s.health === 'yellow' ? 'var(--warn)' : 'var(--crit)'
          const endLabel = new Date(s.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          const startLabel = s.startDate ? new Date(s.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null
          const isOpen = expanded === s.id
          return (
            <div key={s.id} style={{ borderRadius: 6, border: '1px solid var(--b1)', background: 'var(--s0)', borderLeft: `3px solid ${hColor}`, overflow: 'hidden' }}>
              {/* Header row — always visible */}
              <div
                onClick={() => setExpanded(isOpen ? null : s.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', cursor: 'pointer' }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)', letterSpacing: '-0.01em' }}>{s.name}</span>
                    <span style={{ fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 3, background: pct >= 70 ? 'rgba(22,163,74,0.1)' : pct >= 50 ? 'rgba(217,119,6,0.1)' : 'rgba(220,38,38,0.08)', color: hColor, fontFamily: 'JetBrains Mono, monospace' }}>
                      {pct}%
                    </span>
                  </div>
                  <p style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.goal}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <span style={{ fontSize: 9, color: 'var(--t3)' }}>{startLabel ? `${startLabel} → ` : ''}{endLabel}</span>
                  {isOpen ? <ChevronUp size={11} style={{ color: 'var(--t3)' }} /> : <ChevronDown size={11} style={{ color: 'var(--t3)' }} />}
                </div>
              </div>

              {/* Expanded detail */}
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.16, ease: 'easeInOut' }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div style={{ padding: '0 12px 12px', borderTop: '1px solid var(--b1)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                        {[
                          { label: 'Delivery', value: `${pct}%`, color: hColor },
                          { label: 'Velocity', value: `${s.completedPoints}pt`, color: 'var(--act)' },
                          { label: 'Committed', value: `${s.committedPoints}pt`, color: 'var(--t2)' },
                          { label: 'Tasks done', value: `${s.doneCount}/${s.taskCount}`, color: 'var(--t2)' },
                          { label: 'Escalations', value: `${s.escalationCount}`, color: s.escalationCount >= 3 ? 'var(--crit)' : 'var(--t3)' },
                        ].map(({ label, value, color }) => (
                          <div key={label}>
                            <div style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--t3)', marginBottom: 2 }}>{label}</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color, fontFamily: 'JetBrains Mono, monospace' }}>{value}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ padding: '8px 10px', borderRadius: 5, background: 'var(--s1)', border: '1px solid var(--b1)' }}>
                        <div className="label" style={{ marginBottom: 3 }}>Sprint Goal</div>
                        <p style={{ fontSize: 11, color: 'var(--t2)', lineHeight: 1.5 }}>{s.goal}</p>
                      </div>
                      {s.snapshot ? (
                        <button
                          onClick={() => { openArchivedSprint(s.id); setView('sprint') }}
                          className="btn btn-primary"
                          style={{ width: '100%', justifyContent: 'center', gap: 5 }}
                        >
                          <Zap size={11} /> Open Sprint — restore all tasks &amp; data
                        </button>
                      ) : (
                        <p style={{ fontSize: 10, color: 'var(--t3)', fontStyle: 'italic' }}>
                          Summary only — this sprint was seeded before snapshot storage was added.
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function SprintReview() {
  const { tasks, sprint, team, escalations, sprintHistory, archiveSprint, startNewSprint, setView, exportToCSV, undoLastAgentAction, actionHistory } = useSprintStore()
  const [showNewSprint, setShowNewSprint] = useState(false)
  const nextNum = parseInt(sprint.name.replace(/\D/g, '') || '23') + 1
  const nextStart = new Date().toISOString().slice(0, 10)
  const nextEnd = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10)
  const [newName, setNewName] = useState(`Sprint ${nextNum}`)
  const [newGoal, setNewGoal] = useState('')
  const [newStart, setNewStart] = useState(nextStart)
  const [newEnd, setNewEnd] = useState(nextEnd)
  const [newPts, setNewPts] = useState(() => sprint.velocity)
  const done = tasks.filter(t => t.status === 'done')
  const inProgress = tasks.filter(t => t.status === 'in-progress')
  const blocked = tasks.filter(t => t.status === 'blocked')
  const completedPct = Math.round((sprint.completedPoints / sprint.committedPoints) * 100)
  const openEsc = escalations.filter(e => !e.resolved)
  const overloaded = team.filter(m => m.currentLoad > 85)
  const velocityPct = Math.round((sprint.velocity / Math.max(sprint.committedPoints, 1)) * 100)

  const retro = generateRetro(
    completedPct, blocked.length, openEsc.length,
    overloaded.map(m => m.name.split(' ')[0]),
    blocked, done,
  )

  const hc = completedPct >= 70 ? 'var(--ok)' : completedPct >= 50 ? 'var(--warn)' : 'var(--crit)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ flexShrink: 0, padding: '13px 18px', borderBottom: '1px solid var(--b1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <Flag size={13} style={{ color: 'var(--act)' }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)', letterSpacing: '-0.015em' }}>Sprint Review</span>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 3, background: 'var(--act-bg)', border: '1px solid var(--act-bd)', color: 'var(--act-t)', fontFamily: 'JetBrains Mono, monospace' }}>
            {sprint.name}
          </span>
        </div>
        <p style={{ fontSize: 11, color: 'var(--t3)' }}>
          Auto-generated review: velocity, delivery summary, and retrospective insights.
        </p>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* Delivery + Velocity — circular gauges replace horizontal bars */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--b1)', paddingBottom: 16 }}>
          {/* Delivery */}
          <div style={{ flex: 1, paddingRight: 16, display: 'flex', gap: 14, alignItems: 'center' }}>
            <GaugeCircle
              value={completedPct}
              size={72}
              strokeWidth={6}
              color={hc}
              trackColor="var(--border)"
              label="%"
            />
            <div>
              <div className="label" style={{ marginBottom: 4 }}>Delivery</div>
              <div style={{ fontSize: 11, color: 'var(--t2)', lineHeight: 1.6 }}>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: hc }}>{sprint.completedPoints}pt</span> shipped
                <br />
                of <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>{sprint.committedPoints}pt</span> committed
              </div>
            </div>
          </div>

          <div style={{ width: 1, background: 'var(--b2)', flexShrink: 0, margin: '0 4px' }} />

          {/* Velocity */}
          <div style={{ flex: 1, paddingLeft: 16, display: 'flex', gap: 14, alignItems: 'center' }}>
            <GaugeCircle
              value={Math.min(velocityPct, 100)}
              size={72}
              strokeWidth={6}
              color="var(--act)"
              trackColor="var(--border)"
              label="%"
              delay={0.15}
            />
            <div>
              <div className="label" style={{ marginBottom: 4 }}>Velocity</div>
              <div style={{ fontSize: 11, color: 'var(--t2)', lineHeight: 1.6 }}>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: 'var(--act)' }}>{sprint.velocity}pt</span> / sprint
                <br />
                <span style={{ fontWeight: 600, color: velocityPct >= 100 ? 'var(--ok)' : velocityPct >= 75 ? 'var(--warn)' : 'var(--crit)' }}>
                  {velocityPct >= 100 ? 'On target' : velocityPct >= 75 ? 'Below target' : 'Off target'}
                </span>
                {' '}vs {sprint.committedPoints}pt target
              </div>
            </div>
          </div>
        </div>

        {/* Outcome summary — 4 inline stats */}
        <div>
          <div className="label" style={{ marginBottom: 10 }}>Task Outcomes</div>
          <div style={{ display: 'flex', gap: 0, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--b1)' }}>
            {[
              { label: 'Shipped', count: done.length, pts: sprint.completedPoints, color: 'var(--ok)', icon: CheckCircle },
              { label: 'In Flight', count: inProgress.length, pts: inProgress.reduce((s,t) => s+(t.storyPoints??2),0), color: 'var(--act)', icon: TrendingUp },
              { label: 'Blocked', count: blocked.length, pts: blocked.reduce((s,t) => s+(t.storyPoints??2),0), color: 'var(--crit)', icon: AlertTriangle },
              { label: 'Escalated', count: openEsc.length, pts: 0, color: 'var(--warn)', icon: Flag },
            ].map(({ label, count, pts, color, icon: Icon }, i, arr) => (
              <div key={label} style={{
                flex: 1, padding: '12px 10px', textAlign: 'center',
                borderRight: i < arr.length - 1 ? '1px solid var(--b1)' : 'none',
              }}>
                <Icon size={12} style={{ color, marginBottom: 6 }} />
                <div style={{ fontSize: 20, fontWeight: 800, color, fontFamily: 'JetBrains Mono, monospace', lineHeight: 1, marginBottom: 2 }}>{count}</div>
                <div style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 500 }}>{label}</div>
                {pts > 0 && <div style={{ fontSize: 9, color, opacity: 0.7, fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>{pts}pt</div>}
              </div>
            ))}
          </div>
        </div>

        {/* Shipped tasks */}
        {done.length > 0 && (
          <div>
            <div className="label" style={{ marginBottom: 8 }}>Shipped This Sprint ({done.length})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {done.map((task, i) => {
                const assignee = team.find(m => m.id === task.assigneeId)
                return (
                  <motion.div key={task.id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 11px', borderRadius: 5, background: 'rgba(33,110,78,0.05)', border: '1px solid rgba(33,110,78,0.18)' }}
                  >
                    <CheckCircle size={11} style={{ color: 'var(--ok)', flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: 'var(--t1)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</span>
                    {assignee && (
                      <div style={{ width: 18, height: 18, borderRadius: '50%', background: MEMBER_COLORS[assignee.color] ?? '#1D4ED8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                        {assignee.initials}
                      </div>
                    )}
                    {task.storyPoints && <span style={{ fontSize: 9, color: 'var(--ok)', fontFamily: 'JetBrains Mono, monospace', flexShrink: 0 }}>{task.storyPoints}pt</span>}
                  </motion.div>
                )
              })}
            </div>
          </div>
        )}

        
        {blocked.length > 0 && (
          <div>
            <div className="label" style={{ marginBottom: 8 }}>Spilling to Next Sprint ({blocked.length})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {blocked.map((task, i) => (
                <motion.div key={task.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 11px', borderRadius: 5, background: 'rgba(174,42,25,0.05)', border: '1px solid rgba(174,42,25,0.18)' }}
                >
                  <AlertTriangle size={11} style={{ color: 'var(--crit)', flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: 'var(--t1)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</span>
                  {task.storyPoints && <span style={{ fontSize: 9, color: 'var(--crit)', fontFamily: 'JetBrains Mono, monospace', flexShrink: 0 }}>{task.storyPoints}pt</span>}
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Velocity trend */}
        <div>
          <div data-feature-id="velocity-section" className="label" style={{ marginBottom: 10 }}>Sprint Velocity Trend</div>
          <VelocityChart />
        </div>

        {/* Burndown chart */}
        <div>
          <div data-feature-id="burndown-section" className="label" style={{ marginBottom: 10 }}>Burndown</div>
          <BurndownChart />
        </div>

        {/* Archive + New Sprint */}
        <div style={{ paddingTop: 4, borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <button data-feature-id="archive-btn" onClick={() => { archiveSprint(); setShowNewSprint(true) }} className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center', gap: 5 }}>
              <Archive size={12} strokeWidth={1.5} /> Archive Sprint
            </button>
            <button onClick={() => setShowNewSprint(true)} className="btn btn-primary" style={{ flex: 1, justifyContent: 'center', gap: 5 }}>
              <Plus size={12} strokeWidth={2} /> New Sprint
            </button>
            <button onClick={exportToCSV} className="btn btn-secondary" style={{ gap: 5 }}>
              <Download size={12} strokeWidth={1.5} /> CSV
            </button>
            {actionHistory.length > 0 && (
              <button onClick={undoLastAgentAction} className="btn btn-secondary" style={{ gap: 5 }} title="Undo last agent action">
                <UndoIcon size={12} strokeWidth={1.5} /> Undo
              </button>
            )}
          </div>
        </div>

        {/* New Sprint Modal */}
        <AnimatePresence>
          {showNewSprint && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setShowNewSprint(false)}
                style={{ position: 'fixed', inset: 0, background: 'rgba(9,9,11,0.45)', zIndex: 9998, backdropFilter: 'blur(3px)' }} />
              <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '48px 16px', pointerEvents: 'none' }}>
                <motion.div initial={{ opacity: 0, y: -8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 26 }}
                  style={{ width: '100%', maxWidth: 440, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 8px 24px rgba(9,9,11,0.18)', overflow: 'hidden', pointerEvents: 'auto' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', letterSpacing: '-0.015em' }}>Start New Sprint</span>
                    <button onClick={() => setShowNewSprint(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', display: 'flex', padding: 4, borderRadius: 4 }}>
                      <X size={14} />
                    </button>
                  </div>
                  <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {[
                      { label: 'Sprint name', value: newName, onChange: setNewName, placeholder: `Sprint ${nextNum}` },
                      { label: 'Sprint goal', value: newGoal, onChange: setNewGoal, placeholder: 'e.g. Ship checkout v2 with Apple Pay support' },
                    ].map(({ label, value, onChange, placeholder }) => (
                      <div key={label}>
                        <div className="label" style={{ marginBottom: 5 }}>{label}</div>
                        <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
                          style={{ width: '100%', outline: 'none', background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 5, padding: '8px 11px', fontSize: 11, color: 'var(--foreground)', boxSizing: 'border-box' }}
                          onFocus={e => (e.currentTarget.style.borderColor = 'var(--act)')}
                          onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')} />
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <div className="label" style={{ marginBottom: 5 }}>Start date</div>
                        <input type="date" value={newStart} onChange={e => setNewStart(e.target.value)}
                          style={{ width: '100%', outline: 'none', background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 5, padding: '8px 11px', fontSize: 11, color: 'var(--foreground)', boxSizing: 'border-box' }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div className="label" style={{ marginBottom: 5 }}>End date</div>
                        <input type="date" value={newEnd} onChange={e => setNewEnd(e.target.value)}
                          style={{ width: '100%', outline: 'none', background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 5, padding: '8px 11px', fontSize: 11, color: 'var(--foreground)', boxSizing: 'border-box' }} />
                      </div>
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <div className="label">Committed points</div>
                        <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: 'var(--act)' }}>{newPts}pt</span>
                      </div>
                      <input type="range" min={10} max={120} value={newPts} onChange={e => setNewPts(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--act)' }} />
                      <p style={{ fontSize: 10, color: 'var(--muted-foreground)', marginTop: 3 }}>Previous velocity: {sprint.velocity}pt</p>
                    </div>
                    <button
                      onClick={() => {
                        startNewSprint({ name: newName, goal: newGoal, startDate: newStart, endDate: newEnd, committedPoints: newPts })
                        // Clear bootstrap flag so agent re-triages carried tasks
                        sessionStorage.removeItem('sprint-agent-bootstrapped')
                        setShowNewSprint(false)
                        setView('sprint')
                      }}
                      className="btn btn-primary"
                      style={{ width: '100%', justifyContent: 'center', gap: 6 }}
                      disabled={!newName.trim() || !newGoal.trim()}
                    >
                      <Zap size={12} /> Start Sprint
                    </button>
                  </div>
                </motion.div>
              </div>
            </>
          )}
        </AnimatePresence>

        {/* Retrospective */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
            <RotateCcw size={12} style={{ color: 'var(--t2)' }} />
            <div className="label">Agent-Generated Retrospective</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { icon: ThumbsUp, label: 'What went well', items: retro.wentWell, color: 'var(--ok)', bg: 'rgba(33,110,78,0.05)', bd: 'rgba(33,110,78,0.18)' },
              { icon: ThumbsDown, label: "What didn't go well", items: retro.didntGo, color: 'var(--crit)', bg: 'rgba(174,42,25,0.05)', bd: 'rgba(174,42,25,0.18)' },
              { icon: Lightbulb, label: 'Try next sprint', items: retro.tryNext, color: 'var(--act)', bg: 'rgba(12,102,228,0.05)', bd: 'rgba(12,102,228,0.18)' },
            ].map(({ icon: Icon, label, items, color, bg, bd }) => (
              <div key={label} style={{ borderRadius: 6, border: `1px solid ${bd}`, background: bg, padding: '12px 14px', borderLeft: `3px solid ${color}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <Icon size={11} style={{ color }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color, letterSpacing: '-0.01em' }}>{label}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {items.map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
                      <div style={{ width: 4, height: 4, borderRadius: '50%', background: color, flexShrink: 0, marginTop: 5 }} />
                      <span style={{ fontSize: 11, color: 'var(--t2)', lineHeight: 1.6 }}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 12, fontSize: 10, color: 'var(--t3)' }}>
            <Zap size={9} style={{ color: 'var(--act)' }} />
            Generated by Sprint Agent based on sprint data and escalation log
          </div>
        </div>

        {/* Sprint History */}
        {sprintHistory.length > 0 && (
          <div data-feature-id="sprint-history"><SprintHistorySection sprintHistory={sprintHistory} /></div>
        )}

      </div>
    </div>
  )
}
