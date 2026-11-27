// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { useEffect, useState } from 'react'
import { SlackIcon } from '../ui/brand-icons'

type Kind = 'slack_webhook' | 'outbound_webhook'
interface Saved { kind: Kind; masked: string; enabled: boolean }

const COPY: Record<Kind, { title: string; help: string; placeholder: string }> = {
  slack_webhook: {
    title: 'Slack webhook',
    help: 'Escalations and the daily standup post here. Create one at api.slack.com/apps → Incoming Webhooks.',
    placeholder: 'https://hooks.slack.com/services/…',
  },
  outbound_webhook: {
    title: 'Outbound webhook',
    help: 'Every agent decision is sent here as JSON, with retries if your endpoint is down.',
    placeholder: 'https://your-endpoint.example/hooks/sprint-agent',
  },
}

/** Workspace integrations, stored server-side. URLs are secrets: the server only ever returns a masked copy. */
export function IntegrationsSettings({ canEdit }: { canEdit: boolean }) {
  const [saved, setSaved] = useState<Saved[] | null>(null)

  useEffect(() => {
    if (!canEdit) return
    fetch('/api/integrations').then((r) => (r.ok ? r.json() : { integrations: [] }))
      .then((d: { integrations: Saved[] }) => setSaved(d.integrations)).catch(() => setSaved([]))
  }, [canEdit])

  if (!canEdit) return <p className="text-[11px] text-muted-foreground">Integrations are managed by workspace admins.</p>
  return (
    <div className="flex flex-col gap-5">
      {(['slack_webhook', 'outbound_webhook'] as const).map((kind) => (
        <WebhookField key={kind} kind={kind} current={saved?.find((s) => s.kind === kind)} loading={!saved}
          onChange={(next) => setSaved((prev) => [...(prev ?? []).filter((s) => s.kind !== kind), ...(next ? [next] : [])])} />
      ))}
    </div>
  )
}

function WebhookField({ kind, current, loading, onChange }: { kind: Kind; current?: Saved; loading: boolean; onChange: (s: Saved | null) => void }) {
  const c = COPY[kind]
  const [url, setUrl] = useState('')
  const [state, setState] = useState<{ busy?: boolean; error?: string; ok?: string }>({})
  const id = `wh-${kind}`

  const save = async () => {
    setState({ busy: true })
    const res = await fetch('/api/integrations', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, url }) })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return setState({ error: data.message ?? 'Couldn’t save that. Try again.' })
    onChange({ kind, masked: data.masked, enabled: true })
    setUrl('')
    setState({ ok: 'Saved.' })
  }
  const remove = async () => {
    setState({ busy: true })
    await fetch(`/api/integrations?kind=${kind}`, { method: 'DELETE' })
    onChange(null)
    setState({ ok: 'Removed.' })
  }

  return (
    <div>
      <label htmlFor={id} className="mb-1 flex items-center gap-1.5 text-xs font-bold text-foreground">
        {kind === 'slack_webhook' && <SlackIcon size={13} strokeWidth={1.5} />}{c.title}
      </label>
      <p className="mb-2 text-[11px] leading-relaxed text-muted-foreground">{c.help}</p>
      {current && (
        <p className="mb-2 flex items-center justify-between gap-2 text-[11px]">
          <span className="font-mono text-foreground">{current.masked}</span>
          <button type="button" onClick={remove} disabled={state.busy} className="btn btn-secondary">Remove</button>
        </p>
      )}
      <div className="flex gap-1.5">
        <input id={id} value={url} onChange={(e) => setUrl(e.target.value)} placeholder={current ? 'Paste a new URL to replace it' : c.placeholder}
          className="min-w-0 flex-1 rounded-[5px] border border-border bg-muted px-2.5 py-2 font-mono text-[11px] text-foreground outline-none focus:border-[var(--act)]"
          aria-describedby={`${id}-status`} disabled={loading} />
        <button type="button" onClick={save} disabled={!url.trim() || state.busy} className="btn btn-primary shrink-0">Save</button>
      </div>
      <p id={`${id}-status`} role="status" className={`mt-1.5 text-[11px] ${state.error ? 'text-[var(--esc)]' : 'text-muted-foreground'}`}>
        {state.error ?? state.ok ?? ''}
      </p>
    </div>
  )
}
