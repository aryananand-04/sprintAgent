// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
// Runs against the local Supabase (npm run test:db). The model is faked; nothing leaves the machine.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/db/database.types'
import { loadWorkspace } from '@/lib/data/loadWorkspace'
import type { Completer } from '@/server/llm'
import { triageBacklog } from './triageBacklog'

const db = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } })
let ws = ''
const ids = { clear: randomUUID(), vague: randomUUID(), risky: randomUUID() }
const all: string[] = Object.values(ids)
// A model that always wants to act: the rules must still hold ASK and ESCALATE back.
const bold: Completer = async () => JSON.stringify({ decision: 'ACT', reason: 'Looks fine to me.' })

beforeAll(async () => {
  ws = (await db.from('workspaces').select('id').eq('slug', 'acme-demo').single()).data!.id
  const base = { workspace_id: ws, status: 'backlog' as const, urgency: 'medium' as const, source: 'PM', impact: 3 }
  await db.from('tasks').insert([
    { ...base, id: ids.clear, title: 'BT: Spike date picker off-by-one', description: 'Expected 30 Nov, shows 29 Nov', type: 'spike', effort: 2, risk: 2, clarity: 5 },
    { ...base, id: ids.vague, title: 'BT: Make onboarding nicer', description: 'feels off', type: 'feature', effort: 2, risk: 2, clarity: 2 },
    { ...base, id: ids.risky, title: 'BT: Swap payment provider', description: 'move billing', type: 'feature', effort: 5, risk: 5, clarity: 3 },
  ])
})
afterAll(async () => {
  await db.from('autonomy_licenses').delete().eq('workspace_id', ws).eq('task_type', 'spike') // only what this test created
  await db.from('escalations').delete().in('task_id', all)
  await db.from('tasks').delete().in('id', all)
  await db.from('agent_cooldowns').delete().in('key', all.map((id) => `triage-${id}`))
})

describe('server backlog triage (database, model faked)', () => {
  it('two runners at once: every ticket triaged exactly once, rules bound the model', async () => {
    const snap = (await loadWorkspace(ws, db))!
    const opts = { apiKey: 'test', complete: bold }
    const [a, b] = await Promise.all([triageBacklog(db, ws, snap, opts), triageBacklog(db, ws, snap, opts)])
    expect(a + b).toBe(3)

    const { data: tasks } = await db.from('tasks').select('id, decision, status, assignee_id, is_ai_triaged').in('id', all)
    const byId = Object.fromEntries(tasks!.map((t) => [t.id, t]))
    // No licence for spikes yet (Suggest): the agent predicts an owner but doesn't assign.
    expect(byId[ids.clear]).toMatchObject({ decision: 'ACT', status: 'triaged', assignee_id: null, is_ai_triaged: true })
    const { data: pred } = await db.from('predictions').select('mode, predicted_member_id, outcome').eq('task_id', ids.clear).single()
    expect(pred).toMatchObject({ mode: 'shadow', outcome: null })
    expect(pred!.predicted_member_id).toBeTruthy()
    expect(byId[ids.vague]).toMatchObject({ decision: 'ASK', status: 'triaged', assignee_id: null })
    expect(byId[ids.risky]).toMatchObject({ decision: 'ESCALATE', status: 'triaged' })

    const { data: triage } = await db.from('decisions').select('task_id, source, payload').eq('kind', 'triage').in('task_id', all)
    expect(triage).toHaveLength(3)
    const audit = (id: string) => (triage!.find((d) => d.task_id === id)!.payload as { audit?: { overruled: boolean } }).audit
    expect(audit(ids.vague)?.overruled).toBe(true)
    expect(audit(ids.clear)?.overruled).toBe(false)

    const { count } = await db.from('escalations').select('id', { count: 'exact', head: true }).eq('task_id', ids.risky)
    expect(count).toBe(1)
  })

  it('with an earned licence it acts, and leaves an undo window at "Act with undo"', async () => {
    const id = randomUUID()
    all.push(id)
    await db.from('tasks').insert({ id, workspace_id: ws, title: 'BT: Spike tooltip clipping', description: 'Expected tooltip fully visible at 1280px; actual clipped by 8px', type: 'spike', status: 'backlog', urgency: 'medium', source: 'PM', impact: 3, effort: 2, risk: 2, clarity: 5 })
    await db.from('autonomy_licenses').upsert({ workspace_id: ws, task_type: 'spike', action: 'assign', earned_level: 2 })
    const snap = (await loadWorkspace(ws, db))!
    expect(await triageBacklog(db, ws, snap, { apiKey: undefined, only: [id] })).toBe(1)
    const { data: t } = await db.from('tasks').select('status, assignee_id').eq('id', id).single()
    expect(t!.status).toBe('assigned')
    const { data: pred } = await db.from('predictions').select('mode, undo_until, predicted_member_id').eq('task_id', id).single()
    expect(pred).toMatchObject({ mode: 'acted', predicted_member_id: t!.assignee_id })
    expect(new Date(pred!.undo_until!).getTime()).toBeGreaterThan(Date.now())
  })

  it('leaves triaged tickets alone on the next run', async () => {
    const snap = (await loadWorkspace(ws, db))!
    expect(await triageBacklog(db, ws, snap, { apiKey: undefined })).toBe(0)
  })
})
