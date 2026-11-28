// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
// Runs against the local Supabase (npm run test:db). Slack is faked; nothing leaves the machine.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/db/database.types'
import { loadWorkspace } from '@/lib/data/loadWorkspace'
import { forget, saveInstall } from './install'
import { sendDmBriefings } from './briefings'

const db = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } })
let ws = ''
let pmUser = ''
let meera = ''
let dms: Array<{ channel: string; text: string }> = []
const at10 = new Date('2026-12-03T10:00:00Z') // a day no other test claims; workspace is UTC

beforeAll(async () => {
  process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString('base64')
  const realFetch = globalThis.fetch
  vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
    const u = String(url)
    const args = init.body instanceof URLSearchParams ? init.body : null
    if (u.endsWith('/users.lookupByEmail')) return Response.json({ ok: true, user: { id: `U-${args!.get('email')}` } })
    if (u.endsWith('/chat.postMessage')) { dms.push({ channel: args!.get('channel')!, text: args!.get('text')! }); return Response.json({ ok: true }) }
    return realFetch(url, init)
  })
  ws = (await db.from('workspaces').select('id').eq('slug', 'acme-demo').single()).data!.id
  const admin = (await db.from('workspace_members').select('user_id').eq('workspace_id', ws).eq('role', 'admin').limit(1).single()).data!.user_id
  pmUser = (await db.from('workspace_members').select('user_id').eq('workspace_id', ws).eq('role', 'pm').limit(1).single()).data!.user_id
  meera = (await db.from('team_members').select('id').eq('workspace_id', ws).eq('name', 'Meera Patel').single()).data!.id
  await db.from('team_members').update({ user_id: pmUser }).eq('id', meera) // a PM who also has work
  await saveInstall(db, ws, admin, { ok: true, access_token: 'xoxb-t', bot_user_id: 'UBOT', team: { id: 'TDM', name: 'Acme' } })
})
afterAll(async () => {
  vi.unstubAllGlobals()
  await db.from('team_members').update({ user_id: null }).eq('id', meera)
  await db.from('agent_cooldowns').delete().eq('workspace_id', ws).like('key', 'dm-briefings-%')
  await forget(db, ws)
})

describe('Slack morning DMs (database, Slack faked)', () => {
  it('off until an admin turns them on', async () => {
    expect(await sendDmBriefings(db, ws, (await loadWorkspace(ws, db))!, at10)).toEqual({ result: 'off' })
  })

  it('9am local, once a day, only to linked people with something to say', async () => {
    await db.from('slack_installations').update({ dm_briefings: true }).eq('workspace_id', ws)
    const snap = (await loadWorkspace(ws, db))!
    expect(await sendDmBriefings(db, ws, snap, new Date('2026-12-03T08:59:00Z'))).toEqual({ result: 'not-due' })

    const r = await sendDmBriefings(db, ws, snap, at10)
    expect(r).toMatchObject({ result: 'sent', sent: 2 })
    const dev = dms.find((d) => d.channel === 'U-dev@demo.sprintagent.dev')!
    const pm = dms.find((d) => d.channel === 'U-pm@demo.sprintagent.dev')!
    expect(dev.text).toMatch(/^Morning, Arjun\./)
    expect(dev.text).not.toMatch(/escalation/) // contributors aren't asked to decide
    expect(pm.text).toMatch(/^Morning, Meera\./)
    expect(pm.text).toMatch(/escalations? needs? a decision/)

    dms = []
    expect(await sendDmBriefings(db, ws, snap, new Date('2026-12-03T15:00:00Z'))).toEqual({ result: 'already' })
    expect(dms).toEqual([])
  })
})
