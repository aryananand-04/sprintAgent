// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
// Runs against the local Supabase (npm run test:db). Linear is faked; nothing leaves the machine.
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { createHmac, randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/db/database.types'
import { connectionFor, forgetConnection, saveConnection } from '@/server/trackers/connections'
import { importLinear, linearWriteBack } from '@/server/linear/sync'
import { POST } from './route'

const db = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } })
const SECRET = 'lin-webhook-secret'
const ORG = 'org-webhook-test'
const REF = 'https://linear.app/acme/issue/LWT-1'
let ws = ''
let gqlCalls: Array<{ query: string; variables: Record<string, unknown> }> = []

const issue = (over: Record<string, unknown> = {}) => ({
  id: 'uuid-lwt-1', identifier: 'LWT-1', title: 'Make onboarding nicer', description: 'make the onboarding flow feel a bit nicer for people this sprint', url: `${REF}/make-onboarding-nicer`,
  priority: 0, createdAt: new Date().toISOString(), state: { type: 'unstarted' }, team: { key: 'LWT' }, labels: [], ...over,
})
const deliver = (body: Record<string, unknown>, signWith = SECRET) => {
  const raw = JSON.stringify({ organizationId: ORG, webhookTimestamp: Date.now(), ...body })
  return POST(new Request('http://localhost/api/linear/webhook', { method: 'POST', body: raw, headers: { 'linear-signature': createHmac('sha256', signWith).update(raw).digest('hex') } }))
}
const task = async () => (await db.from('tasks').select('*').eq('workspace_id', ws).eq('external_ref', REF).maybeSingle()).data

beforeAll(async () => {
  Object.assign(process.env, { LINEAR_CLIENT_ID: 'c', LINEAR_CLIENT_SECRET: 's', LINEAR_WEBHOOK_SECRET: SECRET, TOKEN_ENCRYPTION_KEY: randomBytes(32).toString('base64') })
  const realFetch = globalThis.fetch
  vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
    if (String(url) !== 'https://api.linear.app/graphql') return realFetch(url, init)
    const { query, variables } = JSON.parse(init.body as string)
    gqlCalls.push({ query, variables })
    if (query.includes('issues(first')) return Response.json({ data: { issues: { nodes: [issue({ id: 'uuid-lwt-2', identifier: 'LWT-2', title: 'Export fails with 504 on 10k rows', description: 'Expected CSV in 5s', url: 'https://linear.app/acme/issue/LWT-2/export', priority: 2 })], pageInfo: { hasNextPage: false, endCursor: null } } } })
    if (query.includes('issue(id: $id) { url }')) return Response.json({ data: { issue: { url: `${REF}/renamed-slug` } } })
    if (query.includes('issue(id: $id) { id }')) return Response.json({ data: { issue: { id: 'uuid-lwt-1' } } })
    if (query.includes('issueLabels')) return Response.json({ data: { issueLabels: { nodes: [{ id: 'lbl-act', name: 'sprint-agent: ACT', team: null }] } } })
    if (query.includes('issueLabelCreate')) return Response.json({ data: { issueLabelCreate: { issueLabel: { id: `lbl-${variables.input.name.split(': ')[1].toLowerCase()}` } } } })
    return Response.json({ data: { ok: { success: true } } })
  })
  ws = (await db.from('workspaces').select('id').eq('slug', 'acme-demo').single()).data!.id
  const admin = (await db.from('workspace_members').select('user_id').eq('workspace_id', ws).eq('role', 'admin').limit(1).single()).data!.user_id
  await saveConnection(db, ws, admin, { kind: 'linear', externalId: ORG, name: 'Acme', siteUrl: 'https://linear.app/acme', tokens: { accessToken: 'lin_at', expiresIn: 86_400 } })
})
afterAll(async () => {
  vi.unstubAllGlobals()
  await db.from('tasks').delete().eq('workspace_id', ws).like('external_ref', 'https://linear.app/acme/issue/LWT-%')
  await db.from('agent_cooldowns').delete().eq('workspace_id', ws).like('key', 'lin-%')
  await forgetConnection(db, ws, 'linear')
})
beforeEach(() => { gqlCalls = [] })

describe('Linear (database, Linear faked)', () => {
  it('rejects bad signatures', async () => {
    expect((await deliver({ type: 'Issue', action: 'create', data: issue() }, 'wrong')).status).toBe(401)
  })

  it('a new issue becomes a triaged task under a slug-free reference; renames update it, not duplicate it', async () => {
    await deliver({ type: 'Issue', action: 'create', data: issue() })
    const t = await task()
    expect(t).toMatchObject({ title: 'LWT-1: Make onboarding nicer', source: 'Linear / LWT', decision: 'ASK' })
    await deliver({ type: 'Issue', action: 'update', data: issue({ title: 'Make onboarding calmer', url: `${REF}/make-onboarding-calmer` }) })
    const { count } = await db.from('tasks').select('id', { count: 'exact', head: true }).eq('workspace_id', ws).eq('external_ref', REF)
    expect(count).toBe(1)
    expect((await task())!.title).toBe('LWT-1: Make onboarding calmer')
  })

  it('write-back stays off until enabled; then one label and the question once', async () => {
    const t = (await task())!
    expect(await linearWriteBack(db, ws, t.id)).toBe('off')
    await db.from('tracker_connections').update({ write_back: true }).eq('workspace_id', ws).eq('kind', 'linear')
    expect(await linearWriteBack(db, ws, t.id)).toBe('labelled+asked')
    const add = gqlCalls.find((c) => c.query.includes('issueAddLabel'))!
    expect(add.variables).toEqual({ id: 'LWT-1', labelId: 'lbl-ask' })
    expect(gqlCalls.filter((c) => c.query.includes('issueRemoveLabel')).map((c) => c.variables.labelId).sort()).toEqual(['lbl-act', 'lbl-escalate'])
    expect(gqlCalls.find((c) => c.query.includes('commentCreate'))!.variables).toMatchObject({ input: { issueId: 'uuid-lwt-1' } })
    gqlCalls = []
    expect(await linearWriteBack(db, ws, t.id)).toBe('labelled')
    expect(gqlCalls.some((c) => c.query.includes('issueLabels'))).toBe(false) // label ids remembered
  })

  it('a person’s reply answers the ASK; the app’s own comments and redeliveries are ignored', async () => {
    const reply = { type: 'Comment', action: 'create', actor: { type: 'user', name: 'Mei' }, data: { id: 'c-1', issueId: 'uuid-lwt-1', body: 'Done when the first screen loads in under 2s. Expected: no spinner.' } }
    await deliver({ ...reply, actor: { type: 'oauthClient', name: 'Sprint Agent' }, data: { ...reply.data, id: 'c-0' } })
    expect((await task())!.decision).toBe('ASK')
    await deliver(reply)
    await deliver(reply)
    const t = (await task())!
    expect(t.decision).not.toBe('ASK')
    const { data: comments } = await db.from('task_comments').select('author_name').eq('task_id', t.id)
    expect(comments).toEqual([{ author_name: 'Mei in Linear' }])
  })

  it('import pulls open issues', async () => {
    expect(await importLinear(db, ws)).toMatchObject({ created: 1 })
    const { data } = await db.from('tasks').select('urgency').eq('workspace_id', ws).eq('external_ref', 'https://linear.app/acme/issue/LWT-2').single()
    expect(data!.urgency).toBe('high')
  })

  it('uninstalling in Linear unlinks the workspace', async () => {
    await deliver({ type: 'OAuthApp', action: 'revoked' })
    expect(await connectionFor(db, ws, 'linear')).toBeNull()
  })
})
