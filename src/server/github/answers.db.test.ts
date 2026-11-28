// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
// Runs against the local Supabase (npm run test:db).
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/db/database.types'
import type { GhComment } from '@/logic/github'
import { handleIssueComment } from './answers'

const db = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } })
const REF = 'https://github.com/anstest/repo/issues/12'
let ws = ''
let taskId = ''
const ids = [9_100_001, 9_100_002, 9_100_003]
const comment = (id: number, body: string, over: Partial<GhComment> = {}): GhComment => ({ id, body, user: { login: 'mei', type: 'User' }, ...over })

beforeAll(async () => {
  ws = (await db.from('workspaces').select('id').eq('slug', 'acme-demo').single()).data!.id
  taskId = randomUUID()
  await db.from('tasks').insert({ id: taskId, workspace_id: ws, title: '#12: Make it nicer', description: 'the settings page feels off', type: 'feature', status: 'backlog', urgency: 'medium', impact: 3, effort: 2, risk: 2, clarity: 2, decision: 'ASK', external_ref: REF, source: 'GitHub / anstest/repo' })
})
afterAll(async () => {
  await db.from('tasks').delete().eq('id', taskId)
  await db.from('agent_cooldowns').delete().in('key', ids.map((i) => `gh-comment-${i}`))
})

describe('GitHub answers (database)', () => {
  it('ignores bots without touching the task', async () => {
    expect(await handleIssueComment(db, ws, REF, comment(ids[0], 'Done when x', { user: { login: 'ci[bot]', type: 'Bot' } }))).toEqual({ result: 'ignored' })
  })

  it('records an unhelpful reply but keeps the ASK', async () => {
    expect(await handleIssueComment(db, ws, REF, comment(ids[1], 'idk, it just feels off'))).toEqual({ result: 'recorded' })
    const { data } = await db.from('tasks').select('decision, clarity').eq('id', taskId).single()
    expect(data).toEqual({ decision: 'ASK', clarity: 2 })
  })

  it('a concrete answer re-triages once, with a receipt', async () => {
    const answer = comment(ids[2], 'Done when the toggles align on a 12px grid at 1280px. See screenshot in #41.')
    expect(await handleIssueComment(db, ws, REF, answer)).toEqual({ result: 'retriaged', taskId })
    expect(await handleIssueComment(db, ws, REF, answer)).toEqual({ result: 'ignored' }) // no longer ASK

    const { data: task } = await db.from('tasks').select('decision, clarity').eq('id', taskId).single()
    expect(task!.decision).not.toBe('ASK')
    expect(task!.clarity).toBe(4)
    const { data: comments } = await db.from('task_comments').select('author_name, body').eq('task_id', taskId).order('created_at')
    expect(comments!.map((c) => c.author_name)).toEqual(['@mei on GitHub', '@mei on GitHub'])
    const { data: audit } = await db.from('decisions').select('kind, source, payload').eq('task_id', taskId)
    expect(audit).toEqual([{ kind: 'triage', source: 'rules', payload: expect.objectContaining({ trigger: 'github-answer', from: 'ASK' }) }])
    const { count } = await db.from('feed_events').select('id', { count: 'exact', head: true }).eq('task_id', taskId)
    expect(count).toBe(1)
  })

  it('a redelivered comment counts once', async () => {
    await db.from('tasks').update({ decision: 'ASK', clarity: 2 }).eq('id', taskId)
    expect(await handleIssueComment(db, ws, REF, comment(ids[2], 'Done when the toggles align. See #41.'))).toEqual({ result: 'duplicate' })
  })
})
