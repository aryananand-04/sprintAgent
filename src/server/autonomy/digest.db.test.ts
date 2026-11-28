// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
// Runs against the local Supabase (npm run test:db).
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/db/database.types'
import { sendWeeklyDigest } from './digest'

const db = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } })
let ws = ''
// A Monday, 10:00 UTC (the demo workspace is UTC). Predictions are dated relative to it.
const monday = new Date('2026-12-07T10:00:00Z')

beforeAll(async () => {
  ws = (await db.from('workspaces').select('id').eq('slug', 'acme-demo').single()).data!.id
  const task = (await db.from('tasks').select('id').eq('workspace_id', ws).limit(1).single()).data!.id
  const [a, b] = (await db.from('team_members').select('id').eq('workspace_id', ws).limit(2)).data!.map((m) => m.id)
  const at = new Date(monday.getTime() - 2 * 86_400_000).toISOString()
  await db.from('predictions').insert([
    { workspace_id: ws, task_id: task, task_type: 'feature', action: 'assign', mode: 'shadow', predicted_member_id: a, actual_member_id: a, rationale: 'digest test', outcome: 'agree', resolved_at: at },
    { workspace_id: ws, task_id: task, task_type: 'feature', action: 'assign', mode: 'shadow', predicted_member_id: a, actual_member_id: b, rationale: 'digest test', outcome: 'disagree', resolved_at: at },
  ])
  await db.from('integrations').delete().eq('workspace_id', ws)
  await db.from('integrations').insert({ workspace_id: ws, kind: 'slack_webhook', url: 'https://hooks.slack.com/services/T/B/digest-test' })
})
afterAll(async () => {
  await db.from('predictions').delete().eq('workspace_id', ws).eq('rationale', 'digest test')
  await db.from('integrations').delete().eq('workspace_id', ws)
  await db.from('agent_cooldowns').delete().eq('workspace_id', ws).like('key', 'digest-%')
})

describe('weekly digest (database)', () => {
  it('only on Monday morning', async () => {
    expect(await sendWeeklyDigest(db, ws, new Date('2026-12-08T10:00:00Z'))).toBe('not-due')
  })
  it('sends once per week, with the week’s agreement and where we differed', async () => {
    expect(await sendWeeklyDigest(db, ws, monday)).toBe('sent')
    expect(await sendWeeklyDigest(db, ws, new Date(monday.getTime() + 3_600_000))).toBe('already')
    const { data } = await db.from('outbox').select('payload').eq('workspace_id', ws).eq('event', 'digest').single()
    const text = (data!.payload as { text: string }).text
    expect(text).toMatch(/Agreed with you \d+ of \d+ times/)
    expect(text).toContain('*Where we differed*')
    await db.from('outbox').delete().eq('workspace_id', ws).eq('event', 'digest')
  })
})
