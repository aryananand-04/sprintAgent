// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { useEffect, useState } from 'react'
import { SlackIcon } from '../ui/brand-icons'

interface Status { configured: boolean; installation: { team_name: string; channel_name: string | null; created_at: string; dm_briefings: boolean } | null }

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
  const toggleDms = async (on: boolean) => {
    setBusy(true)
    const res = await fetch('/api/slack/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dmBriefings: on }) })
    if (res.ok) setStatus((s) => s?.installation ? { ...s, installation: { ...s.installation, dm_briefings: on } } : s)
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
      {inst && (
        <label className="mb-2 flex items-start gap-2 text-[11px] leading-relaxed text-foreground">
          <input type="checkbox" className="mt-0.5" disabled={!isAdmin || busy} checked={inst.dm_briefings} onChange={(e) => toggleDms(e.target.checked)} />
          <span>Send each person a short DM at 9am with their own work and any question waiting on them. People with nothing on their plate get nothing.</span>
        </label>
      )}
      {isAdmin && status?.configured && (
        <div className="flex gap-1.5">
          <a href="/api/slack/connect" className="btn btn-secondary inline-flex">{inst ? 'Change channel' : 'Add to Slack'}</a>
          {inst && <button type="button" onClick={disconnect} disabled={busy} className="btn btn-secondary">Disconnect</button>}
        </div>
      )}
    </div>
  )
}
