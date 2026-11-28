// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { useEffect, useState } from 'react'
import { SlackIcon } from '../ui/brand-icons'

interface Status { configured: boolean; installation: { team_name: string; channel_name: string | null; created_at: string } | null }

/** Install the Sprint Agent Slack app. Admins connect and disconnect; PMs see what's linked. */
export function SlackSettings({ isAdmin }: { isAdmin: boolean }) {
  const [status, setStatus] = useState<Status | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    fetch('/api/slack/status').then((r) => (r.ok ? r.json() : null)).then(setStatus).catch(() => setStatus(null))
  }, [])
  const disconnect = async () => {
    setBusy(true)
    const res = await fetch('/api/slack/status', { method: 'DELETE' })
    if (res.ok) setStatus((s) => s && { ...s, installation: null })
    setBusy(false)
  }
  const inst = status?.installation

  return (
    <div>
      <p className="mb-1 flex items-center gap-1.5 text-xs font-bold text-foreground"><SlackIcon size={13} strokeWidth={1.5} /> Slack app</p>
      <p className="mb-2 text-[11px] leading-relaxed text-muted-foreground">
        Escalations and the standup arrive in a channel you pick, with a button to resolve escalations there. Contributors can file work with <span className="font-mono">/sprint</span> or by mentioning the app. Installing replaces a pasted Slack webhook.
      </p>
      {inst ? (
        <p className="mb-2 text-[11px] font-mono text-foreground">
          Connected: {inst.team_name}{inst.channel_name ? ` · ${inst.channel_name}` : ''}
        </p>
      ) : status && !status.configured ? (
        <p className="mb-2 text-[11px] text-muted-foreground">The Slack app isn’t set up on this server yet.</p>
      ) : null}
      {isAdmin && status?.configured && (
        <div className="flex gap-1.5">
          <a href="/api/slack/connect" className="btn btn-secondary inline-flex">{inst ? 'Change channel' : 'Add to Slack'}</a>
          {inst && <button type="button" onClick={disconnect} disabled={busy} className="btn btn-secondary">Disconnect</button>}
        </div>
      )}
    </div>
  )
}
