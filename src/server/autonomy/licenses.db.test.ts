// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
// Runs against the local Supabase (npm run test:db).
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/db/database.types'
import { loadLicenses, recomputeLicenses, recordPrediction } from './licenses'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const db = createClient<Database>(url, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } })
const pm = createClient<Database>(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } })
let ws = ''
let members: string[] = []
const taskIds: string[] = []
const started = new Date().toISOString()

async function newTask(): Promise<string> {
  const id = randomUUID()
  taskIds.push(id)
  await db.from('tasks').insert({ id, workspace_id: ws, title: `EA ${id.slice(0, 6)}`, type: 'spike', status: 'triaged', urgency: 'medium', impact: 3, effort: 2, risk: 2, clarity: 4 })
  return id
}

beforeAll(async () => {
  ws = (await db.from('workspaces').select('id').eq('slug', 'acme-demo').single()).data!.id
  members = (await db.from('team_members').select('id').eq('workspace_id', ws).limit(2)).data!.map((m) => m.id)
  const { error } = await pm.auth.signInWithPassword({ email: 'pm@demo.sprintagent.dev', password: 'password123' })
  if (error) throw error
})
afterAll(async () => {
  await db.from('tasks').delete().in('id', taskIds)
  await db.from('autonomy_licenses').delete().eq('workspace_id', ws).eq('task_type', 'spike') // only what this test created
})

describe('earning a licence (database, real people via RLS)', () => {
  it('a person assigning the suggested member counts as agreement; someone else as disagreement', async () => {
    const a = await newTask(), b = await newTask()
    for (const id of [a, b]) await recordPrediction(db, ws, { taskId: id, taskType: 'spike', action: 'assign', level: 1, predictedMemberId: members[0], rationale: 'skills' })
    await pm.from('tasks').update({ assignee_id: members[0] }).eq('id', a)
    await pm.from('tasks').update({ assignee_id: members[1] }).eq('id', b)
    const { data } = await db.from('predictions').select('task_id, outcome').in('task_id', [a, b])
    expect(Object.fromEntries(data!.map((p) => [p.task_id, p.outcome]))).toEqual({ [a]: 'agree', [b]: 'disagree' })
  })

  it('enough agreement earns "Act with undo", logged with the numbers', async () => {
    for (let i = 0; i < 24; i++) {
      const id = await newTask()
      await recordPrediction(db, ws, { taskId: id, taskType: 'spike', action: 'assign', level: 1, predictedMemberId: members[0], rationale: 'skills' })
      await pm.from('tasks').update({ assignee_id: members[0] }).eq('id', id)
    }
    const changes = await recomputeLicenses(db, ws)
    expect(changes).toEqual([expect.objectContaining({ taskType: 'spike', action: 'assign', from: 1, to: 2 })])
    expect((await loadLicenses(db, ws)).find((l) => l.taskType === 'spike' && l.action === 'assign')).toMatchObject({ earned: 2, effective: 2 })
    const { data: log } = await db.from('decisions').select('rationale, hash').eq('workspace_id', ws).eq('kind', 'license').gte('created_at', started)
    expect(log![0].rationale).toMatch(/^Earned “Act with undo” for spike assign work\. Agreed with people 25\/26 times/)
    expect(log![0].hash).toMatch(/^[0-9a-f]{64}$/)
    expect(await recomputeLicenses(db, ws)).toEqual([]) // no new evidence, no change
  })

  it('an admin cap applies at once; the earned level stays on record', async () => {
    await db.from('autonomy_licenses').update({ cap: 1 }).eq('workspace_id', ws).eq('task_type', 'spike').eq('action', 'assign')
    expect((await loadLicenses(db, ws)).find((l) => l.taskType === 'spike')).toMatchObject({ earned: 2, cap: 1, effective: 1 })
  })
})
