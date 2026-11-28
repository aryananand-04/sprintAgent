// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
// Runs against the local Supabase (npm run test:db).
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/db/database.types'
import { postStandup } from './runTick'
import { makeMember, makeSprint } from '@/test/factories'

const db = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } })
let ws = ''
const snap = { tasks: [], team: [makeMember()], sprint: makeSprint(), escalations: [] }
// 17:30 UTC = 09:30 in Los Angeles, 2 Dec 2026 (a day no other test claims)
const now = new Date('2026-12-02T17:30:00Z')

beforeAll(async () => {
  ws = (await db.from('workspaces').select('id').eq('slug', 'acme-demo').single()).data!.id
  await db.from('workspaces').update({ timezone: 'America/Los_Angeles' }).eq('id', ws)
  await db.from('integrations').delete().eq('workspace_id', ws)
  await db.from('integrations').insert({ workspace_id: ws, kind: 'slack_webhook', url: 'https://hooks.slack.com/services/T/B/standup-test' })
})
afterAll(async () => {
  await db.from('workspaces').update({ timezone: 'UTC' }).eq('id', ws)
  await db.from('integrations').delete().eq('workspace_id', ws)
  await db.from('outbox').delete().eq('workspace_id', ws).eq('event', 'standup')
  await db.from('agent_cooldowns').delete().eq('workspace_id', ws).like('key', 'standup-%')
})

describe('server standup (database)', () => {
  it('waits for 9am in the workspace zone', async () => {
    expect(await postStandup(db, ws, snap, new Date('2026-12-02T16:00:00Z'))).toBe('not-due') // 08:00 LA
  })
  it('two runners at once: one standup', async () => {
    const results = await Promise.all([postStandup(db, ws, snap, now), postStandup(db, ws, snap, now)])
    expect(results.sort()).toEqual(['already', 'posted'])
    const { data } = await db.from('outbox').select('payload').eq('workspace_id', ws).eq('event', 'standup')
    expect(data).toHaveLength(1)
    expect(JSON.stringify(data![0].payload)).toContain('Wednesday, Dec 2')
  })
})
