import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Github, Download, Sparkles, CheckCircle, AlertTriangle } from 'lucide-react'
import { useSprintStore } from '../store/useSprintStore'
import type { Task, UrgencyLevel, TaskType } from '../types'

interface GHIssue {
  number: number
  title: string
  body: string | null
  labels: { name: string }[]
  state: string
}

function labelToType(labels: string[]): TaskType {
  if (labels.some(l => /bug|error|fix/i.test(l))) return 'bug'
  if (labels.some(l => /design|ui|ux/i.test(l))) return 'design'
  if (labels.some(l => /spike|research|explore/i.test(l))) return 'spike'
  if (labels.some(l => /chore|maintenance|refactor/i.test(l))) return 'chore'
  return 'feature'
}

function labelToUrgency(labels: string[]): UrgencyLevel {
  if (labels.some(l => /critical|P0|blocker|urgent/i.test(l))) return 'critical'
  if (labels.some(l => /high|P1|important/i.test(l))) return 'high'
  if (labels.some(l => /low|P3|nice-to-have/i.test(l))) return 'low'
  return 'medium'
}

export function GitHubImport() {
  const { importTasks, triageTaskById } = useSprintStore()
  const [repo, setRepo] = useState('')
  const [fetching, setFetching] = useState(false)
  const [issues, setIssues] = useState<GHIssue[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [importing, setImporting] = useState(false)
  const [done, setDone] = useState(0)
  const [error, setError] = useState('')
  const [totalCount, setTotalCount] = useState<number | null>(null)

  const handleFetch = async () => {
    const clean = repo.trim().replace('https://github.com/', '').replace(/\/$/, '')
    if (!clean.includes('/')) { setError('Enter in format owner/repo'); return }
    setFetching(true)
    setIssues([])
    setError('')
    setSelected(new Set())
    setTotalCount(null)

    try {
      // Use the Search API with is:issue to get only real issues, never PRs.
      // The /repos/.../issues endpoint mixes PRs in, so even per_page=100 can yield far fewer real issues.
      const searchRes = await fetch(`https://api.github.com/search/issues?q=repo:${clean}+is:issue+is:open&per_page=100&sort=updated`)
      if (!searchRes.ok) throw new Error(`GitHub API: ${searchRes.status} — check repo name`)
      const searchData = await searchRes.json()
      const real: GHIssue[] = searchData.items ?? []
      setIssues(real)
      setSelected(new Set(real.map((i: GHIssue) => i.number)))
      // total_count from the search response = exact open issue count (PRs excluded)
      setTotalCount(searchData.total_count ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fetch failed')
    } finally {
      setFetching(false)
    }
  }

  const handleImport = async () => {
    const toImport = issues.filter(i => selected.has(i.number))
    if (!toImport.length) return
    setImporting(true)

    const tasks: Task[] = toImport.map(issue => {
      const labels = issue.labels.map(l => l.name)
      return {
        id: `gh-${issue.number}-${Date.now()}`,
        title: `#${issue.number}: ${issue.title}`,
        description: (issue.body ?? '').slice(0, 300) || 'No description provided.',
        type: labelToType(labels),
        status: 'backlog' as const,
        urgency: labelToUrgency(labels),
        impact: 3, effort: 3, risk: 2,
        clarity: issue.body && issue.body.length > 100 ? 3 : 1,
        storyPoints: 3,
        dependencies: [],
        source: `GitHub / ${repo.replace('https://github.com/', '')}`,
        tags: labels.slice(0, 3),
        createdAt: new Date().toISOString(),
        isNew: true,
      }
    })

    importTasks(tasks)
    setDone(tasks.length)
    setImporting(false)

    // AI triage for first 15 only — keeps peak load at ~15 RPM, well within Groq's 30 RPM cap.
    // The remaining tasks get deterministic rule triage immediately (instant, no API).
    const AI_TRIAGE_LIMIT = 15
    tasks.forEach((t, i) => {
      if (i < AI_TRIAGE_LIMIT) {
        // Stagger AI calls at 2100ms → 28.6 RPM, just under the 30 RPM hard cap
        setTimeout(() => triageTaskById(t.id), i * 2100)
      } else {
        // Deterministic rule triage — instant, no API, still uses full ACT/ASK/ESCALATE logic
        setTimeout(() => triageTaskById(t.id), AI_TRIAGE_LIMIT * 2100 + (i - AI_TRIAGE_LIMIT) * 50)
      }
    })
  }

  return (
    <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
        <Github size={13} style={{ color: 'var(--foreground)' }} strokeWidth={1.5} />
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--foreground)' }}>Import from GitHub</span>
      </div>
      <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: -8 }}>
        Pulls open issues from any public repo. No auth needed.
      </p>

      <div style={{ display: 'flex', gap: 6 }}>
        <input
          value={repo}
          onChange={e => setRepo(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleFetch()}
          placeholder="owner/repo  or  github.com/owner/repo"
          style={{
            flex: 1, outline: 'none',
            background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: 5, padding: '6px 10px',
            fontSize: 12, color: 'var(--foreground)', fontFamily: 'JetBrains Mono, monospace',
            transition: 'border-color 0.12s',
          }}
          onFocus={e => (e.currentTarget.style.borderColor = 'var(--act)')}
          onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
        />
        <button onClick={handleFetch} disabled={fetching || !repo.trim()} className="btn btn-secondary" style={{ gap: 5, flexShrink: 0 }}>
          {fetching ? (
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}>
              <Download size={11} />
            </motion.div>
          ) : <Download size={11} strokeWidth={1.5} />}
          {fetching ? 'Fetching…' : 'Fetch'}
        </button>
      </div>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', borderRadius: 5, background: 'var(--esc-bg)', border: '1px solid var(--esc-bd)' }}>
          <AlertTriangle size={11} style={{ color: 'var(--esc-t)', flexShrink: 0 }} strokeWidth={1.5} />
          <span style={{ fontSize: 11, color: 'var(--esc-t)' }}>{error}</span>
        </div>
      )}

      <AnimatePresence>
        {issues.length > 0 && !done && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div className="label">
              {issues.length} issues shown
              {totalCount !== null && totalCount > issues.length && (
                <span style={{ color: 'var(--muted-foreground)', fontWeight: 400 }}>
                  {' '}(repo has {totalCount} open — showing first {issues.length})
                </span>
              )}
              {' '}— {selected.size} selected
            </div>
              <button
                onClick={() => setSelected(selected.size === issues.length ? new Set() : new Set(issues.map(i => i.number)))}
                style={{ fontSize: 10, color: 'var(--act)', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: 600 }}
              >
                {selected.size === issues.length ? 'Deselect all' : 'Select all'}
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 240, overflowY: 'auto', marginBottom: 10 }}>
              {issues.map(issue => {
                const isSelected = selected.has(issue.number)
                const labels = issue.labels.map(l => l.name)
                return (
                  <div
                    key={issue.number}
                    onClick={() => {
                      const next = new Set(selected)
                      isSelected ? next.delete(issue.number) : next.add(issue.number)
                      setSelected(next)
                    }}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 8, padding: '7px 10px',
                      borderRadius: 5, cursor: 'pointer',
                      background: isSelected ? 'var(--act-bg)' : 'var(--muted)',
                      border: `1px solid ${isSelected ? 'var(--act-bd)' : 'var(--border)'}`,
                      transition: 'background 0.1s, border-color 0.1s',
                    }}
                  >
                    <div style={{
                      width: 14, height: 14, borderRadius: 3, flexShrink: 0, marginTop: 1,
                      background: isSelected ? 'var(--act)' : 'transparent',
                      border: `1.5px solid ${isSelected ? 'var(--act)' : 'var(--muted-foreground)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {isSelected && <span style={{ color: '#fff', fontSize: 9, lineHeight: 1 }}>✓</span>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 11, fontWeight: 500, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
                        #{issue.number} {issue.title}
                      </p>
                      {labels.length > 0 && (
                        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 3 }}>
                          {labels.slice(0, 3).map(l => (
                            <span key={l} style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'var(--muted)', border: '1px solid var(--border)', color: 'var(--muted-foreground)', fontWeight: 500 }}>
                              {l}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            <button
              onClick={handleImport}
              disabled={!selected.size || importing}
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', gap: 6 }}
            >
              <Sparkles size={11} />
              {importing ? 'Importing…' : `Import ${selected.size} issues + AI triage`}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {done > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 11px', borderRadius: 5, background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.20)' }}
        >
          <CheckCircle size={12} style={{ color: 'var(--ok)', flexShrink: 0 }} strokeWidth={1.5} />
          <span style={{ fontSize: 11, color: 'var(--foreground)' }}>
            <strong>{done} issues</strong> imported. AI triaging all {done} — check Sprint Board.
          </span>
        </motion.div>
      )}
    </div>
  )
}
