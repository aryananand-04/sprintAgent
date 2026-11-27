// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
// Runs against the local Supabase (npm run test:db).
import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/db/database.types'
import { runAgentTick } from './runTick'

const db = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } })
let ws = ''
const created: string[] = []
const createdTasks: string[] = []

beforeAll(async () => {
  ws = (await db.from('workspaces').select('id').eq('slug', 'acme-demo').single()).data!.id
})
afterEach(async () => {
  await db.from('agent_cooldowns').delete().eq('workspace_id', ws)
  if (created.length) await db.from('escalations').delete().in('id', created.splice(0))
  if (createdTasks.length) await db.from('tasks').delete().in('id', createdTasks.splice(0))
})

describe('server agent tick (database)', () => {
  it('two runners at once: each check fires exactly once', async () => {
    const task = { id: randomUUID(), title: `Tick test ${Date.now()}` }
    await db.from('tasks').insert({ id: task.id, workspace_id: ws, title: task.title, description: '', type: 'chore', status: 'done', urgency: 'low', impact: 1, effort: 1, risk: 1, clarity: 5 })
    createdTasks.push(task.id)
    const { data: esc } = await db.from('escalations').insert({
      workspace_id: ws, task_id: task.id, task_title: task.title, reason: 'stale test', recommendation: 'r', urgency: 'high', category: 'blocker',
      created_at: new Date(Date.now() - 30 * 3_600_000).toISOString(),
    }).select('id').single()
    created.push(esc!.id)

    const started = new Date().toISOString()
    const [a, b] = await Promise.all([runAgentTick(db, ws), runAgentTick(db, ws)])
    expect(a.planned).toBe(b.planned)
    expect(a.applied + b.applied).toBe(a.planned)

    const { count } = await db.from('feed_events').select('id', { count: 'exact', head: true })
      .eq('workspace_id', ws).gte('created_at', started).ilike('message', `%${task.title}%without a decision%`)
    expect(count).toBe(1)
  })

  it('respects the cooldown on the next run', async () => {
    await runAgentTick(db, ws)
    expect((await runAgentTick(db, ws)).applied).toBe(0)
  })
})
