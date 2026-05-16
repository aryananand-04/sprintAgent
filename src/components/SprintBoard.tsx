import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Target, TrendingUp, AlertTriangle, CheckCircle, Users, Plus, MessageCircle, GripVertical, X, Send, GitBranch, ChevronDown, Sparkles, Star } from 'lucide-react'
import { useSprintStore } from '../store/useSprintStore'
import { TaskCard } from './TaskCard'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { GaugeCircle } from './ui/GaugeCircle'
import { loadColor } from '../utils/loadColor'
import { findBestAssignee } from '../logic/assign'
import { LOAD_ELIGIBILITY_THRESHOLD } from '../logic/constants'
import type { TaskStatus, Task } from '../types'
import { TourHint } from './TourHint'

/* ── Column definitions ── */
const COLUMNS: { id: TaskStatus; label: string; accent: string; tint?: string; headerBg?: string }[] = [
  { id: 'backlog',     label: 'Backlog',     accent: 'var(--muted-foreground)' },
  { id: 'triaged',     label: 'Triaged',     accent: 'var(--act)' },
  { id: 'assigned',    label: 'Assigned',    accent: 'var(--act)' },
  { id: 'in-progress', label: 'In Progress', accent: '#2563EB' },
  { id: 'blocked',     label: 'Blocked',     accent: 'var(--crit)', tint: 'rgba(220,38,38,0.04)', headerBg: 'rgba(220,38,38,0.07)' },
  { id: 'done',        label: 'Done',        accent: 'var(--ok)',   tint: 'rgba(22,163,74,0.04)',  headerBg: 'rgba(22,163,74,0.06)' },
]

const DECISION_COLORS = {
  ACT:     { bg: 'rgba(12,102,228,0.10)',  border: 'rgba(12,102,228,0.28)',  text: '#0047B3' },
  ASK:     { bg: 'rgba(184,92,0,0.10)',    border: 'rgba(184,92,0,0.28)',    text: '#8B4300' },
  ESCALATE:{ bg: 'rgba(174,42,25,0.10)',   border: 'rgba(174,42,25,0.28)',   text: '#7D1A0D' },
}

const URGENCY_COLORS: Record<string, string> = {
  critical: 'var(--crit)', high: 'var(--warn)', medium: 'var(--muted-foreground)', low: 'var(--muted-foreground)',
}

const MEMBER_BG: Record<string, string> = {
  'bg-violet-500':  '#6D28D9', 'bg-blue-500':    '#1D4ED8',
  'bg-pink-500':    '#BE185D', 'bg-emerald-500': '#047857',
  'bg-amber-500':   '#B45309', 'bg-cyan-500':    '#0891B2',
  'bg-rose-500':    '#E11D48', 'bg-indigo-500':  '#4338CA',
  'bg-teal-500':    '#0F766E', 'bg-orange-500':  '#EA580C',
  'bg-fuchsia-500': '#C026D3', 'bg-red-600':     '#DC2626',
  'bg-lime-500':    '#65A30D', 'bg-sky-500':     '#0284C7',
  'bg-purple-400':  '#A855F7',
}

/* ── Header stat ── */
function StatItem({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color?: string }) {
  const isAlert = !!color
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '0 10px' }}>
      <Icon size={10} style={{ color: color ?? 'var(--muted-foreground)', flexShrink: 0 }} strokeWidth={1.5} />
      <span style={{ fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 500 }}>{label}</span>
      <span style={{
        fontSize: isAlert ? 14 : 12, fontWeight: isAlert ? 800 : 700,
        color: color ?? 'var(--foreground)',
        fontFamily: 'JetBrains Mono, monospace', fontVariantNumeric: 'tabular-nums',
        marginLeft: 2, letterSpacing: '-0.02em',
      }}>{value}</span>
    </div>
  )
}

