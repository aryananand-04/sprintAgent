// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
// Runs against the local Supabase (npm run test:db).
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/db/database.types'
import { forget, linkForTeam, linkForWorkspace, saveInstall } from './install'
import type { SlackInstall } from './api'
import { enqueue } from '@/server/outbox'

const db = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } })
let ws = ''
let other = ''
let admin = ''
const install = (team = 'TINSTALL1'): SlackInstall => ({
  ok: true, access_token: 'xoxb-test-token', bot_user_id: 'UBOT', team: { id: team, name: 'Acme' },
  incoming_webhook: { url: 'https://hooks.slack.com/services/T/B/install-test', channel: '#eng-escalations', channel_id: 'C1' },
})

beforeAll(async () => {
  process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString('base64')
  ws = (await db.from('workspaces').select('id').eq('slug', 'acme-demo').single()).data!.id
  admin = (await db.from('workspace_members').select('user_id').eq('workspace_id', ws).eq('role', 'admin').limit(1).single()).data!.user_id
  other = (await db.from('workspaces').insert({ name: 'Other', slug: `slack-other-${Date.now()}` }).select('id').single()).data!.id
})
afterAll(async () => {
  await forget(db, ws)
  await db.from('workspaces').delete().eq('id', other)
})

describe('Slack install (database)', () => {
  it('stores the token sealed, links both ways, and takes over the Slack channel', async () => {
    expect(await saveInstall(db, ws, admin, install())).toBe('connected')
    const { data: row } = await db.from('slack_installations').select('bot_token_sealed, channel_name').eq('workspace_id', ws).single()
    expect(row!.bot_token_sealed).not.toContain('xoxb')
    expect(row!.channel_name).toBe('#eng-escalations')
    expect((await linkForWorkspace(db, ws))?.token).toBe('xoxb-test-token')
    expect((await linkForTeam(db, 'TINSTALL1'))?.workspaceId).toBe(ws)
    const { data: hook } = await db.from('integrations').select('url').eq('workspace_id', ws).eq('kind', 'slack_webhook').single()
    expect(hook!.url).toBe('https://hooks.slack.com/services/T/B/install-test')
  })

  it('reinstalling updates in place; another workspace cannot claim the same Slack team', async () => {
    expect(await saveInstall(db, ws, admin, install())).toBe('connected')
    expect(await saveInstall(db, other, admin, install())).toBe('taken')
    expect(await linkForWorkspace(db, other)).toBeNull()
  })

  it('escalations queued while installed carry the Resolve button', async () => {
    const escalationId = '00000000-0000-4000-8000-0000000000e5'
    expect(await enqueue(db, ws, { type: 'escalation', taskTitle: 'T', reason: 'r', recommendation: '', urgency: 'high', escalationId })).toBeGreaterThan(0)
    const { data } = await db.from('outbox').select('payload').eq('workspace_id', ws).eq('event', 'escalation').order('created_at', { ascending: false }).limit(1).single()
    expect(JSON.stringify(data!.payload)).toContain(`"value":"${escalationId}"`)
    await db.from('outbox').delete().eq('workspace_id', ws).eq('event', 'escalation')
  })

  it('maps a Slack email to a member, case-insensitively', async () => {
    const { data } = await db.rpc('member_by_email', { ws, member_email: 'PM@demo.sprintagent.dev' })
    expect(data?.[0]?.role).toBe('pm')
    const { data: none } = await db.rpc('member_by_email', { ws, member_email: 'stranger@example.com' })
    expect(none).toEqual([])
  })

  it('forgetting removes the install and its webhook', async () => {
    await forget(db, ws)
    expect(await linkForWorkspace(db, ws)).toBeNull()
    const { count } = await db.from('integrations').select('id', { count: 'exact', head: true }).eq('workspace_id', ws).eq('kind', 'slack_webhook')
    expect(count).toBe(0)
  })
})
