// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
// Runs against the local Supabase (npm run test:db). Slack is faked; nothing leaves the machine.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { createHmac, randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/db/database.types'
import { forget, saveInstall } from '@/server/slack/install'
import { POST as command } from './route'
import { POST as event } from '../events/route'

const db = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } })
const SECRET = 'test-signing-secret'
const TEAM = 'TINTAKE'
const EMAILS: Record<string, string> = { UDEV: 'dev@demo.sprintagent.dev', UVIEW: 'viewer@demo.sprintagent.dev' }
let ws = ''
let posted: Array<{ method: string; body: Record<string, unknown> }> = []
const started = new Date().toISOString()

const signed = (raw: string, type = 'application/x-www-form-urlencoded') => {
  const ts = String(Math.floor(Date.now() / 1000))
  return { method: 'POST', body: raw, headers: { 'content-type': type, 'x-slack-request-timestamp': ts, 'x-slack-signature': `v0=${createHmac('sha256', SECRET).update(`v0:${ts}:${raw}`).digest('hex')}` } }
}
const slash = async (user: string, text: string) =>
  (await (await command(new Request('http://localhost/api/slack/commands', signed(new URLSearchParams({ team_id: TEAM, user_id: user, text, command: '/sprint' }).toString())))).json()) as { text: string; response_type: string }
const mention = (user: string, text: string, eventId: string) =>
  event(new Request('http://localhost/api/slack/events', signed(JSON.stringify({ type: 'event_callback', team_id: TEAM, event_id: eventId, event: { type: 'app_mention', user, text, channel: 'C1', ts: '1.1' } }), 'application/json')))

beforeAll(async () => {
  Object.assign(process.env, { SLACK_CLIENT_ID: 'c', SLACK_CLIENT_SECRET: 's', SLACK_SIGNING_SECRET: SECRET, TOKEN_ENCRYPTION_KEY: randomBytes(32).toString('base64') })
  const realFetch = globalThis.fetch
  vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
    const u = String(url)
    if (u.startsWith('https://slack.com/api/')) {
      const method = u.split('/').pop()!
      const body = Object.fromEntries(init.body as URLSearchParams)
      if (method === 'users.info') return Response.json({ ok: true, user: { profile: { email: EMAILS[body.user] } } })
      posted.push({ method, body })
      return Response.json({ ok: true })
    }
    return realFetch(url, init)
  })
  ws = (await db.from('workspaces').select('id').eq('slug', 'acme-demo').single()).data!.id
  const admin = (await db.from('workspace_members').select('user_id').eq('workspace_id', ws).eq('role', 'admin').limit(1).single()).data!.user_id
  await saveInstall(db, ws, admin, { ok: true, access_token: 'xoxb-t', bot_user_id: 'UBOT', team: { id: TEAM, name: 'Acme' } })
})
afterAll(async () => {
  vi.unstubAllGlobals()
  const { data } = await db.from('tasks').select('id').eq('workspace_id', ws).eq('source', 'Slack').gte('created_at', started)
  const ids = (data ?? []).map((t) => t.id)
  await db.from('escalations').delete().in('task_id', ids)
  await db.from('tasks').delete().in('id', ids)
  await db.from('agent_cooldowns').delete().eq('workspace_id', ws).like('key', 'slack-event-%')
  await forget(db, ws)
})

describe('Slack intake (database, Slack faked)', () => {
  it('/sprint files a clear request, triages it and says who has it', async () => {
    const r = await slash('UDEV', 'Checkout fails on Safari 17 after applying a promo code. Expected: total updates. Actual: spinner forever.')
    expect(r.response_type).toBe('ephemeral')
    expect(r.text).toMatch(/^Added “Checkout fails on Safari 17/)
    const { data: task } = await db.from('tasks').select('source, decision, created_by').eq('workspace_id', ws).ilike('title', 'Checkout fails on Safari 17%').single()
    expect(task!.source).toBe('Slack')
    expect(task!.decision).not.toBeNull()
    expect(task!.created_by).not.toBeNull()
  })

  it('a vague request gets its one question', async () => {
    expect((await slash('UDEV', 'make the settings page feel a bit nicer for people this sprint')).text).toMatch(/One question before anyone starts: /)
  })

  it('viewers cannot file work; empty commands get help', async () => {
    expect((await slash('UVIEW', 'Fix the export')).text).toMatch(/needs a PM or admin|You’re a Viewer/)
    expect((await slash('UDEV', '  ')).text).toMatch(/^Describe the work/)
  })

  it('@mention files and replies in thread; a retried event is handled once', async () => {
    posted = []
    expect((await mention('UDEV', '<@UBOT> Rename the "Billing" tab to "Plans" so it should match the pricing page', 'Ev1')).status).toBe(200)
    await mention('UDEV', '<@UBOT> Rename the "Billing" tab to "Plans" so it should match the pricing page', 'Ev1')
    expect(posted).toHaveLength(1)
    expect(posted[0]).toMatchObject({ method: 'chat.postMessage', body: { channel: 'C1', thread_ts: '1.1' } })
    const { count } = await db.from('tasks').select('id', { count: 'exact', head: true }).eq('workspace_id', ws).ilike('title', 'Rename the "Billing" tab%')
    expect(count).toBe(1)
  })

  it('answers Slack’s URL check and ignores unsigned events', async () => {
    const ok = await event(new Request('http://x', signed(JSON.stringify({ type: 'url_verification', challenge: 'abc' }), 'application/json')))
    expect(await ok.json()).toEqual({ challenge: 'abc' })
    expect((await event(new Request('http://x', { method: 'POST', body: '{}' }))).status).toBe(401)
  })
})
