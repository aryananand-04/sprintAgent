// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { useEffect, useState } from 'react'
import { GithubIcon } from '../ui/brand-icons'

interface Status { configured: boolean; installations: Array<{ account_login: string; created_at: string }> }

/** Connect the workspace to the Sprint Agent GitHub App. Admins connect; PMs see what's linked. */
export function GitHubSettings({ isAdmin }: { isAdmin: boolean }) {
  const [status, setStatus] = useState<Status | null>(null)
  useEffect(() => {
    fetch('/api/github/status').then((r) => (r.ok ? r.json() : null)).then(setStatus).catch(() => setStatus(null))
  }, [])

  return (
    <div>
      <p className="mb-1 flex items-center gap-1.5 text-xs font-bold text-foreground"><GithubIcon size={13} /> GitHub</p>
      <p className="mb-2 text-[11px] leading-relaxed text-muted-foreground">
        Imports open issues from the repos you choose, keeps them in sync, and triages new ones as they arrive. Private repos included.
      </p>
      {status?.installations.length ? (
        <ul className="mb-2 flex flex-col gap-1 text-[11px]">
          {status.installations.map((i) => (
            <li key={i.account_login} className="font-mono text-foreground">Connected: {i.account_login}</li>
          ))}
        </ul>
      ) : status && !status.configured ? (
        <p className="mb-2 text-[11px] text-muted-foreground">The GitHub App isn’t set up on this server yet.</p>
      ) : null}
      {isAdmin && status?.configured && (
        <a href="/api/github/connect" className="btn btn-secondary inline-flex">
          {status.installations.length ? 'Add repositories or accounts' : 'Connect GitHub'}
        </a>
      )}
    </div>
  )
}
