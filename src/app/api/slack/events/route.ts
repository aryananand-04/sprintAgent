// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { afterResponse } from '@/server/background'
import { verifySlackRequest, slackApi } from '@/server/slack/api'
import { forget, linkForTeam } from '@/server/slack/install'
import { gate } from '@/server/slack/actions'
import { intakeFromSlack } from '@/server/slack/intake'

const Envelope = z.discriminatedUnion('type', [
  z.object({ type: z.literal('url_verification'), challenge: z.string().max(200) }),
  z.object({
    type: z.literal('event_callback'),
    team_id: z.string(),
    event_id: z.string().max(100),
    event: z.object({
      type: z.string(),
      user: z.string().optional(),
      bot_id: z.string().optional(),
      text: z.string().max(40_000).optional(),
      channel: z.string().optional(),
      ts: z.string().optional(),
      thread_ts: z.string().optional(),
    }),
  }),
])

/** Slack Events API: @mentions file requests; uninstall and token revocation unlink the workspace. */
export async function POST(req: Request): Promise<Response> {
  const raw = await req.text()
  if (!verifySlackRequest(raw, req.headers.get('x-slack-request-timestamp'), req.headers.get('x-slack-signature'))) {
    return Response.json({ error: 'BAD_SIGNATURE' }, { status: 401 })
  }
  let json: unknown
  try { json = JSON.parse(raw) } catch { return new Response(null, { status: 400 }) }
  const p = Envelope.safeParse(json)
  if (!p.success) return new Response(null, { status: 200 })
  if (p.data.type === 'url_verification') return Response.json({ challenge: p.data.challenge })

  const { team_id, event_id, event } = p.data
  // Answer within Slack's 3 seconds and do the work after; retries of the same event are claimed away.
  await afterResponse(async () => {
    const db = createAdminClient()
    const link = await linkForTeam(db, team_id).catch(() => null)
    if (!link) return
    if (event.type === 'app_uninstalled' || event.type === 'tokens_revoked') return forget(db, link.workspaceId)
    if (event.type !== 'app_mention' || event.bot_id || !event.user || !event.channel || !event.ts) return

    const { data: first } = await db.rpc('claim_agent_cooldown', { ws: link.workspaceId, check_key: `slack-event-${event_id}`, cooldown_seconds: 86_400 })
    if (!first) return
    const thread = event.thread_ts ?? event.ts
    const g = await gate(db, link, event.user, 'task:create')
    if (!g.ok) {
      await slackApi('chat.postEphemeral', link.token, { channel: event.channel, user: event.user, text: g.message }).catch(() => {})
      return
    }
    const msg = await intakeFromSlack(db, link.workspaceId, g.member, event.text ?? '')
      .catch((e) => { console.error('[slack] mention', e instanceof Error ? e.message : e); return { text: 'Something went wrong while filing that. Check the board before trying again, in case it got through.' } })
    await slackApi('chat.postMessage', link.token, { channel: event.channel, thread_ts: thread, ...msg }).catch((e) => console.error('[slack] reply', e))
  })
  return new Response(null, { status: 200 })
}
