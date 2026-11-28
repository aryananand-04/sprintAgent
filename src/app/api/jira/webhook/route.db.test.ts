// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
// Runs against the local Supabase (npm run test:db). Jira is faked; nothing leaves the machine.
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { createHmac, randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/db/database.types'
import { connectionFor, forgetConnection, saveConnection } from '@/server/trackers/connections'
import { importJira, jiraWriteBack, maybeRefreshJiraWebhooks, registerWebhooks } from '@/server/jira/sync'
import { POST } from './route'

const db = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } })
const SECRET = 'jira-client-secret'
const SITE = 'https://jwt-test.atlassian.net'
const CLOUD = 'cloud-jwt-test'
let ws = ''
let calls: Array<{ method: string; path: string; body?: Record<string, unknown> }> = []

const jwt = (secret = SECRET) => {
  const b = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const body = `${b({ alg: 'HS256', typ: 'JWT' })}.${b({ iss: 'jira', exp: Math.floor(Date.now() / 1000) + 60 })}`
  return `Bearer ${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`
}
const issue = (over: Record<string, unknown> = {}) => ({
  id: '10001', key: 'JWT-1',
  fields: { summary: 'Make onboarding nicer', description: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'make the onboarding flow feel a bit nicer for people this sprint' }] }] }, labels: [], priority: { name: 'Medium' }, status: { statusCategory: { key: 'new' } }, issuetype: { name: 'Story' }, created: new Date().toISOString(), project: { key: 'JWT' }, ...over },
})
const deliver = (body: Record<string, unknown>, auth = jwt(), id = 'd-1') =>
  POST(new Request('http://localhost/api/jira/webhook', { method: 'POST', body: JSON.stringify({ matchedWebhookIds: [7001], timestamp: Date.now(), ...body }), headers: { authorization: auth, 'x-atlassian-webhook-identifier': id } }))
const task = async (key = 'JWT-1') => (await db.from('tasks').select('*').eq('workspace_id', ws).eq('external_ref', `${SITE}/browse/${key}`).maybeSingle()).data

beforeAll(async () => {
  Object.assign(process.env, { JIRA_CLIENT_ID: 'c', JIRA_CLIENT_SECRET: SECRET, TOKEN_ENCRYPTION_KEY: randomBytes(32).toString('base64') })
  const realFetch = globalThis.fetch
  vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
    const u = String(url)
    const base = `https://api.atlassian.com/ex/jira/${CLOUD}/rest/api/3`
    if (!u.startsWith(base)) return realFetch(url, init)
    const path = u.slice(base.length)
    const method = init.method ?? 'GET'
    calls.push({ method, path, body: init.body ? JSON.parse(init.body as string) : undefined })
    if (path.startsWith('/project/search')) return Response.json({ values: [{ key: 'JWT' }, { key: 'OPS' }] })
    if (path === '/webhook' && method === 'POST') return Response.json({ webhookRegistrationResult: [{ createdWebhookId: 7001 }] })
    if (path === '/search/jql') return Response.json({ issues: [issue({ summary: 'Export fails with 504 on 10k rows', priority: { name: 'Highest' } })].map((i) => ({ ...i, key: 'JWT-2', id: '10002' })) })
    return new Response(null, { status: 204 })
  })
  ws = (await db.from('workspaces').select('id').eq('slug', 'acme-demo').single()).data!.id
  const admin = (await db.from('workspace_members').select('user_id').eq('workspace_id', ws).eq('role', 'admin').limit(1).single()).data!.user_id
  await saveConnection(db, ws, admin, { kind: 'jira', externalId: CLOUD, name: 'JWT Test', siteUrl: SITE, tokens: { accessToken: 'jira_at', expiresIn: 3_600 } })
})
afterAll(async () => {
  vi.unstubAllGlobals()
  await db.from('tasks').delete().eq('workspace_id', ws).like('external_ref', `${SITE}/browse/%`)
  await db.from('agent_cooldowns').delete().eq('workspace_id', ws).like('key', 'jira-%')
  await forgetConnection(db, ws, 'jira')
})
beforeEach(() => { calls = [] })

