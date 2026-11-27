// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
// Runs against the local Supabase (npm run test:db).
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/db/database.types'
import type { GhIssue } from '@/logic/github'
import { syncIssue } from './sync'

const db = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } })
const URL_ = 'https://github.com/test/repo/issues/9001'
let ws = ''
const issue = (over: Partial<GhIssue> = {}): GhIssue => ({
  number: 9001, title: 'Checkout crashes on submit', body: 'Steps to reproduce: add item, pay. Expected: receipt. Actual: 500.',
  html_url: URL_, state: 'open', labels: [{ name: 'bug' }], created_at: new Date().toISOString(), ...over,
})

beforeAll(async () => { ws = (await db.from('workspaces').select('id').eq('slug', 'acme-demo').single()).data!.id })
afterAll(async () => { await db.from('tasks').delete().eq('external_ref', URL_) })

describe('GitHub issue sync (database)', () => {
  it('creates a triaged task once, then updates it in place', async () => {
    expect(await syncIssue(db, ws, 'test/repo', issue())).toBe('created')
    expect(await syncIssue(db, ws, 'test/repo', issue({ title: 'Checkout crashes on submit (Safari)' }))).toBe('updated')
    const { data } = await db.from('tasks').select('title, type, decision, source, status').eq('external_ref', URL_)
    expect(data).toHaveLength(1)
    expect(data![0]).toMatchObject({ title: '#9001: Checkout crashes on submit (Safari)', type: 'bug', source: 'GitHub / test/repo', status: 'backlog' })
    expect(data![0].decision).not.toBeNull()
  })
  it('closing the issue marks the task done; pull requests are ignored', async () => {
    await syncIssue(db, ws, 'test/repo', issue({ state: 'closed' }))
    expect((await db.from('tasks').select('status').eq('external_ref', URL_).single()).data!.status).toBe('done')
    expect(await syncIssue(db, ws, 'test/repo', issue({ number: 9002, html_url: URL_ + '0', pull_request: {} }))).toBe('skipped')
  })
})
