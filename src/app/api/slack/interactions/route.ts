// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { ANSWER_ACTION, ANSWER_BLOCK, ANSWER_INPUT, ANSWER_VIEW, RESOLVE_ACTION, ephemeral, resolvedMessage } from '@/logic/slack'
import { slackApi, verifySlackRequest } from '@/server/slack/api'
import { linkForTeam } from '@/server/slack/install'
import { gate, resolveEscalation } from '@/server/slack/actions'
import { openAnswerModal, submitAnswer } from '@/server/slack/answers'
import { afterResponse } from '@/server/background'

const Who = { team: z.object({ id: z.string() }), user: z.object({ id: z.string() }) }
const Interaction = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('block_actions'), ...Who,
    trigger_id: z.string().optional(),
    response_url: z.string().startsWith('https://hooks.slack.com/').optional(),
    actions: z.array(z.object({ action_id: z.string(), value: z.string().optional() })).min(1),
  }),
  z.object({
    type: z.literal('view_submission'), ...Who,
    view: z.object({
      callback_id: z.string(),
      private_metadata: z.string(),
      state: z.object({ values: z.record(z.string(), z.record(z.string(), z.object({ value: z.string().nullable().optional() }))) }),
    }),
  }),
])

const ok = () => new Response(null, { status: 200 })
const isId = (v: string | undefined): v is string => z.guid().safeParse(v).success

/** Replies through Slack's response_url (the only way to answer a click on a message). */
const reply = (url: string | undefined, body: unknown) => url
  ? fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(5_000) })
    .then(() => undefined).catch((e) => console.error('[slack] reply', e instanceof Error ? e.message : e))
  : Promise.resolve()

/** Clicks and form submissions from Slack. Signature first; every action is checked against the clicker's role. */
export async function POST(req: Request): Promise<Response> {
  const raw = await req.text()
  if (!verifySlackRequest(raw, req.headers.get('x-slack-request-timestamp'), req.headers.get('x-slack-signature'))) {
    return Response.json({ error: 'BAD_SIGNATURE' }, { status: 401 })
  }
  let json: unknown
  try { json = JSON.parse(new URLSearchParams(raw).get('payload') ?? '') } catch { return new Response(null, { status: 400 }) }
  const p = Interaction.safeParse(json)
  if (!p.success) return ok() // other interaction types: acknowledged, ignored

  const db = createAdminClient()
  const link = await linkForTeam(db, p.data.team.id)

  // ── Answer box submitted ────────────────────────────────────────────
  if (p.data.type === 'view_submission') {
    const { view, user } = p.data
    if (view.callback_id !== ANSWER_VIEW || !isId(view.private_metadata)) return ok()
    const fail = (msg: string) => Response.json({ response_action: 'errors', errors: { [ANSWER_BLOCK]: msg } })
    if (!link) return fail('This Slack workspace isn’t linked to Sprint Agent any more.')
    const g = await gate(db, link, user.id, 'task:create')
    if (!g.ok) return fail(g.message)
    const text = view.state.values[ANSWER_BLOCK]?.[ANSWER_INPUT]?.value ?? ''
    const r = await submitAnswer(db, link, g.member, view.private_metadata, text)
    if (!r.ok) return fail(r.error)
    // The modal closes on this response; the outcome follows as a DM.
    await afterResponse(() => slackApi('chat.postMessage', link.token, { channel: user.id, text: r.reply }).catch((e) => console.error('[slack] answer reply', e)))
    return ok()
  }

  // ── Buttons ─────────────────────────────────────────────────────────
  const { actions, user, response_url, trigger_id } = p.data
  const action = actions[0]
  if (!isId(action.value) || (action.action_id !== RESOLVE_ACTION && action.action_id !== ANSWER_ACTION)) return ok()
  if (!link) { await reply(response_url, ephemeral('This Slack workspace isn’t linked to Sprint Agent any more.')); return ok() }

  if (action.action_id === ANSWER_ACTION) {
    if (!trigger_id) return ok()
    const g = await gate(db, link, user.id, 'task:create')
    if (!g.ok) { await reply(response_url, ephemeral(g.message)); return ok() }
    const problem = await openAnswerModal(db, link, action.value, trigger_id).catch((e) => { console.error('[slack] views.open', e); return 'Couldn’t open the answer box. Try again, or answer in the app.' })
    if (problem) await reply(response_url, ephemeral(problem))
    return ok()
  }

  const g = await gate(db, link, user.id, 'escalation:resolve')
  if (!g.ok) { await reply(response_url, ephemeral(g.message)); return ok() }
  const r = await resolveEscalation(db, link.workspaceId, action.value, g.member)
  if (r.result === 'resolved') await reply(response_url, resolvedMessage(r.taskTitle, user.id))
  else await reply(response_url, ephemeral(r.result === 'already' ? 'Someone already resolved this one.' : 'That escalation no longer exists.'))
  return ok()
}