/* ── Kanban card with inline comments ── */
function KanbanCard({ task, columnId }: { task: Task; columnId: string }) {
  const { team, tasks, selectTask, setTriagePanelOpen, addComment, assignTaskById } = useSprintStore()
  const [showComments, setShowComments] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [assignOpen, setAssignOpen] = useState(false)

  const assignee = team.find(m => m.id === task.assigneeId)
  const dec = task.decision ? DECISION_COLORS[task.decision] : null
  const isBlocked = task.status === 'blocked'

  // If current assignee's load is fine, they ARE the best fit — don't suggest someone else.
  // Only surface a different best fit if the current assignee is overloaded (≥ threshold).
  const currentAssigneeOverloaded = assignee && assignee.currentLoad >= LOAD_ELIGIBILITY_THRESHOLD
  const best = (!task.assigneeId || currentAssigneeOverloaded) ? findBestAssignee(task, team, tasks) : null
  const effectiveBestId = task.assigneeId && !currentAssigneeOverloaded ? task.assigneeId : best?.memberId

  const sortedTeam = [...team].sort((a, b) => {
    if (a.id === effectiveBestId) return -1
    if (b.id === effectiveBestId) return 1
    if (a.id === task.assigneeId) return -1
    if (b.id === task.assigneeId) return 1
    return a.currentLoad - b.currentLoad
  })

  function openAssign(e: React.MouseEvent) {
    e.stopPropagation()
    setAssignOpen(true)
  }

  function handleAssign(memberId: string) {
    assignTaskById(task.id, memberId)
    setAssignOpen(false)
  }

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ taskId: task.id, sourceColumnId: columnId }))
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleCardClick = () => {
    if (showComments) { setShowComments(false); return }
    selectTask(task.id)
    setTriagePanelOpen(true)
  }

  const handleSubmitComment = (e: React.MouseEvent) => {
    e.stopPropagation()
    const text = commentText.trim()
    if (!text) return
    addComment(task.id, text, 'PM')
    setCommentText('')
  }

  function formatTime(iso: string) {
    const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
    if (m < 1) return 'now'
    if (m < 60) return `${m}m`
    return `${Math.floor(m / 60)}h`
  }

  return (
    <>
    <motion.div layout initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.12 }}
    >
      <Card
        className="cursor-pointer group"
        draggable
        onDragStart={handleDragStart}
        onClick={handleCardClick}
        style={{
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 8, boxShadow: '0 1px 3px rgba(9,9,11,0.06)',
          overflow: 'hidden', transition: 'box-shadow 0.12s, border-color 0.12s',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 3px 10px rgba(9,9,11,0.10)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--muted-foreground)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 3px rgba(9,9,11,0.06)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}
      >
        <CardContent className="p-0">
          {/* Decision band */}
          {task.decision && (
            <div style={{ height: 2, background: DECISION_COLORS[task.decision].text, opacity: 0.7 }} />
          )}

          <div style={{ padding: '10px 11px' }}>
            {/* Title row */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6, marginBottom: 6 }}>
              <h4 style={{
                fontSize: 12, fontWeight: 600, lineHeight: 1.38, letterSpacing: '-0.01em',
                color: isBlocked ? 'var(--crit)' : 'var(--foreground)',
                flex: 1, minWidth: 0,
              }}>
                {task.title}
              </h4>
              <GripVertical size={14} style={{ color: 'var(--muted-foreground)', flexShrink: 0, cursor: 'grab', opacity: 0, transition: 'opacity 0.1s' }}
                className="group-hover:opacity-100"
              />
            </div>

            {/* Description */}
            {task.description && (
              <p style={{ fontSize: 11, color: 'var(--muted-foreground)', lineHeight: 1.5, marginBottom: 8 }}
                className="line-clamp-2">
                {task.description}
              </p>
            )}

            {/* Tags */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
              {(task.urgency === 'critical' || task.urgency === 'high') && (
                <Badge style={{
                  fontSize: 9, padding: '1px 6px', borderRadius: 3,
                  background: `${URGENCY_COLORS[task.urgency]}18`,
                  border: `1px solid ${URGENCY_COLORS[task.urgency]}44`,
                  color: URGENCY_COLORS[task.urgency], fontWeight: 700,
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                  fontFamily: 'JetBrains Mono, monospace',
                }}>{task.urgency}</Badge>
              )}
              <Badge style={{
                fontSize: 9, padding: '1px 6px', borderRadius: 3,
                background: 'var(--muted)', border: '1px solid var(--border)',
                color: 'var(--muted-foreground)', fontWeight: 600, textTransform: 'capitalize',
              }}>{task.type}</Badge>
              {dec && task.decision && (
                <Badge style={{
                  fontSize: 9, padding: '1px 6px', borderRadius: 3,
                  background: dec.bg, border: `1px solid ${dec.border}`,
                  color: dec.text, fontWeight: 800, letterSpacing: '0.06em',
                  fontFamily: 'JetBrains Mono, monospace',
                }}>{task.decision === 'ESCALATE' ? 'ESC' : task.decision}</Badge>
              )}
              {task.tags?.slice(0, 2).map(tag => (
                <Badge key={tag} style={{
                  fontSize: 9, padding: '1px 6px', borderRadius: 3,
                  background: 'var(--muted)', border: '1px solid var(--border)',
                  color: 'var(--muted-foreground)', fontWeight: 500,
                }}>{tag}</Badge>
              ))}
              {/* Fix #5: blocked age indicator */}
              {isBlocked && task.createdAt && (() => {
                const h = Math.round((Date.now() - new Date(task.createdAt).getTime()) / 3_600_000)
                const label = h < 1 ? '<1h blocked' : h < 24 ? `${h}h blocked` : `${Math.floor(h / 24)}d blocked`
                return (
                  <Badge style={{
                    fontSize: 9, padding: '1px 6px', borderRadius: 3,
                    background: 'rgba(174,42,25,0.10)', border: '1px solid rgba(174,42,25,0.28)',
                    color: 'var(--crit)', fontWeight: 800, letterSpacing: '0.04em',
                    fontFamily: 'JetBrains Mono, monospace', animation: h >= 2 ? 'pulseDot 2s ease-in-out infinite' : 'none',
                  }}>{label}</Badge>
                )
              })()}
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 7, borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted-foreground)' }}>
                {task.storyPoints && (
                  <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: 'var(--muted-foreground)' }}>
                    {task.storyPoints}pt
                  </span>
                )}
                {/* Assignee load — same data source as sidebar gauge → updates simultaneously */}
                {assignee && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <GaugeCircle
                      value={assignee.currentLoad}
                      size={18} strokeWidth={2}
                      color={loadColor(assignee.currentLoad)}
                      trackColor="var(--border)" showValue={false}
                    />
                    <span style={{
                      fontSize: 10, fontFamily: 'JetBrains Mono, monospace', fontWeight: 600,
                      color: loadColor(assignee.currentLoad),
                    }}>{assignee.currentLoad}%</span>
                  </div>
                )}
                {/* Comment toggle button — stops card click */}
                <button
                  onClick={e => { e.stopPropagation(); setShowComments(s => !s) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 3,
                    background: showComments ? 'var(--act-bg)' : 'transparent',
                    border: `1px solid ${showComments ? 'var(--act-bd)' : 'transparent'}`,
                    borderRadius: 4, padding: '1px 5px',
                    color: showComments ? 'var(--act)' : 'var(--muted-foreground)',
                    cursor: 'pointer', transition: 'all 0.12s', fontFamily: 'Outfit, sans-serif',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--muted)'; e.currentTarget.style.borderColor = 'var(--border)' }}
                  onMouseLeave={e => {
                    if (!showComments) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent' }
                  }}
                >
                  <MessageCircle size={11} strokeWidth={1.5} />
                  {(task.comments?.length ?? 0) > 0 && (
                    <span style={{ fontSize: 9, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>
                      {task.comments!.length}
                    </span>
                  )}
                  <ChevronDown size={9} strokeWidth={2} style={{
                    transform: showComments ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.15s', opacity: 0.6,
                  }} />
                </button>
              </div>

              {assignee ? (
                <button onClick={openAssign} title="Reassign"
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', borderRadius: '50%', transition: 'opacity 0.1s' }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.7')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
                  <Avatar style={{ width: 22, height: 22 }}>
                    <AvatarFallback style={{ fontSize: 7, fontWeight: 800, color: '#fff', background: MEMBER_BG[assignee.color] ?? '#1E40AF' }}>
                      {assignee.initials}
                    </AvatarFallback>
                  </Avatar>
                </button>
              ) : (
                <button onClick={openAssign} title="Assign member"
                  style={{
                    width: 22, height: 22, borderRadius: '50%', background: 'var(--muted)',
                    border: '1px dashed var(--border)', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', cursor: 'pointer', transition: 'all 0.1s', padding: 0,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--act-bg)'; e.currentTarget.style.borderColor = 'var(--act-bd)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--muted)'; e.currentTarget.style.borderColor = 'var(--border)' }}
                >
                  <Plus size={9} style={{ color: 'var(--muted-foreground)' }} />
                </button>
              )}
            </div>
          </div>

          {/* ── Inline comment section ── */}
          <AnimatePresence initial={false}>
            {showComments && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                style={{ overflow: 'hidden' }}
                onClick={e => e.stopPropagation()}
              >
                <div style={{ borderTop: '1px solid var(--border)', background: 'var(--muted)' }}>
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 11px 6px' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted-foreground)' }}>
                      Comments {(task.comments?.length ?? 0) > 0 && `(${task.comments!.length})`}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button
                        onClick={e => { e.stopPropagation(); setShowComments(false); selectTask(task.id); setTriagePanelOpen(true) }}
                        style={{ fontSize: 10, fontWeight: 600, color: 'var(--act)', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'Outfit, sans-serif' }}
                      >
                        Full analysis
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); setShowComments(false) }}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', display: 'flex', padding: 2, borderRadius: 3 }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--foreground)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted-foreground)')}
                      >
                        <X size={12} strokeWidth={1.5} />
                      </button>
                    </div>
                  </div>

                  {/* Task description */}
                  {task.description && (
                    <p style={{ fontSize: 11, color: 'var(--muted-foreground)', lineHeight: 1.55, margin: '0 11px 8px', padding: '6px 8px', borderRadius: 5, background: 'var(--card)', border: '1px solid var(--border)' }}>
                      {task.description}
                    </p>
                  )}

                  {/* Agent rationale */}
                  {task.decisionReason && (
                    <div style={{
                      margin: '0 11px 8px', padding: '6px 8px', borderRadius: 5,
                      background: dec ? dec.bg : 'var(--card)',
                      border: `1px solid ${dec ? dec.border : 'var(--border)'}`,
                    }}>
                      <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: dec ? dec.text : 'var(--muted-foreground)', marginBottom: 3 }}>
                        Agent
                      </div>
                      <p style={{ fontSize: 11, color: 'var(--foreground)', lineHeight: 1.55, margin: 0 }}>
                        {task.decisionReason}
                      </p>
                    </div>
                  )}

                  {/* Dependencies */}
                  {task.dependencies.length > 0 && (
                    <div style={{ padding: '0 11px 8px' }}>
                      <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--muted-foreground)', marginBottom: 4 }}>
                        Dependencies
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {task.dependencies.slice(0, 3).map(dep => (
                          <div key={dep} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--muted-foreground)' }}>
                            <GitBranch size={9} strokeWidth={1.5} style={{ flexShrink: 0 }} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dep}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Existing comments */}
                  {(task.comments?.length ?? 0) > 0 && (
                    <div style={{ padding: '0 11px 6px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {task.comments!.map(c => (
                        <div key={c.id} style={{ padding: '7px 9px', borderRadius: 5, background: 'var(--card)', border: '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--foreground)' }}>{c.author}</span>
                            <span style={{ fontSize: 9, color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>{formatTime(c.timestamp)}</span>
                          </div>
                          <p style={{ fontSize: 11, color: 'var(--foreground)', lineHeight: 1.55, margin: 0 }}>{c.text}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Comment input */}
                  <div style={{ padding: '0 11px 10px' }}>
                    <div style={{ display: 'flex', gap: 5, alignItems: 'flex-end' }}>
                      <textarea
                        value={commentText}
                        onChange={e => setCommentText(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.stopPropagation(); handleSubmitComment(e as any) } }}
                        placeholder="Add a comment… (⌘+Enter)"
                        rows={2}
                        onClick={e => e.stopPropagation()}
                        style={{
                          flex: 1, resize: 'none', outline: 'none',
                          background: 'var(--card)', border: '1px solid var(--border)',
                          borderRadius: 6, padding: '7px 9px',
                          fontSize: 11, color: 'var(--foreground)',
                          fontFamily: 'Outfit, sans-serif', lineHeight: 1.5,
                          transition: 'border-color 0.12s',
                        }}
                        onFocus={e => { e.currentTarget.style.borderColor = 'var(--act)' }}
                        onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
                      />
                      <button
                        onClick={handleSubmitComment}
                        disabled={!commentText.trim()}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          width: 30, height: 30, borderRadius: 6, flexShrink: 0,
                          background: commentText.trim() ? 'var(--act)' : 'var(--muted)',
                          border: 'none', cursor: commentText.trim() ? 'pointer' : 'not-allowed',
                          color: commentText.trim() ? '#fff' : 'var(--muted-foreground)',
                          transition: 'background 0.12s, color 0.12s',
                        }}
                      >
                        <Send size={12} strokeWidth={2} />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>

    {/* Assignment portal */}
    {assignOpen && createPortal(
      <>
        {/* Blue backdrop */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }} onClick={e => { e.stopPropagation(); setAssignOpen(false) }}
          style={{ position: 'fixed', inset: 0, zIndex: 9990, background: 'rgba(9,9,11,0.22)', backdropFilter: 'blur(4px)' }}
        />
        {/* Member list panel — onClick stopPropagation on the panel itself prevents bubbling to card */}
        <motion.div
          onClick={e => e.stopPropagation()}
          initial={{ opacity: 0, y: -10, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6 }} transition={{ type: 'spring', stiffness: 360, damping: 30 }}
          style={{ position: 'fixed', top: 48, left: '50%', x: '-50%', zIndex: 9991, width: Math.min(320, window.innerWidth - 24), maxHeight: 'calc(100vh - 80px)', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 16px 48px rgba(0,0,0,0.30)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        >
          {/* Header */}
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', borderBottom: '1px solid var(--border)' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)', letterSpacing: '-0.01em' }}>Assign to member</div>
              <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 1 }}>{task.title.slice(0, 40)}{task.title.length > 40 ? '…' : ''}</div>
            </div>
            <button onClick={() => setAssignOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', display: 'flex', padding: 3, borderRadius: 4 }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--t1)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--t3)')}>
              <X size={13} strokeWidth={1.5} />
            </button>
          </div>
          {/* Members */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {sortedTeam.map((m) => {
              const isCurrentAssignee = m.id === task.assigneeId
              const isEffectiveBest = m.id === effectiveBestId
              // Combined: current assignee who isn't overloaded = current + best fit in one badge
              const isCombined = isCurrentAssignee && isEffectiveBest && !currentAssigneeOverloaded
              // Best fit shown separately: unassigned tasks OR overloaded current assignee
              const isSuggestedAlternative = isEffectiveBest && !isCombined
              const isOverloadedCurrent = isCurrentAssignee && !!currentAssigneeOverloaded
              const lc = loadColor(m.currentLoad)
              return (
                <button key={m.id} onClick={() => handleAssign(m.id)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px', textAlign: 'left', cursor: 'pointer',
                    background: isCurrentAssignee ? 'var(--act-bg)' : 'transparent',
                    border: 'none', borderBottom: '1px solid var(--b0)', transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { if (!isCurrentAssignee) e.currentTarget.style.background = 'var(--muted)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = isCurrentAssignee ? 'var(--act-bg)' : 'transparent' }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                    background: MEMBER_BG[m.color] ?? '#1D4ED8',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 800, color: '#fff',
                    boxShadow: isEffectiveBest ? '0 0 0 2px var(--act)' : undefined,
                  }}>{m.initials}</div>
                  {/* Name + role */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)', letterSpacing: '-0.01em' }}>{m.name}</span>
                      {/* Combined badge: current + best fit together */}
                      {isCombined && (
                        <span style={{ fontSize: 8, fontWeight: 800, padding: '1px 6px', borderRadius: 3, background: 'var(--act)', color: '#fff', fontFamily: 'JetBrains Mono, monospace', display: 'flex', alignItems: 'center', gap: 3 }}>
                          <Star size={7} strokeWidth={2} /> Assigned · Best fit
                        </span>
                      )}
                      {/* Overloaded current assignee */}
                      {isOverloadedCurrent && (
                        <>
                          <span style={{ fontSize: 8, fontWeight: 800, padding: '1px 5px', borderRadius: 3, background: 'var(--act)', color: '#fff', fontFamily: 'JetBrains Mono, monospace' }}>Current</span>
                          <span style={{ fontSize: 8, fontWeight: 800, padding: '1px 5px', borderRadius: 3, background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.28)', color: 'var(--crit)', fontFamily: 'JetBrains Mono, monospace' }}>High load</span>
                        </>
                      )}
                      {/* Suggested alternative when current is overloaded */}
                      {isSuggestedAlternative && (
                        <span style={{ fontSize: 8, fontWeight: 800, padding: '1px 5px', borderRadius: 3, background: 'var(--act-bg)', border: '1px solid var(--act-bd)', color: 'var(--act-t)', fontFamily: 'JetBrains Mono, monospace', display: 'flex', alignItems: 'center', gap: 3 }}>
                          <Star size={7} strokeWidth={2} /> Best fit
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2 }}>{m.role}</div>
                  </div>
                  {/* Load */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                    <GaugeCircle value={m.currentLoad} size={22} strokeWidth={2.5} color={lc} trackColor="var(--border)" showValue={false} />
                    <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: lc }}>{m.currentLoad}%</span>
                  </div>
                </button>
              )
            })}
          </div>
        </motion.div>
      </>,
      document.body
    )}
    </>
  )
}

