import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Zap, AlertTriangle, HelpCircle, GitBranch, CheckCircle, Sparkles } from 'lucide-react'
import { useSprintStore } from '../store/useSprintStore'
import { triageTask } from '../logic/triage'
import { findBestAssignee } from '../logic/assign'
import { NumberTicker } from './ui/NumberTicker'
import { generateAcceptanceCriteria } from '../logic/acceptanceCriteria'
import { Typewriter } from './ui/typewriter'
import { GaugeCircle } from './ui/GaugeCircle'

const DEC = {
  ACT: {
    icon: Zap, label: 'ACT', subtitle: 'Agent acts autonomously',
    color: 'var(--act-t)', bg: 'var(--act-bg)', border: 'var(--act-bd)',
    solid: 'var(--act)', bandColor: '#0C66E4',
  },
  ASK: {
    icon: HelpCircle, label: 'ASK', subtitle: 'Requesting clarification',
    color: 'var(--ask-t)', bg: 'var(--ask-bg)', border: 'var(--ask-bd)',
    solid: 'var(--ask)', bandColor: '#B85C00',
  },
  ESCALATE: {
    icon: AlertTriangle, label: 'ESCALATE', subtitle: 'Human judgment required',
    color: 'var(--esc-t)', bg: 'var(--esc-bg)', border: 'var(--esc-bd)',
    solid: 'var(--esc)', bandColor: '#AE2A19',
  },
}

const DIM = [
  { key: 'urgency' as const, label: 'Urgency', color: 'var(--crit)' },
  { key: 'impact'  as const, label: 'Impact',  color: 'var(--act)' },
  { key: 'effort'  as const, label: 'Effort',  color: 'var(--ask)' },
  { key: 'risk'    as const, label: 'Risk',    color: 'var(--esc)' },
  { key: 'clarity' as const, label: 'Clarity', color: 'var(--ok)' },
]

const MEMBER_COLORS: Record<string, string> = {
  'bg-violet-500': '#6D28D9', 'bg-blue-500': '#1D4ED8',
  'bg-pink-500': '#BE185D',   'bg-emerald-500': '#047857', 'bg-amber-500': '#B45309',
}

