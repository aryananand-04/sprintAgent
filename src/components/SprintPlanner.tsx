import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, CheckCircle, Plus, Wand2, RotateCcw } from 'lucide-react'
import { useSprintStore } from '../store/useSprintStore'
import type { Task, UrgencyLevel, TaskType } from '../types'
import Groq from 'groq-sdk'

const PLANNER_PROMPT = (brief: string, team: string, sprint: string) => `
You are a senior PM generating a sprint backlog. Think carefully before generating tasks.

STEP 1 — Count deliverables: Read the brief and count the distinct things being asked.
STEP 2 — Decide spike vs implementation: If something is technically risky or unknown, generate ONLY a spike task for it — NOT both spike AND implementation. The spike discovers how to do it; implementation comes after.
STEP 3 — Scope carefully: "Consolidate A, B, and C" is ONE task, not three. Combine logically related work.
STEP 4 — Assign using load + skills: Pick the team member with matching skills AND lowest current load. Do not assign overloaded engineers.
STEP 5 — Write real rationale: Explain the business or technical reasoning. NOT "X is the Y engineer who has skills Z" — that is lazy. Instead: why this priority? what's the risk if deferred? what does done look like?

ANTI-PATTERNS — never do these:
- Splitting one logical deliverable into multiple tasks (e.g., 3 tasks for "consolidate A, B, C" → make it 1)
- Adding both Spike + Implementation for the same feature (pick one)
- Writing rationale as job description ("X is the backend engineer with payment skills")
- Adding QA tasks unless the brief explicitly mentions testing or regression
- Inventing tasks not mentioned in the brief

Product brief: "${brief}"
Sprint context: ${sprint}
Team: ${team}

Return ONLY a valid JSON array, no markdown:
[{
  "title": "string (concise, action-oriented)",
  "description": "string (what exactly will be built/done, 1-2 sentences)",
  "type": "bug" | "feature" | "spike" | "design" | "chore",
  "urgency": "critical" | "high" | "medium" | "low",
  "impact": 1-5,
  "effort": 1-5,
  "risk": 1-5,
  "clarity": 1-5,
  "storyPoints": 1-8,
  "suggestedAssigneeName": "team member first name or null",
  "rationale": "WHY this priority and this assignee — business/technical reasoning, NOT job description. E.g. 'Wallet integration blocks the payment milestone and has highest user impact. Ananya owns the payment domain with 12pt capacity headroom.'"
}]
`

interface GeneratedTask {
  title: string
  description: string
  type: TaskType
  urgency: UrgencyLevel
  impact: number
  effort: number
  risk: number
  clarity: number
  storyPoints: number
  suggestedAssigneeName: string | null
  rationale: string
}

const TYPE_COLOR: Record<string, string> = {
  bug: 'var(--crit)', feature: 'var(--act)', spike: 'var(--warn)',
  design: 'var(--ok)', chore: 'var(--muted-foreground)',
}