/* ── Main SprintBoard ── */
export function SprintBoard() {
  const { tasks, sprint, team, updateTaskStatus, addTaskToColumn, sprintNarrative, isBootstrapping } = useSprintStore()
  const [dragOver, setDragOver]       = useState<string | null>(null)
  const [addingToCol, setAddingToCol] = useState<string | null>(null)
  const [newTitle, setNewTitle]       = useState('')
  const [newAssignee, setNewAssignee] = useState('')

  const pct          = Math.round((sprint.completedPoints / sprint.committedPoints) * 100)
  const daysRemaining = sprint.endDate
    ? Math.max(0, Math.ceil((new Date(sprint.endDate).getTime() - Date.now()) / 86_400_000))
    : sprint.daysRemaining
  const teamAvgLoad  = Math.round(team.reduce((s, m) => s + m.currentLoad, 0) / team.length)
  const blockedCount = tasks.filter(t => t.status === 'blocked').length
  const doneCount    = tasks.filter(t => t.status === 'done').length
  const hc           = sprint.health === 'green' ? 'var(--ok)' : sprint.health === 'yellow' ? 'var(--warn)' : 'var(--crit)'

  const handleDrop = (e: React.DragEvent, targetColId: TaskStatus) => {
    e.preventDefault()
    setDragOver(null)
    try {
      const { taskId, sourceColumnId } = JSON.parse(e.dataTransfer.getData('text/plain'))
      if (sourceColumnId !== targetColId) updateTaskStatus(taskId, targetColId)
    } catch {}
  }

  const handleAddTask = (colId: string) => {
    if (!newTitle.trim()) return
    addTaskToColumn(newTitle.trim(), colId as TaskStatus, newAssignee || undefined)
    setNewTitle('')
    setNewAssignee('')
    setAddingToCol(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ flexShrink: 0, padding: '14px 20px 12px', borderBottom: '1px solid var(--border)', background: 'var(--card)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 11 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
              <Target size={10} style={{ color: 'var(--act)', flexShrink: 0 }} strokeWidth={1.5} />
              <span className="label">Sprint Goal</span>
            </div>
            <p data-tour-step="1" style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', lineHeight: 1.38, letterSpacing: '-0.012em' }}>
              {sprint.goal}
            </p>
            {isBootstrapping && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--act)', display: 'inline-block', animation: 'pulseDot 1.4s ease-in-out infinite' }} />
                <span style={{ fontSize: 11, color: 'var(--act)', fontWeight: 600 }}>Agent analyzing tasks…</span>
              </div>
            )}
            {!isBootstrapping && sprintNarrative && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 5, marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
                <Sparkles size={9} style={{ color: 'var(--act)', flexShrink: 0, marginTop: 2 }} strokeWidth={1.5} />
                <p style={{ fontSize: 11, color: 'var(--muted-foreground)', lineHeight: 1.5, fontStyle: 'italic', margin: 0 }}>
                  {sprintNarrative}
                </p>
              </div>
            )}

          </div>
          <div data-feature-id="sprint-health" style={{
            flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5,
            padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 700,
            background: sprint.health === 'green' ? 'rgba(22,163,74,0.08)' : sprint.health === 'yellow' ? 'rgba(217,119,6,0.08)' : 'rgba(220,38,38,0.08)',
            border: `1px solid ${sprint.health === 'green' ? 'rgba(22,163,74,0.22)' : sprint.health === 'yellow' ? 'rgba(217,119,6,0.22)' : 'rgba(220,38,38,0.22)'}`,
            color: hc,
          }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', animation: sprint.health !== 'green' ? 'pulseDot 2.4s ease-in-out infinite' : 'none' }} />
            {sprint.health === 'green' ? 'On Track' : sprint.health === 'yellow' ? 'At Risk' : 'In Jeopardy'}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingRight: 10 }}>
            <div style={{ width: 120, height: 3, background: 'var(--muted)', borderRadius: 3, overflow: 'hidden' }}>
              <motion.div style={{ height: '100%', borderRadius: 3, background: hc }}
                initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
            <span style={{ fontSize: 11, color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
              {sprint.completedPoints}/{sprint.committedPoints}
            </span>
          </div>
          <div className="section-rule" style={{ height: 18 }} />
          <StatItem icon={TrendingUp}    label="Velocity" value={`${sprint.velocity}pt`} />
          <div className="section-rule" style={{ height: 14 }} />
          <StatItem icon={AlertTriangle} label="Blocked"  value={String(blockedCount)} color={blockedCount > 0 ? 'var(--crit)' : undefined} />
          <div className="section-rule" style={{ height: 14 }} />
          <StatItem icon={Users}         label="Avg load" value={`${teamAvgLoad}%`}    color={teamAvgLoad > 80 ? 'var(--warn)' : undefined} />
          <div className="section-rule" style={{ height: 14 }} />
          <StatItem icon={CheckCircle}   label="Done"     value={String(doneCount)}    color={doneCount > 0 ? 'var(--ok)' : undefined} />
          <span style={{ marginLeft: 'auto', paddingLeft: 10, fontSize: 11, color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>
            {daysRemaining}d left
          </span>
        </div>
      </div>

      {/* Board */}
      <div style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', background: 'var(--background)' }}>
        <div style={{ display: 'flex', gap: 8, height: '100%', padding: '12px 16px', minWidth: 'max-content' }}>
          {COLUMNS.map((col, i) => {
            const colTasks = tasks.filter(t => t.status === col.id)
            const isOver   = dragOver === col.id
            return (
              <motion.div key={col.id}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, delay: i * 0.04 }}
                onDragOver={e => { e.preventDefault(); setDragOver(col.id) }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null) }}
                onDrop={e => handleDrop(e, col.id as TaskStatus)}
                style={{
                  width: 230, flexShrink: 0, display: 'flex', flexDirection: 'column',
                  borderRadius: 8,
                  background: col.tint ?? 'var(--card)',
                  border: isOver ? `1px solid ${col.accent}99` : '1px solid var(--border)',
                  boxShadow: isOver ? `0 0 0 2px ${col.accent}22` : '0 1px 3px rgba(9,9,11,0.06)',
                  overflow: 'hidden', transition: 'border-color 0.12s, box-shadow 0.12s',
                }}
              >
                {/* Column header */}
                <div style={{
                  padding: '9px 11px', flexShrink: 0,
                  borderBottom: '1px solid var(--border)',
                  background: col.headerBg ?? 'var(--muted)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: col.accent }} />
                    <span
                      {...(col.id === 'blocked' ? { 'data-tour-step': '2' } : {})}
                      style={{
                        fontSize: 11, fontWeight: 600, letterSpacing: '-0.01em',
                        color: col.id === 'blocked' ? 'var(--crit)' : col.id === 'done' ? 'var(--ok)' : 'var(--foreground)',
                      }}>{col.label}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {colTasks.length > 0 && (
                      <span style={{
                        fontSize: 10, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700,
                        color: col.id === 'blocked' ? 'var(--crit)' : col.id === 'done' ? 'var(--ok)' : 'var(--muted-foreground)',
                        background: 'rgba(9,9,11,0.06)', padding: '0 5px', borderRadius: 10, lineHeight: '16px',
                      }}>{colTasks.length}</span>
                    )}
                    <button
                      onClick={() => { setAddingToCol(addingToCol === col.id ? null : col.id); setNewTitle(''); setNewAssignee('') }}
                      style={{
                        background: addingToCol === col.id ? 'var(--act-bg)' : 'transparent',
                        border: 'none', cursor: 'pointer', display: 'flex', borderRadius: 3,
                        padding: '2px 3px', transition: 'background 0.1s',
                        color: addingToCol === col.id ? 'var(--act)' : 'var(--muted-foreground)',
                      }}
                      onMouseEnter={e => { if (addingToCol !== col.id) e.currentTarget.style.color = 'var(--foreground)' }}
                      onMouseLeave={e => { if (addingToCol !== col.id) e.currentTarget.style.color = 'var(--muted-foreground)' }}
                    >
                      <Plus size={13} strokeWidth={1.5} />
                    </button>
                  </div>
                </div>

                {/* Add task form */}
                <AnimatePresence initial={false}>
                  {addingToCol === col.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                      style={{ overflow: 'hidden', flexShrink: 0 }}
                    >
                      <div style={{ padding: '8px', borderBottom: '1px solid var(--border)', background: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <input
                          autoFocus
                          value={newTitle}
                          onChange={e => setNewTitle(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleAddTask(col.id)
                            if (e.key === 'Escape') { setAddingToCol(null); setNewTitle('') }
                          }}
                          placeholder="Task title… (Enter to add)"
                          style={{
                            width: '100%', outline: 'none',
                            background: 'var(--card)', border: '1px solid var(--border)',
                            borderRadius: 5, padding: '6px 9px',
                            fontSize: 12, fontWeight: 500, color: 'var(--foreground)',
                            fontFamily: 'Outfit, sans-serif', transition: 'border-color 0.12s',
                          }}
                          onFocus={e => (e.currentTarget.style.borderColor = 'var(--act)')}
                          onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                        />
                        {/* Assignee picker */}
                        <div>
                          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted-foreground)', marginBottom: 5 }}>
                            Assign to {newAssignee ? '— ' + team.find(m => m.id === newAssignee)?.name.split(' ')[0] : '(optional)'}
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {[...team].sort((a, b) => a.currentLoad - b.currentLoad).map(m => {
                              const lc = loadColor(m.currentLoad)
                              const selected = newAssignee === m.id
                              return (
                                <button
                                  key={m.id}
                                  onClick={() => setNewAssignee(selected ? '' : m.id)}
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: 5,
                                    padding: '4px 7px', borderRadius: 5, cursor: 'pointer',
                                    background: selected ? 'var(--act-bg)' : 'var(--card)',
                                    border: `1px solid ${selected ? 'var(--act-bd)' : 'var(--border)'}`,
                                    transition: 'all 0.1s',
                                  }}
                                >
                                  <div style={{
                                    width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                                    background: MEMBER_BG[m.color] ?? '#1D4ED8',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 6, fontWeight: 800, color: '#fff',
                                  }}>{m.initials}</div>
                                  <span style={{ fontSize: 10, fontWeight: selected ? 700 : 500, color: selected ? 'var(--act-t)' : 'var(--foreground)', whiteSpace: 'nowrap' }}>
                                    {m.name.split(' ')[0]}
                                  </span>
                                  <GaugeCircle
                                    value={m.currentLoad}
                                    size={18} strokeWidth={2}
                                    color={lc} trackColor="var(--border)"
                                    showValue={false}
                                  />
                                  <span style={{ fontSize: 9, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: lc }}>
                                    {m.currentLoad}%
                                  </span>
                                </button>
                              )
                            })}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 5 }}>
                          <button onClick={() => handleAddTask(col.id)} disabled={!newTitle.trim()}
                            style={{
                              flex: 1, padding: '5px 0', borderRadius: 5, border: 'none',
                              background: newTitle.trim() ? 'var(--act)' : 'var(--muted)',
                              color: newTitle.trim() ? '#fff' : 'var(--muted-foreground)',
                              fontSize: 11, fontWeight: 700, cursor: newTitle.trim() ? 'pointer' : 'not-allowed',
                              fontFamily: 'Outfit, sans-serif',
                            }}>
                            Add — agent triages
                          </button>
                          <button onClick={() => { setAddingToCol(null); setNewTitle(''); setNewAssignee('') }}
                            style={{
                              padding: '5px 10px', borderRadius: 5, fontSize: 11, cursor: 'pointer',
                              background: 'transparent', border: '1px solid var(--border)',
                              color: 'var(--muted-foreground)', fontFamily: 'Outfit, sans-serif',
                            }}>Cancel</button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Tasks */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '6px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <AnimatePresence mode="popLayout">
                    {colTasks.length === 0 && addingToCol !== col.id ? (
                      <motion.div key="empty"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flex: 1, padding: '28px 0',
                          border: '1px dashed var(--border)', borderRadius: 6,
                          color: 'var(--muted-foreground)', fontSize: 11,
                        }}>
                        Drop here
                      </motion.div>
                    ) : colTasks.map(task => (
                      <KanbanCard key={task.id} task={task} columnId={col.id} />
                    ))}
                  </AnimatePresence>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
