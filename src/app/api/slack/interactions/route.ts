// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { RESOLVE_ACTION, ephemeral, resolvedMessage } from '@/logic/slack'
import { verifySlackRequest } from '@/server/slack/api'
import { linkForTeam } from '@/server/slack/install'
import { gate, resolveEscalation } from '@/server/slack/actions'

const BlockAction = z.object({
  type: z.literal('block_actions'),
  team: z.object({ id: z.string() }),
  user: z.object({ id: z.string() }),
  response_url: z.string().startsWith('https://hooks.slack.com/'),
  actions: z.array(z.object({ action_id: z.string(), value: z.string().optional() })).min(1),
})

/** Replies through Slack's response_url (the only way to answer a button click). */
const reply = (url: string, body: unknown) =>
  fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(5_000) })
    .catch((e) => console.error('[slack] reply', e instanceof Error ? e.message : e))

/** Button clicks from Slack messages. Signature first; the clicker's role is checked like in the app. */
export async function POST(req: Request): Promise<Response> {
  const raw = await req.text()
  if (!verifySlackRequest(raw, req.headers.get('x-slack-request-timestamp'), req.headers.get('x-slack-signature'))) {
    return Response.json({ error: 'BAD_SIGNATURE' }, { status: 401 })
  }
  let json: unknown
  try { json = JSON.parse(new URLSearchParams(raw).get('payload') ?? '') } catch { return new Response(null, { status: 400 }) }
  const p = BlockAction.safeParse(json)
  if (!p.success) return new Response(null, { status: 200 }) // other interaction types: acknowledged, ignored
  const action = p.data.actions[0]
  if (action.action_id !== RESOLVE_ACTION || !z.guid().safeParse(action.value).success) return new Response(null, { status: 200 })

  const db = createAdminClient()
  const link = await linkForTeam(db, p.data.team.id)
  if (!link) {
    await reply(p.data.response_url, ephemeral('This Slack workspace isn’t linked to Sprint Agent any more.'))
    return new Response(null, { status: 200 })
  }
  const g = await gate(db, link, p.data.user.id, 'escalation:resolve')
  if (!g.ok) {
    await reply(p.data.response_url, ephemeral(g.message))
    return new Response(null, { status: 200 })
  }
  const r = await resolveEscalation(db, link.workspaceId, action.value!, g.member)
  if (r.result === 'resolved') await reply(p.data.response_url, resolvedMessage(r.taskTitle, p.data.user.id))
  else await reply(p.data.response_url, ephemeral(r.result === 'already' ? 'Someone already resolved this one.' : 'That escalation no longer exists.'))
  return new Response(null, { status: 200 })
}