export function SprintPlanner() {
  const { sprint, team, importTasks, addFeedEvent } = useSprintStore()
  const [brief, setBrief] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState<GeneratedTask[]>([])
  const [importing, setImporting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const handleGenerate = async () => {
    if (!brief.trim()) return
    setGenerating(true)
    setGenerated([])
    setError('')
    setDone(false)

    const teamContext = team.map(m =>
      `${m.name} (${m.role}, skills: ${m.skills.join(', ')}, load: ${m.currentLoad}%)`
    ).join('\n')

    const sprintContext = `Goal: ${sprint.goal}. ${sprint.daysRemaining} days left. ${sprint.committedPoints - sprint.completedPoints} pts capacity remaining.`

    try {
      const apiKey = import.meta.env.VITE_GROQ_API_KEY
      if (!apiKey || apiKey === 'paste_your_key_here') throw new Error('NO_KEY')

      const client = new Groq({ apiKey, dangerouslyAllowBrowser: true })
      const res = await client.chat.completions.create({
        model: 'llama-3.3-70b-versatile',   // better reasoning for planning tasks
        messages: [{ role: 'user', content: PLANNER_PROMPT(brief, teamContext, sprintContext) }],
        temperature: 0.4,
        max_tokens: 2000,
      })

      const text = res.choices[0].message.content ?? ''
      const match = text.match(/\[[\s\S]*\]/)
      if (!match) throw new Error('No JSON array in response')
      const tasks: GeneratedTask[] = JSON.parse(match[0])
      setGenerated(tasks)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed. Check your Groq API key.')
    } finally {
      setGenerating(false)
    }
  }

  const handleImport = async () => {
    if (!generated.length) return
    setImporting(true)

    const tasks: Task[] = generated.map((g, i) => {
      const member = g.suggestedAssigneeName
        ? team.find(m => m.name.toLowerCase().startsWith(g.suggestedAssigneeName!.toLowerCase()))
        : undefined

      return {
        id: `planned-${Date.now()}-${i}`,
        title: g.title,
        description: g.description,
        type: g.type,
        status: 'backlog',
        urgency: g.urgency,
        impact: g.impact,
        effort: g.effort,
        risk: g.risk,
        clarity: g.clarity,
        storyPoints: g.storyPoints,
        assigneeId: member?.id,
        dependencies: [],
        source: 'Sprint Planner / AI',
        createdAt: new Date().toISOString(),
        decisionReason: g.rationale,
        isNew: true,
      }
    })

    importTasks(tasks)
    addFeedEvent({
      type: 'intake',
      message: `Sprint Planner imported ${tasks.length} AI-generated tasks from brief: "${brief.slice(0, 60)}…". Agent will triage and assign.`,
      decision: 'ACT',
    })

    setImporting(false)
    setDone(true)
    setTimeout(() => { setBrief(''); setGenerated([]); setDone(false) }, 3000)
  }

  const totalPts = generated.reduce((s, t) => s + t.storyPoints, 0)
  const remaining = sprint.committedPoints - sprint.completedPoints

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ flexShrink: 0, padding: '13px 18px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <Wand2 size={13} style={{ color: 'var(--act)' }} strokeWidth={1.5} />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', letterSpacing: '-0.015em' }}>Sprint Planner</span>
        </div>
        <p style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
          Describe what you want to ship. Agent generates a full prioritized backlog.
        </p>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Input */}
        <div>
          <div className="label" style={{ marginBottom: 8 }}>Product Brief</div>
          <textarea
            value={brief}
            onChange={e => setBrief(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) handleGenerate() }}
            placeholder={'e.g. "Ship redesigned checkout with promo codes, Apple Pay, and mobile-optimized flow by end of sprint"'}
            rows={4}
            style={{
              width: '100%', resize: 'none', outline: 'none',
              background: 'var(--card)', border: '1px solid var(--border)',
              borderRadius: 6, padding: '10px 12px',
              fontSize: 12, color: 'var(--foreground)',
              fontFamily: 'Outfit, sans-serif', lineHeight: 1.6,
              transition: 'border-color 0.12s, box-shadow 0.12s',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--act)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--act-bg)' }}
            onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none' }}
          />
          <button
            onClick={handleGenerate}
            disabled={!brief.trim() || generating}
            className={brief.trim() && !generating ? 'btn btn-primary' : 'btn btn-secondary'}
            style={{ marginTop: 8, width: '100%', justifyContent: 'center', gap: 7 }}
          >
            {generating ? (
              <>
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}>
                  <Sparkles size={13} />
                </motion.div>
                Generating backlog…
              </>
            ) : (
              <><Sparkles size={13} /> Generate Backlog<span style={{ fontSize: 10, opacity: 0.6 }}>⌘↵</span></>
            )}
          </button>
          {error && <p style={{ fontSize: 11, color: 'var(--crit)', marginTop: 6 }}>{error}</p>}
        </div>

        {/* Generated tasks */}
        <AnimatePresence>
          {generated.length > 0 && !done && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {/* Summary bar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div className="label">{generated.length} tasks · {totalPts}pt total</div>
                <span style={{
                  fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                  background: totalPts > remaining ? 'var(--esc-bg)' : 'var(--act-bg)',
                  color: totalPts > remaining ? 'var(--esc-t)' : 'var(--act-t)',
                  border: `1px solid ${totalPts > remaining ? 'var(--esc-bd)' : 'var(--act-bd)'}`,
                  fontFamily: 'JetBrains Mono, monospace',
                }}>
                  {remaining}pt capacity remaining
                </span>
              </div>

              {/* Task list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                {generated.map((task, i) => {
                  const member = task.suggestedAssigneeName
                    ? team.find(m => m.name.toLowerCase().startsWith(task.suggestedAssigneeName!.toLowerCase()))
                    : null
                  return (
                    <motion.div key={i}
                      initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      style={{
                        padding: '10px 12px', borderRadius: 6,
                        background: 'var(--card)', border: '1px solid var(--border)',
                        boxShadow: '0 1px 3px rgba(9,9,11,0.06)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                            <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: TYPE_COLOR[task.type] ?? 'var(--muted-foreground)' }}>
                              {task.type}
                            </span>
                            <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: task.urgency === 'high' || task.urgency === 'critical' ? 'var(--crit)' : 'var(--muted-foreground)' }}>
                              {task.urgency}
                            </span>
                          </div>
                          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground)', letterSpacing: '-0.01em', marginBottom: 3 }}>
                            {task.title}
                          </p>
                          <p style={{ fontSize: 11, color: 'var(--muted-foreground)', lineHeight: 1.5, margin: 0 }}>
                            {task.rationale}
                          </p>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)', fontFamily: 'JetBrains Mono, monospace', lineHeight: 1 }}>
                            {task.storyPoints}pt
                          </div>
                          {member && (
                            <div style={{ fontSize: 9, color: 'var(--act-t)', marginTop: 3, fontWeight: 600 }}>
                              → {member.name.split(' ')[0]}
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 7 }}>
                <button onClick={handleImport} disabled={importing} className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                  <Plus size={12} strokeWidth={2} />
                  {importing ? 'Importing…' : `Import ${generated.length} tasks to backlog`}
                </button>
                <button onClick={() => { setGenerated([]); setBrief('') }} className="btn btn-secondary">
                  <RotateCcw size={12} strokeWidth={1.5} /> Reset
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Success */}
        <AnimatePresence>
          {done && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 0', gap: 10 }}
            >
              <CheckCircle size={28} style={{ color: 'var(--ok)' }} strokeWidth={1.5} />
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)' }}>Backlog imported</p>
                <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 3 }}>Agent is triaging tasks now — check Sprint Board</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
