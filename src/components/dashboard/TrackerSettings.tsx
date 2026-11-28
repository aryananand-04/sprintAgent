// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { useEffect, useState } from 'react'

type Kind = 'linear' | 'jira'
interface Status { configured: boolean; connection: { name: string; site_url: string; write_back: boolean; created_at: string } | null }

const COPY: Record<Kind, { title: string; help: string; where: string }> = {
  linear: { title: 'Linear', help: 'Imports open issues, keeps them in sync, and triages new ones as they arrive. Replies on an ASK issue count as answers.', where: 'Linear' },
  jira: { title: 'Jira', help: 'Imports open issues from your Jira site, keeps them in sync, and triages new ones as they arrive. Comments on an ASK issue count as answers.', where: 'Jira' },
}

/** Connect Linear or Jira. Admins connect, disconnect and choose write-back; PMs see what's linked. */
export function TrackerSettings({ kind, isAdmin }: { kind: Kind; isAdmin: boolean }) {
  const [status, setStatus] = useState<Status | null>(null)
  const [busy, setBusy] = useState(false)
  const c = COPY[kind]
  useEffect(() => {
    fetch(`/api/trackers/${kind}/status`).then((r) => (r.ok ? r.json() : null)).then(setStatus).catch(() => setStatus(null))
  }, [kind])
  const update = (patch: Partial<NonNullable<Status['connection']>> | null) =>
    setStatus((s) => s && { ...s, connection: patch === null ? null : s.connection && { ...s.connection, ...patch } })
  const toggle = async (writeBack: boolean) => {
    setBusy(true)
    const res = await fetch(`/api/trackers/${kind}/settings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ writeBack }) })
    if (res.ok) update({ write_back: writeBack })
    setBusy(false)
  }
  const disconnect = async () => {
    setBusy(true)
    if ((await fetch(`/api/trackers/${kind}/status`, { method: 'DELETE' })).ok) update(null)
    setBusy(false)
  }
  const conn = status?.connection

  return (
    <div>
      <p className="mb-1 text-xs font-bold text-foreground">{c.title}</p>
      <p className="mb-2 text-[11px] leading-relaxed text-muted-foreground">{c.help}</p>
      {conn ? (
        <p className="mb-2 text-[11px] font-mono text-foreground">Connected: {conn.name}</p>
      ) : status && !status.configured ? (
        <p className="mb-2 text-[11px] text-muted-foreground">{c.title} isn’t set up on this server yet.</p>
      ) : null}
      {conn && (
        <label className="mb-2 flex items-start gap-2 text-[11px] leading-relaxed text-foreground">
          <input type="checkbox" className="mt-0.5" disabled={!isAdmin || busy} checked={conn.write_back} onChange={(e) => toggle(e.target.checked)} />
          <span>Post triage back to {c.where}: a <span className="font-mono">sprint-agent</span> label on each new or re-triaged issue, and the agent’s question as a comment on ASK issues (once per issue). Everyone who can see the issue will see these.</span>
        </label>
      )}
      {isAdmin && status?.configured && (
        <div className="flex gap-1.5">
          {!conn && <a href={`/api/trackers/${kind}/connect`} className="btn btn-secondary inline-flex">Connect {c.title}</a>}
          {conn && <button type="button" onClick={disconnect} disabled={busy} className="btn btn-secondary">Disconnect</button>}
        </div>
      )}
    </div>
  )
}
