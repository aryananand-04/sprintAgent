import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Inbox, CheckCircle, Zap, AlertTriangle } from 'lucide-react'
import { useSprintStore } from '../store/useSprintStore'
import { TaskCard } from './TaskCard'
import { GitHubImport } from './GitHubImport'
import { TourHint } from './TourHint'
import { checkForDuplicate, type DuplicateResult } from '../logic/duplicateDetection'
import type { UrgencyLevel } from '../types'

const URGENCY_OPTIONS: { value: UrgencyLevel; label: string; color: string }[] = [
  { value: 'critical', label: 'Critical', color: 'var(--crit)' },
  { value: 'high',     label: 'High',     color: 'var(--warn)' },
  { value: 'medium',   label: 'Medium',   color: 'var(--muted-foreground)' },
  { value: 'low',      label: 'Low',      color: 'var(--muted-foreground)' },
]

export function IntakeInbox() {
  const { tasks, addAdHocTask, assignTaskById } = useSprintStore()
  const [input, setInput] = useState('')
  const [urgency, setUrgency] = useState<UrgencyLevel>('medium')
  const [submitting, setSubmitting] = useState(false)
  const [lastAdded, setLastAdded] = useState<string | null>(null)
  const [duplicate, setDuplicate] = useState<DuplicateResult | null>(null)
  const [checkingDup, setCheckingDup] = useState(false)

  const backlogTasks = tasks.filter(t => t.status === 'backlog' || t.isNew)
  const recentAdHoc  = tasks.filter(t => t.isAdHoc).slice(0, 5)
  const currentUrgencyColor = URGENCY_OPTIONS.find(o => o.value === urgency)?.color ?? 'var(--muted-foreground)'

  const handleCheckDuplicate = async (text: string) => {
    const apiKey = import.meta.env.VITE_GROQ_API_KEY
    if (!apiKey || !text.trim() || checkingDup) return
    setCheckingDup(true)
    const result = await checkForDuplicate(text, tasks, apiKey)
    setDuplicate(result)
    setCheckingDup(false)
  }

  const handleSubmit = () => {
    if (!input.trim() || submitting) return
    setSubmitting(true)
    const title = input.trim()
    // Agent takes over immediately: addAdHocTask → auto-triage → auto-assign
    addAdHocTask(title, `Submitted via intake. Urgency: ${urgency}.`, urgency)
    setLastAdded(title)
    setInput('')
    setDuplicate(null)
    setSubmitting(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ flexShrink: 0, padding: '13px 18px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <Inbox size={13} style={{ color: 'var(--act)' }} strokeWidth={1.5} />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', letterSpacing: '-0.015em' }}>Intake</span>
          <AnimatePresence>
            {backlogTasks.length > 0 && (
              <motion.span key={backlogTasks.length}
                initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 8, background: 'var(--act-bg)', border: '1px solid var(--act-bd)', color: 'var(--act-t)', fontFamily: 'JetBrains Mono, monospace' }}
              >{backlogTasks.length}</motion.span>
            )}
          </AnimatePresence>
        </div>
        <p style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
          Describe a request. Agent triages and assigns autonomously — no clicks needed.
        </p>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Submit form */}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <textarea
            data-tour-step="4"
            value={input}
            onChange={e => { setInput(e.target.value); setDuplicate(null) }}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit() }}
            onBlur={() => handleCheckDuplicate(input)}
            placeholder="Describe the request… the agent handles everything from here"
            rows={3}
            style={{
              width: '100%', background: 'var(--card)', border: '1px solid var(--border)',
              borderRadius: 6, fontSize: 12, color: 'var(--foreground)', padding: '10px 12px',
              resize: 'none', outline: 'none', fontFamily: 'Outfit, sans-serif', lineHeight: 1.6,
              transition: 'border-color 0.12s, box-shadow 0.12s',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--act)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--act-bg)' }}
          />

          {/* Duplicate warning */}
          {duplicate?.isDuplicate && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, marginTop: 6, padding: '8px 11px', borderRadius: 5, background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.24)' }}>
              <AlertTriangle size={11} style={{ color: 'var(--warn)', flexShrink: 0, marginTop: 1 }} strokeWidth={1.5} />
              <span style={{ fontSize: 11, color: 'var(--foreground)', lineHeight: 1.5 }}>
                <strong style={{ color: 'var(--warn)' }}>Possible duplicate ({duplicate.similarity}%):</strong> "{duplicate.similarTaskTitle}" is already in the backlog. {duplicate.reason}
              </span>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <select value={urgency} onChange={e => setUrgency(e.target.value as UrgencyLevel)}
              style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 5, fontSize: 11, color: currentUrgencyColor, padding: '5px 8px', outline: 'none', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 600 }}
            >
              {URGENCY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>

            <button
              onClick={handleSubmit}
              disabled={!input.trim() || submitting}
              className="btn btn-primary"
              style={{ marginLeft: 'auto' }}
            >
              <Zap size={10} strokeWidth={2} />
              {submitting ? 'Handing off…' : 'Hand off to Agent'}
              <span style={{ fontSize: 10, opacity: 0.6 }}>⌘↵</span>
            </button>
          </div>

          <AnimatePresence>
            {lastAdded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                style={{ marginTop: 10, padding: '9px 12px', borderRadius: 6, overflow: 'hidden', background: 'var(--act-bg)', border: '1px solid var(--act-bd)', display: 'flex', alignItems: 'flex-start', gap: 7 }}
              >
                <CheckCircle size={11} style={{ color: 'var(--ok)', flexShrink: 0, marginTop: 1 }} strokeWidth={1.5} />
                <div style={{ fontSize: 11, color: 'var(--muted-foreground)', lineHeight: 1.5 }}>
                  <span style={{ color: 'var(--act-t)', fontWeight: 600 }}>Agent received:</span> "{lastAdded}" — watch the feed for triage decision and assignment.
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* GitHub import */}
        <div style={{ borderBottom: '1px solid var(--border)' }}>
          <GitHubImport />
        </div>

        {/* Recent ad-hoc */}
        {recentAdHoc.length > 0 && (
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
            <div className="label" style={{ marginBottom: 9 }}>Recent Requests</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {recentAdHoc.map(task => {
                const decStyle: Record<string, { color: string; bg: string; bd: string }> = {
                  ACT: { color: 'var(--act-t)', bg: 'var(--act-bg)', bd: 'var(--act-bd)' },
                  ASK: { color: 'var(--ask-t)', bg: 'var(--ask-bg)', bd: 'var(--ask-bd)' },
                  ESCALATE: { color: 'var(--esc-t)', bg: 'var(--esc-bg)', bd: 'var(--esc-bd)' },
                }
                const dc = task.decision ? decStyle[task.decision] : null
                return (
                  <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 11px', borderRadius: 5, background: 'var(--muted)', border: '1px solid var(--border)' }}>
                    <p style={{ fontSize: 12, color: 'var(--foreground)', fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{task.title}</p>
                    {dc && task.decision && (
                      <span style={{ fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 3, background: dc.bg, border: `1px solid ${dc.bd}`, color: dc.color, fontFamily: 'JetBrains Mono, monospace', flexShrink: 0 }}>
                        {task.decision === 'ESCALATE' ? 'ESC' : task.decision}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Backlog */}
        <div style={{ padding: '14px 18px' }}>
          <div className="label" style={{ marginBottom: 9 }}>Backlog ({backlogTasks.length})</div>
          {backlogTasks.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '28px 0', gap: 8 }}>
              <CheckCircle size={14} style={{ color: 'var(--ok)' }} strokeWidth={1.5} />
              <p style={{ fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 500 }}>Backlog clear</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {backlogTasks.map(task => <TaskCard key={task.id} task={task} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
