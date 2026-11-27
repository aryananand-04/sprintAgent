// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ExternalLink } from 'lucide-react'
import { parseRepo } from '@/lib/githubRepo'
import { triageIssues, summarize, type GhIssue, type TriagedIssue } from '@/lib/triageIssues'
import { RepoTryForm } from '@/components/marketing/RepoTryForm'
import { ButtonLink, TONE } from '@/components/marketing/primitives'
import type { AgentDecision } from '@/types'
import { cn } from '@/lib/utils'

type State =
  | { status: 'idle' }
  | { status: 'loading'; repo: string }
  | { status: 'error'; repo: string; message: string }
  | { status: 'done'; repo: string; issues: TriagedIssue[] }

const TONE_OF: Record<AgentDecision, 'act' | 'ask' | 'esc'> = { ACT: 'act', ASK: 'ask', ESCALATE: 'esc' }
const LABEL: Record<AgentDecision, string> = { ACT: 'Act', ASK: 'Ask', ESCALATE: 'Escalate' }

async function fetchIssues(owner: string, repo: string): Promise<GhIssue[]> {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues?state=open&per_page=50`, {
    headers: { Accept: 'application/vnd.github+json' },
  })
  if (res.status === 404) throw new Error('Couldn’t find that repo. Is it public, and spelled right?')
  if (res.status === 403 || res.status === 429) {
    const reset = Number(res.headers.get('x-ratelimit-reset'))
    const mins = reset ? Math.max(1, Math.ceil((reset * 1000 - Date.now()) / 60000)) : null
    throw new Error(`GitHub’s anonymous limit (60 requests/hour from your network) is used up.${mins ? ` Try again in about ${mins} min.` : ''}`)
  }
  if (!res.ok) throw new Error('GitHub didn’t answer properly. Give it a minute and try again.')
  return res.json()
}

export function TryRepo() {
  const params = useSearchParams()
  const raw = params.get('repo') ?? ''
  const parsed = useMemo(() => parseRepo(raw), [raw])
  const repoName = parsed ? `${parsed.owner}/${parsed.repo}` : ''
  const [state, setState] = useState<State>({ status: 'idle' })
  const [filter, setFilter] = useState<AgentDecision | 'ALL'>('ALL')

  useEffect(() => {
    if (!parsed) return
    let cancelled = false
    const name = `${parsed.owner}/${parsed.repo}`
    queueMicrotask(() => { if (!cancelled) setState({ status: 'loading', repo: name }) })
    fetchIssues(parsed.owner, parsed.repo)
      .then((data) => { if (!cancelled) setState({ status: 'done', repo: name, issues: triageIssues(data) }) })
      .catch((e: Error) => { if (!cancelled) setState({ status: 'error', repo: name, message: e.message }) })
    return () => { cancelled = true }
  }, [parsed])

  const issues = state.status === 'done' ? state.issues : []
  const counts = { ACT: 0, ASK: 0, ESCALATE: 0 } as Record<AgentDecision, number>
  for (const i of issues) counts[i.decision]++
  const shown = filter === 'ALL' ? issues : issues.filter((i) => i.decision === filter)

  return (
    <div>
      <RepoTryForm key={repoName} initial={repoName} />

      {state.status === 'loading' && (
        <p className="mt-10 font-hand text-xl text-ink-2" role="status">Reading {state.repo}’s open issues…</p>
      )}

      {state.status === 'error' && (
        <div role="alert" className="mt-10 rounded-2xl bg-esc-tint p-5 text-esc-ink">
          <p className="font-semibold">{state.repo}</p>
          <p className="mt-1 text-[15px]">{state.message}</p>
        </div>
      )}

      {state.status === 'done' && (
        <section className="mt-10" aria-labelledby="report-title">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 id="report-title" className="display-md text-ink">{state.repo}</h2>
              <p className="mt-2 text-lg text-ink-2">{issues.length} open issues, triaged. {summarize(issues)}</p>
            </div>
          </div>

          <div role="group" aria-label="Filter by decision" className="mt-6 flex flex-wrap gap-2">
            {(['ALL', 'ACT', 'ASK', 'ESCALATE'] as const).map((f) => (
              <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}
                className={cn('rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 transition-colors',
                  filter === f ? 'bg-ink text-paper ring-ink' : 'bg-paper text-ink-2 ring-line hover:bg-paper-2')}>
                {f === 'ALL' ? `All ${issues.length}` : `${LABEL[f]} ${counts[f]}`}
              </button>
            ))}
          </div>

          <ul className="mt-6 space-y-3">
            {shown.map((i) => {
              const t = TONE[TONE_OF[i.decision]]
              return (
                <li key={i.number} className="rounded-2xl bg-paper-2 p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <a href={i.url} target="_blank" rel="noopener noreferrer" className="group inline-flex max-w-full items-start gap-1.5 text-[15px] font-medium text-ink hover:underline">
                      <span className="font-mono text-xs text-mute">#{i.number}</span>
                      <span className="min-w-0 break-words">{i.title}</span>
                      <ExternalLink size={13} className="mt-1 shrink-0 text-mute" aria-label="(opens GitHub)" />
                    </a>
                    <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-semibold', t.tint, t.accent)}>{LABEL[i.decision]} · {i.score}</span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-ink-2">{i.reason}</p>
                  {i.question && (
                    <p className="mt-3 rounded-xl bg-paper px-3 py-2 text-sm text-ink">
                      <span className="text-mute">The agent would ask: </span>{i.question}
                    </p>
                  )}
                </li>
              )
            })}
          </ul>

          <div className="mt-10 grid gap-4 rounded-3xl bg-agent-tint p-6 text-agent-ink sm:grid-cols-[1fr_auto] sm:items-center sm:p-8">
            <div>
              <p className="display-sm">Want it to keep doing this?</p>
              <p className="mt-2 text-[15px] opacity-85">Connect the repo and it triages new issues as they arrive. First sprint is shadow mode: it changes nothing and tells you what it would have done.</p>
            </div>
            <ButtonLink href="/login" size="lg" arrow>Start free</ButtonLink>
          </div>
        </section>
      )}

      <p className="mt-8 text-xs text-mute">Runs in your browser with GitHub’s public API and the same rule engine as the product. Nothing is stored. It uses your rate limit, not ours.</p>
    </div>
  )
}
