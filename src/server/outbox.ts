// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import 'server-only'
import { lookup } from 'node:dns/promises'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/db/database.types'
import { escalationMessage, slackEscape } from '@/logic/slack'
import { MAX_ATTEMPTS, backoffMs, checkWebhookUrl, isPrivateHost, type IntegrationKind } from '@/logic/delivery'

type Db = SupabaseClient<Database>

/** Events the app can send out. The server formats them; clients never send raw webhook bodies. */
export const OutboxEvent = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('escalation'),
    taskTitle: z.string().min(1).max(300),
    reason: z.string().max(2_000),
    recommendation: z.string().max(2_000).default(''),
    urgency: z.enum(['critical', 'high', 'medium', 'low']),
    /** Lets the Slack app put a Resolve button on the message. Checked against the workspace on click. */
    escalationId: z.guid().optional(),
  }),
  z.object({ type: z.literal('standup'), text: z.string().min(1).max(8_000) }),
  z.object({
    type: z.literal('decision'),
    taskTitle: z.string().min(1).max(300),
    decision: z.enum(['ACT', 'ASK', 'ESCALATE']),
    reason: z.string().max(2_000),
  }),
])
export type OutboxEvent = z.infer<typeof OutboxEvent>

/** Which integration receives which event. Slack gets what a human should read; outbound gets everything. */
const ROUTES: Record<IntegrationKind, OutboxEvent['type'][]> = {
  slack_webhook: ['escalation', 'standup'],
  outbound_webhook: ['escalation', 'standup', 'decision'],
}

/** `interactive`: the workspace's Slack channel belongs to our installed app, so buttons will reach us. */
export function formatPayload(kind: IntegrationKind, e: OutboxEvent, appUrl?: string, interactive = false): unknown {
  if (kind === 'outbound_webhook') return { event: e.type, data: e, sentAt: new Date().toISOString() }
  if (e.type === 'standup') return { text: e.text, blocks: [{ type: 'section', text: { type: 'mrkdwn', text: slackEscape(e.text) } }] }
  if (e.type === 'escalation') return escalationMessage(e, { appUrl, interactive })
  return { text: `${e.decision}: ${e.taskTitle}` }
}

/** Queue an event for every enabled integration that wants it. Returns the number of deliveries queued. */
export async function enqueue(db: Db, workspaceId: string, event: OutboxEvent, appUrl?: string): Promise<number> {
  const { data: integrations, error } = await db.from('integrations').select('id, kind')
    .eq('workspace_id', workspaceId).eq('enabled', true)
  if (error) throw error
  const targets = (integrations ?? []).filter((i) => ROUTES[i.kind].includes(event.type))
  if (!targets.length) return 0
  const interactive = event.type === 'escalation' && !!event.escalationId && targets.some((i) => i.kind === 'slack_webhook')
    && !!(await db.from('slack_installations').select('id').eq('workspace_id', workspaceId).maybeSingle()).data
  const rows = targets.map((i) => ({ workspace_id: workspaceId, integration_id: i.id, event: event.type, payload: formatPayload(i.kind, event, appUrl, interactive) as never }))
  const { error: insErr } = await db.from('outbox').insert(rows)
  if (insErr) throw insErr
  return rows.length
}

type Fetch = typeof fetch
type Resolve = (host: string) => Promise<string[]>
const resolve4: Resolve = async (host) => (await lookup(host, { all: true, family: 4 })).map((a) => a.address)

/** POST one payload. Re-checks the URL and its resolved addresses at send time (DNS rebinding). */
export async function send(url: string, kind: IntegrationKind, payload: unknown, f: Fetch = fetch, resolveHost: Resolve = resolve4): Promise<void> {
  const bad = checkWebhookUrl(kind, url)
  if (bad) throw new Error(`REFUSED: ${bad}`)
  const addrs = await resolveHost(new URL(url).hostname)
  if (!addrs.length || addrs.some(isPrivateHost)) throw new Error('REFUSED: resolves to a private address')
  const res = await f(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': 'SprintAgent-Webhook/1' },
    body: JSON.stringify(payload), redirect: 'error', signal: AbortSignal.timeout(5_000),
  })
  if (!res.ok) throw new Error(`HTTP_${res.status}`)
}

/**
 * Deliver due outbox rows. Each row is claimed by bumping its attempt count first, so two concurrent
 * runners don't double-send. Failures back off exponentially; after MAX_ATTEMPTS a row is marked dead.
 */
export async function deliverDue(db: Db, opts: { workspaceId?: string; limit?: number; now?: Date; fetch?: Fetch; resolve?: Resolve } = {}) {
  const now = opts.now ?? new Date()
  let q = db.from('outbox').select('id, attempts, payload, integration_id, integrations!inner(url, kind, enabled)')
    .eq('status', 'pending').lte('next_attempt_at', now.toISOString()).order('next_attempt_at').limit(opts.limit ?? 25)
  if (opts.workspaceId) q = q.eq('workspace_id', opts.workspaceId)
  const { data: due, error } = await q
  if (error) throw error

  const result = { sent: 0, retried: 0, dead: 0 }
  for (const row of due ?? []) {
    const attempts = row.attempts + 1
    // Claim: only succeeds if nobody else bumped it since we read it.
    const { data: claimed } = await db.from('outbox')
      .update({ attempts, next_attempt_at: new Date(now.getTime() + backoffMs(attempts)).toISOString() })
      .eq('id', row.id).eq('attempts', row.attempts).eq('status', 'pending').select('id')
    if (!claimed?.length) continue

    const integ = row.integrations
    try {
      if (!integ.enabled) throw new Error('DISABLED')
      await send(integ.url, integ.kind, row.payload, opts.fetch, opts.resolve)
      await db.from('outbox').update({ status: 'sent', sent_at: now.toISOString(), last_error: null }).eq('id', row.id)
      result.sent++
    } catch (e) {
      const msg = (e instanceof Error ? e.message : String(e)).slice(0, 300)
      const dead = attempts >= MAX_ATTEMPTS || msg.startsWith('REFUSED')
      await db.from('outbox').update({ last_error: msg, ...(dead && { status: 'dead' as const }) }).eq('id', row.id)
      if (dead) result.dead++
      else result.retried++
    }
  }
  return result
}
