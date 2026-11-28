// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
// Runs against the local Supabase (npm run test:db). Slack is faked; nothing leaves the machine.
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { createHmac, randomBytes, randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/db/database.types'
import { forget, saveInstall } from '@/server/slack/install'
import { POST } from './route'

const db = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } })
const SECRET = 'test-signing-secret'
const TEAM = 'TANSWER'
const PEOPLE: Record<string, { email: string; name: string }> = {
  UDEV: { email: 'dev@demo.sprintagent.dev', name: 'Arjun Nair' },
  UVIEW: { email: 'viewer@demo.sprintagent.dev', name: 'Vee Viewer' },
}
let ws = ''
const taskId = randomUUID()
let calls: Array<{ method: string; args: Record<string, string> }> = []
let replies: Array<Record<string, unknown>> = []

const send = (payload: unknown) => {
  const raw = new URLSearchParams({ payload: JSON.stringify(payload) }).toString()
  const ts = String(Math.floor(Date.now() / 1000))
  return POST(new Request('http://localhost/api/slack/interactions', { method: 'POST', body: raw, headers: { 'x-slack-request-timestamp': ts, 'x-slack-signature': `v0=${createHmac('sha256', SECRET).update(`v0:${ts}:${raw}`).digest('hex')}` } }))
}
const clickAnswer = (user: string) => send({ type: 'block_actions', team: { id: TEAM }, user: { id: user }, trigger_id: 'trig-1', response_url: 'https://hooks.slack.com/actions/T/1/x', actions: [{ action_id: 'ask_answer', value: taskId }] })
const submit = (user: string, value: string) => send({ type: 'view_submission', team: { id: TEAM }, user: { id: user }, view: { callback_id: 'ask_answer', private_metadata: taskId, state: { values: { answer: { text: { value } } } } } })

beforeAll(async () => {
  Object.assign(process.env, { SLACK_CLIENT_ID: 'c', SLACK_CLIENT_SECRET: 's', SLACK_SIGNING_SECRET: SECRET, TOKEN_ENCRYPTION_KEY: randomBytes(32).toString('base64') })
  const realFetch = globalThis.fetch
  vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
    const u = String(url)
    if (u.startsWith('https://slack.com/api/')) {
      const method = u.split('/').pop()!
      const args = Object.fromEntries(init.body as URLSearchParams)
      if (method === 'users.info') { const p = PEOPLE[args.user]; return Response.json({ ok: true, user: { profile: { email: p?.email, real_name: p?.name } } }) }
      calls.push({ method, args })
      return Response.json({ ok: true })
    }
    if (u.startsWith('https://hooks.slack.com/')) { replies.push(JSON.parse(init.body as string)); return new Response('ok') }
    return realFetch(url, init)
  })
  ws = (await db.from('workspaces').select('id').eq('slug', 'acme-demo').single()).data!.id
  const admin = (await db.from('workspace_members').select('user_id').eq('workspace_id', ws).eq('role', 'admin').limit(1).single()).data!.user_id
  await saveInstall(db, ws, admin, { ok: true, access_token: 'xoxb-t', bot_user_id: 'UBOT', team: { id: TEAM, name: 'Acme' } })
  await db.from('tasks').insert({ id: taskId, workspace_id: ws, title: 'Make the settings page nicer', description: 'make the settings page feel nicer', type: 'feature', status: 'backlog', urgency: 'medium', impact: 3, effort: 2, risk: 2, clarity: 2, decision: 'ASK', source: 'Slack' })
})
afterAll(async () => {
  vi.unstubAllGlobals()
  await db.from('tasks').delete().eq('id', taskId)
  await forget(db, ws)
})
beforeEach(() => { calls = []; replies = [] })

describe('answering an ASK from Slack (database, Slack faked)', () => {
  it('Answer opens the box with the agent’s question', async () => {
    await clickAnswer('UDEV')
    const open = calls.find((c) => c.method === 'views.open')!
    expect(open.args.trigger_id).toBe('trig-1')
    const view = JSON.parse(open.args.view)
    expect(view).toMatchObject({ callback_id: 'ask_answer', private_metadata: taskId })
    expect(JSON.stringify(view.blocks[0])).toContain('what would “better” look like')
  })

  it('viewers and empty answers are refused inside the box; nothing is saved', async () => {
    expect(await (await submit('UVIEW', 'Done when it matches the mockup')).json()).toMatchObject({ response_action: 'errors', errors: { answer: expect.stringMatching(/Viewer/) } })
    expect(await (await submit('UDEV', ' ')).json()).toMatchObject({ response_action: 'errors' })
    const { count } = await db.from('task_comments').select('id', { count: 'exact', head: true }).eq('task_id', taskId)
    expect(count).toBe(0)
  })

  it('a concrete answer: comment, re-triage, receipt, and a DM saying what changed', async () => {
    const res = await submit('UDEV', 'Done when the toggles align on a 12px grid at 1280px, as in the screenshot on #41.')
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('') // empty body closes the modal
    const { data: task } = await db.from('tasks').select('decision, clarity').eq('id', taskId).single()
    expect(task!.decision).not.toBe('ASK')
    const { data: c } = await db.from('task_comments').select('author_name, author_id').eq('task_id', taskId).single()
    expect(c!.author_name).toBe('Arjun Nair (Slack)')
    expect(c!.author_id).not.toBeNull()
    const { data: log } = await db.from('decisions').select('actor_id, payload').eq('task_id', taskId).single()
    expect(log!.actor_id).toBe(c!.author_id)
    expect(log!.payload).toMatchObject({ trigger: 'slack-answer', from: 'ASK' })
    const dm = calls.find((x) => x.method === 'chat.postMessage')!
    expect(dm.args.channel).toBe('UDEV')
    expect(dm.args.text).toMatch(/^Thanks\. “Make the settings page nicer”/)
  })

  it('once answered, the button and the box both say so', async () => {
    await clickAnswer('UDEV')
    expect(calls.some((c) => c.method === 'views.open')).toBe(false)
    expect(replies[0]).toMatchObject({ response_type: 'ephemeral', text: expect.stringMatching(/already been answered/) })
    expect(await (await submit('UDEV', 'one more thing')).json()).toMatchObject({ response_action: 'errors', errors: { answer: expect.stringMatching(/already been answered/) } })
  })
})
