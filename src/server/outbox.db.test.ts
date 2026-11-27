// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
// Runs against the local Supabase (npm run test:db). Uses the service key, like the server does.
import { describe, it, expect, beforeEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/db/database.types'
import { existsSync } from 'node:fs'
import { enqueue, deliverDue } from './outbox'

if (!process.env.SUPABASE_SECRET_KEY && existsSync('.env.local')) process.loadEnvFile('.env.local')

const db = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } })

let ws = ''
const pub = async () => ['93.184.216.34']
const event = { type: 'escalation' as const, taskTitle: 'Checkout down', reason: 'Provider outage', recommendation: 'Fail over', urgency: 'critical' as const }

beforeEach(async () => {
  const { data } = await db.from('workspaces').select('id').eq('slug', 'acme-demo').single()
  ws = data!.id
  await db.from('integrations').delete().eq('workspace_id', ws)
  await db.from('integrations').insert({ workspace_id: ws, kind: 'slack_webhook', url: 'https://hooks.slack.com/services/T/B/test' })
})

describe('outbox (database)', () => {
  it('queues, delivers once, and marks sent', async () => {
    expect(await enqueue(db, ws, event)).toBe(1)
    let calls = 0
    const f = async () => { calls++; return new Response('ok') }
    const [a, b] = await Promise.all([deliverDue(db, { workspaceId: ws, fetch: f, resolve: pub }), deliverDue(db, { workspaceId: ws, fetch: f, resolve: pub })])
    expect(a.sent + b.sent).toBe(1)
    expect(calls).toBe(1)
    const { data } = await db.from('outbox').select('status').eq('workspace_id', ws)
    expect(data).toEqual([{ status: 'sent' }])
  })

  it('backs off on failure and gives up after the limit', async () => {
    await enqueue(db, ws, event)
    const fail = async () => new Response('down', { status: 503 })
    let now = new Date()
    for (let i = 0; i < 8; i++) {
      await deliverDue(db, { workspaceId: ws, fetch: fail, resolve: pub, now })
      now = new Date(now.getTime() + 7 * 60 * 60_000) // jump past the longest backoff
    }
    const { data } = await db.from('outbox').select('status, attempts, last_error').eq('workspace_id', ws).single()
    expect(data).toMatchObject({ status: 'dead', attempts: 8, last_error: 'HTTP_503' })
  })

  it('skips events an integration did not ask for', async () => {
    expect(await enqueue(db, ws, { type: 'decision', taskTitle: 'T', decision: 'ACT', reason: 'r' })).toBe(0)
  })
})