export function TriagePanel() {
  const {
    selectedTaskId, isTriagePanelOpen, setTriagePanelOpen, selectTask,
    tasks, team, autonomyConfig, triageTaskById, assignTaskById, triagingTaskId, triageError, setAcceptanceCriteria,
  } = useSprintStore()
  const task = tasks.find(t => t.id === selectedTaskId)
  const isLoading = triagingTaskId === selectedTaskId
  const triage = task ? triageTask(task, autonomyConfig) : null
  const dec = task?.decision ?? triage?.decision ?? 'ACT'
  const score = task?.triageScore ?? triage?.score ?? 50
  const dims = triage?.dimensions ?? { urgency: 3, impact: 3, effort: 3, risk: 3, clarity: 3 }
  const reason = task?.decisionReason ?? triage?.reason ?? ''

  // Hooks MUST come before any conditional return (Rules of Hooks)
  const [criteria, setCriteria] = useState<string[]>([])
  const [loadingCriteria, setLoadingCriteria] = useState(false)

  if (!task) return null

  const meta = DEC[dec]
  const DecIcon = meta.icon
  const bestAssignee = dec !== 'ESCALATE' ? findBestAssignee(task, team, tasks) : null
  const close = () => { setTriagePanelOpen(false); selectTask(null); setCriteria([]) }

  const handleGenerateCriteria = async () => {
    if (loadingCriteria) return
    const apiKey = import.meta.env.VITE_GROQ_API_KEY
    if (!apiKey || apiKey === 'paste_your_key_here') {
      setCriteria(['⚠ No Groq API key configured — add VITE_GROQ_API_KEY to your .env.local to generate criteria.'])
      return
    }
    setLoadingCriteria(true)
    const blockingQ = reason.includes('Blocking question:') ? reason.split('Blocking question:')[1]?.split('.')[0] ?? reason : reason
    const result = await generateAcceptanceCriteria(task, blockingQ, apiKey)
    setCriteria(result.length > 0 ? result : ['Generation failed — check your API key and try again.'])
    setLoadingCriteria(false)
  }

  return (
    <AnimatePresence>
      {isTriagePanelOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={close}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 40 }}
          />

          <motion.div
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 280, damping: 26 }}
            style={{
              position: 'fixed', right: 0, top: 0, bottom: 0, width: 448, zIndex: 50,
              display: 'flex', flexDirection: 'column', overflow: 'hidden',
              background: 'var(--card)', borderLeft: '1px solid var(--border)',
              boxShadow: '-6px 0 24px rgba(9,9,11,0.14)',
            }}
          >
            <div style={{ height: 2, background: meta.bandColor, flexShrink: 0 }} />

            {/* Header */}
            <div style={{ flexShrink: 0, padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span className="label">Triage Analysis</span>
                  {task.isAITriaged && (
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
                      background: 'var(--act-bg)', border: '1px solid var(--act-bd)',
                      color: 'var(--act-t)', letterSpacing: '0.05em',
                      display: 'inline-flex', alignItems: 'center', gap: 3,
                    }}>
                      <Sparkles size={7} /> AI
                    </span>
                  )}
                </div>
                <button onClick={close} style={{
                  color: 'var(--t3)', cursor: 'pointer', padding: 4, borderRadius: 4,
                  border: 'none', background: 'transparent', display: 'flex',
                  transition: 'color 0.1s, background 0.1s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--t1)'; e.currentTarget.style.background = 'var(--s3)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--t3)'; e.currentTarget.style.background = 'transparent' }}
                >
                  <X size={14} />
                </button>
              </div>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--t1)', lineHeight: 1.35, letterSpacing: '-0.015em', marginBottom: 3 }}>
                {task.title}
              </h2>
              <p style={{ fontSize: 11, color: 'var(--t3)' }}>
                <span style={{ color: 'var(--t2)' }}>{task.source}</span>
                <span style={{ margin: '0 4px' }}>·</span>
                {task.type}
              </p>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto' }}>

              {/* Verdict block — the product's money moment */}
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ background: meta.bg, border: `1px solid ${meta.border}`, borderRadius: 6, overflow: 'hidden' }}>
                  <div style={{ height: 3, background: meta.bandColor }} />
                  <div style={{ padding: '16px 16px 14px' }}>

                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div>
                        {isLoading ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {[0, 1, 2].map(i => (
                              <motion.div key={i}
                                style={{ width: 5, height: 5, borderRadius: '50%', background: meta.solid }}
                                animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
                                transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.22 }}
                              />
                            ))}
                          </div>
                        ) : (
                          <motion.div key={meta.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                            <div style={{ fontSize: 40, fontWeight: 900, color: meta.solid, letterSpacing: '-0.04em', lineHeight: 1, fontFamily: 'Outfit, sans-serif' }}>
                              {meta.label}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 5 }}>{meta.subtitle}</div>
                          </motion.div>
                        )}
                      </div>
                      {!isLoading && (
                        <div style={{ textAlign: 'right', flexShrink: 0, paddingBottom: 2 }}>
                          <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1, fontFamily: 'JetBrains Mono, monospace', fontVariantNumeric: 'tabular-nums', color: meta.solid, letterSpacing: '-0.03em' }}>
                            <NumberTicker value={score} duration={0.7} />
                          </div>
                          <div style={{ fontSize: 9, color: 'var(--t3)', marginTop: 2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>/ 100</div>
                        </div>
                      )}
                    </div>
                    <div style={{ height: 1, background: meta.border, marginBottom: 11, opacity: 0.5 }} />
                    {isLoading ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                          {[0, 1, 2].map(i => (
                            <motion.div key={i}
                              style={{ width: 4, height: 4, borderRadius: '50%', background: meta.solid }}
                              animate={{ opacity: [0.3, 1, 0.3] }}
                              transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2 }}
                            />
                          ))}
                          <span style={{ fontSize: 11, color: 'var(--t3)' }}>Analyzing…</span>
                        </div>
                        {[72, 88, 54].map((w, i) => (
                          <div key={i} className="skeleton" style={{ height: 9, width: `${w}%` }} />
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: 'var(--t1)', lineHeight: 1.6 }}>
                        <Typewriter
                          text={reason}
                          speed={10}
                          loop={false}
                          showCursor={true}
                          hideCursorOnType={false}
                          cursorChar={<span style={{ color: meta.solid, marginLeft: 1 }}>|</span>}
                          cursorClassName=""
                        />
                      </div>
                    )}
                    {/* Acceptance criteria for ASK decisions */}
                    {dec === 'ASK' && !isLoading && (
                      <div style={{ marginTop: 10 }}>
                        {criteria.length > 0 ? (
                          <div>
                            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ask-t)', marginBottom: 6 }}>
                              Proposed acceptance criteria
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                              {criteria.map((c, i) => (
                                <div key={i} style={{ display: 'flex', gap: 7, fontSize: 11, color: 'var(--foreground)', lineHeight: 1.5 }}>
                                  <span style={{ color: 'var(--ok)', flexShrink: 0, fontWeight: 700 }}>✓</span>
                                  <span>{c}</span>
                                </div>
                              ))}
                            </div>
                            <button
                              onClick={() => { setAcceptanceCriteria(task.id, criteria, true); close() }}
                              className="btn btn-primary"
                              style={{ marginTop: 8, width: '100%', justifyContent: 'center', fontSize: 11 }}
                            >
                              Approve criteria — re-triage as ACT
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={handleGenerateCriteria}
                            disabled={loadingCriteria}
                            className="btn btn-secondary"
                            style={{ fontSize: 11, gap: 5 }}
                          >
                            {loadingCriteria ? 'Generating…' : 'Generate acceptance criteria'}
                          </button>
                        )}
                      </div>
                    )}
                    {triageError && !isLoading && (
                      <p style={{ fontSize: 10, color: 'var(--warn)', marginTop: 7 }}>{triageError}</p>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div>
                  <div className="label" style={{ marginBottom: 6 }}>Description</div>
                  <p style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.65 }}>{task.description}</p>
                </div>

                <div>
                  <div className="label" style={{ marginBottom: 10 }}>Scoring Dimensions</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {DIM.map(({ key, label, color }) => {
                      const val = dims[key]
                      return (
                        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 11, color: 'var(--t2)', width: 52, flexShrink: 0 }}>{label}</span>
                          <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                            {Array.from({ length: 5 }).map((_, i) => (
                              <div key={i} style={{ width: 6, height: 6, borderRadius: 2, background: i < val ? color : 'var(--s4)' }} />
                            ))}
                          </div>
                          <div className="meter" style={{ flex: 1 }}>
                            <motion.div className="meter-fill" style={{ background: color, opacity: 0.65 }}
                              initial={{ width: 0 }} animate={{ width: `${(val / 5) * 100}%` }}
                              transition={{ duration: 0.4, ease: 'easeOut' }}
                            />
                          </div>
                          <span style={{ fontSize: 10, color: 'var(--t3)', width: 22, textAlign: 'right', flexShrink: 0, fontFamily: 'JetBrains Mono, monospace' }}>{val}/5</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {bestAssignee && (() => {
                  const m = team.find(t => t.id === bestAssignee.memberId)
                  const cc = bestAssignee.confidence >= 75 ? 'var(--ok)' : bestAssignee.confidence >= 55 ? 'var(--warn)' : 'var(--crit)'
                  return (
                    <div>
                      <div className="label" style={{ marginBottom: 8 }}>Assignment Recommendation</div>
                      <div style={{ background: 'var(--s2)', border: '1px solid var(--b1)', borderRadius: 6, padding: '12px 13px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {m && (
                            <div style={{
                              width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                              background: MEMBER_COLORS[m.color] ?? '#1D4ED8',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 11, fontWeight: 700, color: '#fff',
                            }}>{m.initials}</div>
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)', letterSpacing: '-0.01em' }}>{bestAssignee.memberName}</div>
                            <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 1 }}>{m?.role}</div>
                            <p style={{ fontSize: 11, color: 'var(--t2)', lineHeight: 1.6, marginTop: 6 }}>{bestAssignee.rationale}</p>
                          </div>
                          <GaugeCircle value={bestAssignee.confidence} size={52} strokeWidth={4} color={cc} label="conf." />
                        </div>
                      </div>
                    </div>
                  )
                })()}

                {task.dependencies.length > 0 && (
                  <div>
                    <div className="label" style={{ marginBottom: 8 }}>Dependencies</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {task.dependencies.map(dep => {
                        const depTask = tasks.find(t => t.id === dep)
                        const isExt = !dep.startsWith('task-')
                        return (
                          <div key={dep} style={{
                            display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 5, fontSize: 11,
                            background: isExt ? 'var(--esc-bg)' : depTask?.status === 'done' ? 'rgba(33,110,78,0.07)' : 'var(--s2)',
                            border: `1px solid ${isExt ? 'var(--esc-bd)' : depTask?.status === 'done' ? 'rgba(33,110,78,0.18)' : 'var(--b1)'}`,
                            color: isExt ? 'var(--esc-t)' : depTask?.status === 'done' ? 'var(--ok)' : 'var(--t2)',
                          }}>
                            <GitBranch size={10} style={{ flexShrink: 0 }} />
                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{depTask ? depTask.title : dep}</span>
                            {isExt && <span style={{ fontSize: 9, fontWeight: 700 }}>EXT</span>}
                            {depTask?.status === 'done' && <CheckCircle size={10} />}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {task.tags && task.tags.length > 0 && (
                  <div>
                    <div className="label" style={{ marginBottom: 6 }}>Tags</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {task.tags.map(tag => (
                        <span key={tag} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 3, background: 'var(--s3)', border: '1px solid var(--b1)', color: 'var(--t2)', fontWeight: 500 }}>{tag}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div style={{ flexShrink: 0, padding: '12px 18px', borderTop: '1px solid var(--border)', display: 'flex', gap: 7, background: 'var(--card)' }}>
              <button
                onClick={() => void triageTaskById(task.id)}
                disabled={isLoading}
                className={!task.isAITriaged ? 'btn btn-primary' : 'btn btn-secondary'}
                style={{ gap: 5, flex: !task.isAITriaged ? 1 : undefined }}
              >
                {isLoading ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                    <Sparkles size={11} />
                  </motion.div>
                ) : <Sparkles size={11} />}
                {isLoading ? 'Analyzing…' : !task.isAITriaged ? 'Triage with AI' : 'Re-Triage'}
              </button>
              {dec === 'ACT' && !task.assigneeId && (
                <button onClick={() => { assignTaskById(task.id); close() }} disabled={isLoading} className="btn btn-primary" style={{ flex: 1 }}>
                  <Zap size={11} /> Auto-Assign
                </button>
              )}
              {dec === 'ACT' && task.assigneeId && (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 4, fontSize: 12, fontWeight: 600, background: 'rgba(33,110,78,0.08)', border: '1px solid rgba(33,110,78,0.20)', color: 'var(--ok)' }}>
                  <CheckCircle size={12} /> Assigned
                </div>
              )}
              {dec === 'ESCALATE' && (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 4, fontSize: 12, fontWeight: 600, background: 'var(--esc-bg)', border: '1px solid var(--esc-bd)', color: 'var(--esc-t)' }}>
                  <AlertTriangle size={12} /> Escalation Required
                </div>
              )}
              {dec === 'ASK' && (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 4, fontSize: 12, fontWeight: 600, background: 'var(--ask-bg)', border: '1px solid var(--ask-bd)', color: 'var(--ask-t)' }}>
                  <HelpCircle size={12} /> Awaiting Clarification
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
