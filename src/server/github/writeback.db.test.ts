// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
// Runs against the local Supabase (npm run test:db). GitHub's API is faked; nothing leaves the machine.
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { generateKeyPairSync, randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/db/database.types'
import { relayAnswer, writeBack } from './writeback'

const db = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } })
const REF = 'https://github.com/wbtest/repo/issues/77'
const INSTALL = 990_001
let ws = ''
let taskId = ''
let calls: Array<{ method: string; path: string; body?: string }> = []

beforeAll(async () => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  Object.assign(process.env, {
    GITHUB_APP_ID: '1', GITHUB_APP_SLUG: 'test-app', GITHUB_APP_WEBHOOK_SECRET: 'x'.repeat(32),
    GITHUB_APP_PRIVATE_KEY_BASE64: Buffer.from(privateKey.export({ type: 'pkcs1', format: 'pem' })).toString('base64'),
  })
  const realFetch = globalThis.fetch
  vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
    if (!String(url).startsWith('https://api.github.com')) return realFetch(url, init)
    const path = new URL(url).pathname
    const method = init.method ?? 'GET'
    calls.push({ method, path, body: init.body as string | undefined })
    if (path.endsWith('/access_tokens')) return Response.json({ token: 't', expires_at: new Date(Date.now() + 3_600_000).toISOString() })
    if (method === 'POST' && path.endsWith('/repos/wbtest/repo/labels')) return new Response('{}', { status: 422 })
    if (method === 'DELETE') return new Response('{}', { status: 404 })
    return Response.json({}, { status: 201 })
  })
  ws = (await db.from('workspaces').select('id').eq('slug', 'acme-demo').single()).data!.id
  taskId = randomUUID()
  await db.from('tasks').insert({ id: taskId, workspace_id: ws, title: '#77: Make it nicer', description: 'make the dashboard feel premium', type: 'feature', status: 'backlog', urgency: 'medium', impact: 3, effort: 2, risk: 2, clarity: 2, decision: 'ASK', external_ref: REF, source: 'GitHub / wbtest/repo' })
  await db.from('github_installations').insert({ workspace_id: ws, installation_id: INSTALL, account_login: 'wbtest', write_back: true })
})
afterAll(async () => {
  vi.unstubAllGlobals()
  await db.from('tasks').delete().eq('id', taskId)
  await db.from('github_installations').delete().eq('installation_id', INSTALL)
  await db.from('agent_cooldowns').delete().eq('key', `gh-ask-${taskId}`)
})
beforeEach(() => { calls = [] })

describe('GitHub write-back (database, GitHub faked)', () => {
  it('labels the issue and asks the question once', async () => {
    expect(await writeBack(db, ws, taskId)).toBe('labelled+asked')
    const added = calls.find((c) => c.method === 'POST' && c.path.endsWith('/issues/77/labels'))
    expect(JSON.parse(added!.body!)).toEqual({ labels: ['sprint-agent: ASK'] })
    expect(calls.filter((c) => c.method === 'DELETE').map((c) => decodeURIComponent(c.path.split('/').pop()!))).toEqual(['sprint-agent: ACT', 'sprint-agent: ESCALATE'])
    const comment = calls.find((c) => c.path.endsWith('/issues/77/comments'))
    expect(JSON.parse(comment!.body!).body).toMatch(/what would “better” look like/)

    calls = []
    expect(await writeBack(db, ws, taskId)).toBe('labelled')
    expect(calls.some((c) => c.path.endsWith('/comments'))).toBe(false)
  })

  it('relays a Slack answer onto the issue, mentions defused', async () => {
    expect(await relayAnswer(db, ws, taskId, 'Mei', 'Done when @octocat signs off')).toBe('posted')
    const c = calls.find((x) => x.path.endsWith('/issues/77/comments'))!
    expect(JSON.parse(c.body!).body).toMatch(/^\*\*Mei\*\* answered in Slack:\n\n> Done when @\u200boctocat signs off/)
  })

  it('does nothing while write-back is off', async () => {
    await db.from('github_installations').update({ write_back: false }).eq('installation_id', INSTALL)
    expect(await writeBack(db, ws, taskId)).toBe('off')
    expect(await relayAnswer(db, ws, taskId, 'Mei', 'x')).toBe('off')
    expect(calls).toEqual([])
  })
})
