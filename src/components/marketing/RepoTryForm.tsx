// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
'use client'

import { useId, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { parseRepo } from '@/lib/githubRepo'
import { cn } from '@/lib/utils'

export function RepoTryForm({ initial = '', compact }: { initial?: string; compact?: boolean }) {
  const router = useRouter()
  const id = useId()
  const [value, setValue] = useState(initial)
  const [error, setError] = useState<string | null>(null)

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const parsed = parseRepo(value)
        if (!parsed) { setError('That doesn’t look like a GitHub repo. Try “owner/name”.'); return }
        setError(null)
        router.push(`/try?repo=${encodeURIComponent(`${parsed.owner}/${parsed.repo}`)}`)
      }}
      className={cn('w-full', compact ? '' : 'max-w-xl')}
    >
      <label htmlFor={id} className="sr-only">Public GitHub repository</label>
      <div className="flex flex-col gap-2 rounded-2xl bg-paper p-2 ring-1 ring-line focus-within:ring-2 focus-within:ring-agent-accent sm:flex-row">
        <input id={id} value={value} onChange={(e) => setValue(e.target.value)} placeholder="owner/repo, e.g. vercel/next.js"
          autoComplete="off" spellCheck={false} aria-invalid={!!error} aria-describedby={error ? `${id}-err` : undefined}
          className="min-w-0 flex-1 bg-transparent px-3 py-2.5 font-mono text-sm text-ink placeholder:text-mute focus:outline-none" />
        <button type="submit" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-ink px-4 text-sm font-medium text-paper hover:bg-ink-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-agent-accent">
          Triage my backlog <ArrowRight size={15} aria-hidden />
        </button>
      </div>
      {error && <p id={`${id}-err`} role="alert" className="mt-2 text-sm text-esc-accent">{error}</p>}
    </form>
  )
}
