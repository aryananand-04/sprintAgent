import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle, Zap, Beaker, Palette, Clock, Wrench, GitBranch, Plus, X, Star } from 'lucide-react'
import type { Task } from '../types'
import { useSprintStore } from '../store/useSprintStore'
import { findBestAssignee } from '../logic/assign'
import { GaugeCircle } from './ui/GaugeCircle'
import { loadColor } from '../utils/loadColor'

const TYPE_META: Record<string, { icon: React.ElementType; label: string }> = {
  bug:     { icon: AlertCircle, label: 'Bug' },
  feature: { icon: Zap,         label: 'Feature' },
  spike:   { icon: Beaker,      label: 'Spike' },
  design:  { icon: Palette,     label: 'Design' },
  urgent:  { icon: AlertCircle, label: 'Urgent' },
  'ad-hoc':{ icon: Clock,       label: 'Ad-hoc' },
  chore:   { icon: Wrench,      label: 'Chore' },
}

const DECISION_BAND: Record<string, string> = {
  ACT:     'var(--act)',
  ASK:     'var(--ask)',
  ESCALATE:'var(--esc)',
}

const URGENCY_COLOR: Record<string, string> = {
  critical: 'var(--crit)',
  high:     'var(--warn)',
  medium:   'var(--t3)',
  low:      'var(--t3)',
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

interface TaskCardProps { task: Task; compact?: boolean }

export function TaskCard({ task, compact = false }: TaskCardProps) {
  const { team, tasks, selectTask, setTriagePanelOpen, assignTaskById } = useSprintStore()
  const assignee = team.find(m => m.id === task.assigneeId)
  const meta = TYPE_META[task.type] ?? TYPE_META.chore
  const Icon = meta.icon
  const bandColor = task.decision ? DECISION_BAND[task.decision] : undefined
  const isBlocked = task.status === 'blocked'

  const [assignOpen, setAssignOpen] = useState(false)
  const [cardRect, setCardRect] = useState<DOMRect | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  const best = findBestAssignee(task, team, tasks)
  // Sort: best fit first, then by load ascending
  const sorted = [...team].sort((a, b) => {
    if (a.id === best?.memberId) return -1
    if (b.id === best?.memberId) return 1
    return a.currentLoad - b.currentLoad
  })

  function openAssign(e: React.MouseEvent) {
    e.stopPropagation()
    if (cardRef.current) setCardRect(cardRef.current.getBoundingClientRect())
    setAssignOpen(true)
  }

  function handleAssign(memberId: string) {
    assignTaskById(task.id, memberId)
    setAssignOpen(false)
  }

  // Position the member panel: prefer below card, flip above if near bottom
  function getPanelStyle(): React.CSSProperties {
    if (!cardRect) return { display: 'none' }
    const panelW = 280
    const panelH = Math.min(sorted.length * 52 + 48, 460)
    const vw = window.innerWidth
    const vh = window.innerHeight
    const gap = 8

    let top = cardRect.bottom + gap
    let left = cardRect.left

    if (top + panelH > vh - 16) top = cardRect.top - panelH - gap
    if (left + panelW > vw - 12) left = vw - panelW - 12
    if (left < 232) left = 232

    return { position: 'fixed', top, left, width: panelW, maxHeight: 460, zIndex: 9993 }
  }

  return (
    <>
      <motion.div
        ref={cardRef}
        layout
        initial={{ opacity: 0, y: 3 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.12 }}
        onClick={() => { if (!assignOpen) { selectTask(task.id); setTriagePanelOpen(true) } }}
        className="card-interactive"
        style={{ position: 'relative', overflow: 'hidden', zIndex: assignOpen ? 9992 : undefined }}
      >
        {bandColor && <div style={{ height: 2, background: bandColor }} />}

        <div style={{ padding: compact ? '7px 9px' : '9px 11px' }}>
          {compact ? (
            <>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, justifyContent: 'space-between' }}>
                <p style={{
                  fontSize: 11, fontWeight: 500, color: isBlocked ? 'var(--crit)' : 'var(--t1)',
                  lineHeight: 1.38, letterSpacing: '-0.008em',
                  flex: 1, minWidth: 0,
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>
                  {task.title}
                </p>
                {task.goalAlignment !== undefined && task.goalAlignment <= 3 && (
                  <span style={{ fontSize: 8, fontWeight: 800, padding: '1px 5px', borderRadius: 3, background: 'rgba(220,38,38,0.10)', border: '1px solid rgba(220,38,38,0.26)', color: 'var(--crit)', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.05em', flexShrink: 0, marginTop: 1 }}>
                    OFF-GOAL
                  </span>
                )}
                {task.decision && (
                  <span className={`chip chip-${task.decision === 'ACT' ? 'act' : task.decision === 'ASK' ? 'ask' : 'esc'}`} style={{ flexShrink: 0, marginTop: 1 }}>
                    {task.decision === 'ESCALATE' ? 'ESC' : task.decision}
                  </span>
                )}
              </div>
              {task.storyPoints && (
                <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                  {(task.urgency === 'critical' || task.urgency === 'high') && (
                    <span style={{ fontSize: 9, fontWeight: 700, color: URGENCY_COLOR[task.urgency], letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                      {task.urgency}
                    </span>
                  )}
                  <span style={{ fontSize: 10, color: 'var(--t3)', fontFamily: 'JetBrains Mono, monospace', marginLeft: 'auto' }}>
                    {task.storyPoints}pt
                  </span>
                </div>
              )}
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Icon size={9} style={{ color: 'var(--t3)', flexShrink: 0 }} strokeWidth={1.5} />
                  <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{meta.label}</span>
                  {(task.urgency === 'critical' || task.urgency === 'high') && (
                    <span style={{ fontSize: 9, color: URGENCY_COLOR[task.urgency], fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                      · {task.urgency}
                    </span>
                  )}
                </div>
                {task.decision && (
                  <span className={`chip chip-${task.decision === 'ACT' ? 'act' : task.decision === 'ASK' ? 'ask' : 'esc'}`}>
                    {task.decision === 'ESCALATE' ? 'ESC' : task.decision}
                  </span>
                )}
              </div>

              <p className="truncate-2" style={{ fontSize: 12, fontWeight: 500, color: 'var(--t1)', lineHeight: 1.42, letterSpacing: '-0.008em', marginBottom: 6 }}>
                {task.title}
              </p>

              {/* Footer row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                {/* Assignee + assign button */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  {assignee ? (
                    <>
                      <div style={{
                        width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
                        background: MEMBER_COLORS[assignee.color] ?? '#1D4ED8',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 7, fontWeight: 800, color: '#fff',
                      }}>{assignee.initials}</div>
                      <span style={{ fontSize: 10, color: 'var(--t3)' }}>{assignee.name.split(' ')[0]}</span>
                    </>
                  ) : (
                    <span style={{ fontSize: 10, color: 'var(--t3)' }}>Unassigned</span>
                  )}
                  {/* + assign button */}
                  <button
                    onClick={openAssign}
                    style={{
                      width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                      background: 'var(--s3)', border: '1px solid var(--b2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', transition: 'all 0.1s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--act)'; e.currentTarget.style.borderColor = 'var(--act)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--s3)'; e.currentTarget.style.borderColor = 'var(--b2)' }}
                    title="Assign member"
                  >
                    <Plus size={9} strokeWidth={2.5} style={{ color: 'var(--t2)' }} />
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {task.storyPoints && (
                    <span style={{ fontSize: 10, color: 'var(--t3)', fontFamily: 'JetBrains Mono, monospace' }}>{task.storyPoints}pt</span>
                  )}
                  {task.confidence !== undefined && (
                    <span style={{
                      fontSize: 10, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700,
                      color: task.confidence >= 75 ? 'var(--ok)' : task.confidence >= 55 ? 'var(--warn)' : 'var(--crit)',
                    }}>{task.confidence}%</span>
                  )}
                  {task.dependencies.length > 0 && <GitBranch size={9} style={{ color: 'var(--t3)' }} />}
                </div>
              </div>

              {task.isAdHoc && task.adHocResolution && (
                <div style={{ marginTop: 5, paddingTop: 5, borderTop: '1px solid var(--b0)' }}>
                  <span style={{
                    fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                    color: task.adHocResolution === 'absorb' ? 'var(--ok)' : task.adHocResolution === 'swap' ? 'var(--warn)' : 'var(--esc-t)',
                  }}>
                    {task.adHocResolution === 'absorb' ? 'Absorbed' : task.adHocResolution === 'swap' ? 'Swapped' : 'Escalated'}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>

      {/* Assignment portal */}
      {assignOpen && createPortal(
        <AnimatePresence>
          <>
            {/* Blue backdrop — covers everything except card (card has higher z-index) */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setAssignOpen(false)}
              style={{
                position: 'fixed', inset: 0, zIndex: 9990,
                background: 'rgba(9, 40, 140, 0.38)',
                backdropFilter: 'blur(2px)',
              }}
            />

            {/* Member list panel */}
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 340, damping: 28 }}
              style={{
                ...getPanelStyle(),
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                boxShadow: '0 12px 40px rgba(0,0,0,0.28)',
                display: 'flex', flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)', letterSpacing: '-0.01em' }}>Assign to</div>
                  <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 1 }}>{task.title.slice(0, 36)}{task.title.length > 36 ? '…' : ''}</div>
                </div>
                <button onClick={() => setAssignOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', display: 'flex', padding: 3, borderRadius: 4 }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--t1)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--t3)')}>
                  <X size={13} strokeWidth={1.5} />
                </button>
              </div>

              {/* Members list */}
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {sorted.map((m, i) => {
                  const isBest = m.id === best?.memberId
                  const lc = loadColor(m.currentLoad)
                  const isAssigned = m.id === task.assigneeId
                  return (
                    <button
                      key={m.id}
                      onClick={() => handleAssign(m.id)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                        padding: '9px 14px', textAlign: 'left', cursor: 'pointer',
                        background: isAssigned ? 'var(--act-bg)' : i === 0 && isBest ? 'var(--s1)' : 'transparent',
                        border: 'none', borderBottom: '1px solid var(--b0)',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => { if (!isAssigned) e.currentTarget.style.background = 'var(--muted)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = isAssigned ? 'var(--act-bg)' : i === 0 && isBest ? 'var(--s1)' : 'transparent' }}
                    >
                      {/* Avatar */}
                      <div style={{
                        width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                        background: MEMBER_COLORS[m.color] ?? '#1D4ED8',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 800, color: '#fff',
                        boxShadow: isBest ? `0 0 0 2px var(--act)` : undefined,
                      }}>{m.initials}</div>

                      {/* Name + role */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)', letterSpacing: '-0.01em' }}>{m.name}</span>
                          {isBest && (
                            <span style={{
                              fontSize: 8, fontWeight: 800, padding: '1px 5px', borderRadius: 3,
                              background: 'var(--act-bg)', border: '1px solid var(--act-bd)',
                              color: 'var(--act-t)', fontFamily: 'JetBrains Mono, monospace',
                              display: 'flex', alignItems: 'center', gap: 3,
                            }}>
                              <Star size={6} strokeWidth={2} style={{ color: 'var(--act)' }} /> Best fit
                            </span>
                          )}
                          {isAssigned && (
                            <span style={{ fontSize: 8, fontWeight: 800, padding: '1px 5px', borderRadius: 3, background: 'var(--act)', color: '#fff', fontFamily: 'JetBrains Mono, monospace' }}>
                              Assigned
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 1 }}>{m.role}</div>
                      </div>

                      {/* Load gauge */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                        <GaugeCircle value={m.currentLoad} size={22} strokeWidth={2.5} color={lc} trackColor="var(--border)" showValue={false} />
                        <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: lc }}>{m.currentLoad}%</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </motion.div>
          </>
        </AnimatePresence>,
        document.body
      )}
    </>
  )
}