describe('Jira (database, Jira faked)', () => {
  it('registers a webhook for the site’s projects and remembers its id', async () => {
    const conn = (await connectionFor(db, ws, 'jira'))!
    expect(await registerWebhooks(db, conn, 'https://app.example')).toEqual([7001])
    expect(calls.find((c) => c.path === '/webhook')!.body).toMatchObject({ url: 'https://app.example/api/jira/webhook', webhooks: [{ jqlFilter: 'project IN (JWT, OPS)' }] })
  })

  it('rejects deliveries not signed with the client secret', async () => {
    expect((await deliver({ webhookEvent: 'jira:issue_created', issue: issue() }, jwt('other'))).status).toBe(401)
  })

  it('a new issue becomes a triaged task; deleting it in Jira closes it here', async () => {
    await deliver({ webhookEvent: 'jira:issue_created', issue: issue() })
    expect(await task()).toMatchObject({ title: 'JWT-1: Make onboarding nicer', source: 'Jira / JWT', decision: 'ASK', type: 'feature' })
  })

  it('write-back is opt-in; then one label and the question once, as ADF', async () => {
    const t = (await task())!
    expect(await jiraWriteBack(db, ws, t.id)).toBe('off')
    await db.from('tracker_connections').update({ write_back: true }).eq('workspace_id', ws).eq('kind', 'jira')
    expect(await jiraWriteBack(db, ws, t.id)).toBe('labelled+asked')
    expect(calls.find((c) => c.method === 'PUT')!.body).toEqual({ update: { labels: [{ remove: 'sprint-agent-ACT' }, { add: 'sprint-agent-ASK' }, { remove: 'sprint-agent-ESCALATE' }] } })
    const comment = calls.find((c) => c.path === '/issue/JWT-1/comment')!
    expect(JSON.stringify(comment.body)).toContain('Asked by Sprint Agent while triaging this issue.')
    expect(JSON.stringify(comment.body)).not.toContain('<sub>')
    calls = []
    expect(await jiraWriteBack(db, ws, t.id)).toBe('labelled')
    expect(calls.some((c) => c.path.endsWith('/comment'))).toBe(false)
  })

  it('a person’s comment answers the ASK; app comments and retries are ignored', async () => {
    const human = { webhookEvent: 'comment_created', issue: issue(), comment: { id: 'c1', author: { accountType: 'atlassian', displayName: 'Mei' }, body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Done when the first screen loads in under 2s. Expected: no spinner.' }] }] } } }
    await deliver({ ...human, comment: { ...human.comment, id: 'c0', author: { accountType: 'app', displayName: 'Sprint Agent' } } }, jwt(), 'd-app')
    expect((await task())!.decision).toBe('ASK')
    await deliver(human, jwt(), 'd-human')
    await deliver(human, jwt(), 'd-human')
    const t = (await task())!
    expect(t.decision).not.toBe('ASK')
    const { data } = await db.from('task_comments').select('author_name').eq('task_id', t.id)
    expect(data).toEqual([{ author_name: 'Mei in Jira' }])
  })

  it('deleted in Jira: closed here', async () => {
    await deliver({ webhookEvent: 'jira:issue_deleted', issue: issue() }, jwt(), 'd-del')
    expect((await task())!.status).toBe('done')
  })

  it('import pulls open issues with Jira priority', async () => {
    expect(await importJira(db, ws)).toMatchObject({ created: 1 })
    expect((await task('JWT-2'))!.urgency).toBe('critical')
  })

  it('extends webhooks weekly, not every tick', async () => {
    expect(await maybeRefreshJiraWebhooks(db, ws)).toBe(false)
    expect(await maybeRefreshJiraWebhooks(db, ws, Date.now() + 8 * 86_400_000)).toBe(true)
    expect(calls.find((c) => c.path === '/webhook/refresh')!.body).toEqual({ webhookIds: [7001] })
  })
})
