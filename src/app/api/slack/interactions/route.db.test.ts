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
const TEAM = 'TINTERACT'
const EMAILS: Record<string, string> = { UPM: 'pm@demo.sprintagent.dev', UDEV: 'dev@demo.sprintagent.dev', USTRANGER: 'nobody@example.com' }
let ws = ''
let escId = ''
let replies: Array<Record<string, unknown>> = []

const click = (user: string, value = escId) => {
  const payload = JSON.stringify({ type: 'block_actions', team: { id: TEAM }, user: { id: user }, response_url: 'https://hooks.slack.com/actions/T/1/x', actions: [{ action_id: 'esc_resolve', value }] })
  const raw = new URLSearchParams({ payload }).toString()
  const ts = String(Math.floor(Date.now() / 1000))
  const sig = `v0=${createHmac('sha256', SECRET).update(`v0:${ts}:${raw}`).digest('hex')}`
  return POST(new Request('http://localhost/api/slack/interactions', { method: 'POST', body: raw, headers: { 'x-slack-request-timestamp': ts, 'x-slack-signature': sig } }))
}

beforeAll(async () => {
  Object.assign(process.env, { SLACK_CLIENT_ID: 'c', SLACK_CLIENT_SECRET: 's', SLACK_SIGNING_SECRET: SECRET, TOKEN_ENCRYPTION_KEY: randomBytes(32).toString('base64') })
  const realFetch = globalThis.fetch
  vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
    const u = String(url)
    if (u === 'https://slack.com/api/users.info') {
      const user = (init.body as URLSearchParams).get('user')!
      return Response.json({ ok: true, user: { profile: { email: EMAILS[user] } } })
    }
    if (u.startsWith('https://hooks.slack.com/')) { replies.push(JSON.parse(init.body as string)); return new Response('ok') }
    return realFetch(url, init)
  })
  ws = (await db.from('workspaces').select('id').eq('slug', 'acme-demo').single()).data!.id
  const admin = (await db.from('workspace_members').select('user_id').eq('workspace_id', ws).eq('role', 'admin').limit(1).single()).data!.user_id
  await saveInstall(db, ws, admin, { ok: true, access_token: 'xoxb-t', bot_user_id: 'UBOT', team: { id: TEAM, name: 'Acme' } })
  const task = (await db.from('tasks').select('id, title').eq('workspace_id', ws).limit(1).single()).data!
  escId = (await db.from('escalations').insert({ workspace_id: ws, task_id: task.id, task_title: task.title, reason: 'r', recommendation: 'x', urgency: 'high', category: 'blocker' }).select('id').single()).data!.id
})
afterAll(async () => {
  vi.unstubAllGlobals()
  await db.from('escalations').delete().eq('id', escId)
  await forget(db, ws)
})
beforeEach(() => { replies = [] })

describe('Slack Resolve button (database, Slack faked)', () => {
  it('rejects unsigned requests', async () => {
    const res = await POST(new Request('http://localhost/x', { method: 'POST', body: 'payload={}' }))
    expect(res.status).toBe(401)
  })

  it('strangers and contributors are told why, and nothing changes', async () => {
    await click('USTRANGER')
    await click('UDEV')
    expect(replies.map((r) => r.response_type)).toEqual(['ephemeral', 'ephemeral'])
    expect(String(replies[1].text)).toMatch(/needs a PM or admin\. You’re a Contributor/)
    const { data } = await db.from('escalations').select('resolved_at').eq('id', escId).single()
    expect(data!.resolved_at).toBeNull()
  })

  it('a PM resolves it once, with a receipt; a second click is told it is done', async () => {
    expect((await click('UPM')).status).toBe(200)
    expect(replies[0]).toMatchObject({ replace_original: true })
    expect(String(replies[0].text)).toContain('Resolved by <@UPM>')
    const { data: esc } = await db.from('escalations').select('resolved_at, resolved_by, resolution').eq('id', escId).single()
    expect(esc!.resolved_at).not.toBeNull()
    expect(esc!.resolution).toBe('Resolved in Slack')
    const { data: log } = await db.from('decisions').select('kind, source, actor_id').eq('workspace_id', ws).contains('payload', { escalationId: escId })
    expect(log).toEqual([{ kind: 'override', source: 'human', actor_id: esc!.resolved_by }])

    replies = []
    await click('UPM')
    expect(replies[0]).toMatchObject({ response_type: 'ephemeral', text: 'Someone already resolved this one.' })
  })

  it('an unknown escalation id is not found', async () => {
    await click('UPM', randomUUID())
    expect(replies[0]).toMatchObject({ text: 'That escalation no longer exists.' })
  })
})
