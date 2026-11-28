// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
// Runs against the local Supabase (npm run test:db).
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/db/database.types'
import { accessToken, connectionFor, forgetConnection, saveConnection } from './connections'

const db = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } })
let ws = ''
let other = ''
let admin = ''
const link = (tokens: { accessToken: string; refreshToken?: string; expiresIn?: number }) => ({ kind: 'linear' as const, externalId: 'org-conn-test', name: 'Acme', siteUrl: 'https://linear.app/acme', tokens })

beforeAll(async () => {
  process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString('base64')
  ws = (await db.from('workspaces').select('id').eq('slug', 'acme-demo').single()).data!.id
  admin = (await db.from('workspace_members').select('user_id').eq('workspace_id', ws).eq('role', 'admin').limit(1).single()).data!.user_id
  other = (await db.from('workspaces').insert({ name: 'Other', slug: `tracker-other-${Date.now()}` }).select('id').single()).data!.id
})
afterAll(async () => {
  await forgetConnection(db, ws, 'linear')
  await db.from('workspaces').delete().eq('id', other)
})

describe('tracker connections (database)', () => {
  it('seals tokens and links one org to one workspace', async () => {
    expect(await saveConnection(db, ws, admin, link({ accessToken: 'lin_at_1', refreshToken: 'lin_rt_1', expiresIn: 86_400 }))).toBe('connected')
    const { data } = await db.from('tracker_connections').select('access_token_sealed, refresh_token_sealed').eq('workspace_id', ws).single()
    expect(JSON.stringify(data)).not.toMatch(/lin_at_1|lin_rt_1/)
    expect(await saveConnection(db, other, admin, link({ accessToken: 'x' }))).toBe('taken')
  })

  it('uses a fresh token as is, without refreshing', async () => {
    const conn = (await connectionFor(db, ws, 'linear'))!
    expect(await accessToken(db, conn, async () => { throw new Error('should not refresh') })).toBe('lin_at_1')
  })

  it('refreshes near expiry; two runners at once agree on one new token', async () => {
    await saveConnection(db, ws, admin, link({ accessToken: 'lin_at_old', refreshToken: 'lin_rt_old', expiresIn: 30 }))
    const conn = (await connectionFor(db, ws, 'linear'))!
    let n = 0
    const refresh = async (rt: string) => { expect(rt).toBe('lin_rt_old'); n++; return { accessToken: `lin_at_new_${n}`, refreshToken: `lin_rt_new_${n}`, expiresIn: 86_400 } }
    const [a, b] = await Promise.all([accessToken(db, conn, refresh), accessToken(db, conn, refresh)])
    const stored = await accessToken(db, conn, async () => { throw new Error('fresh now') })
    expect([a, b]).toContain(stored)
    expect(stored).toMatch(/^lin_at_new_/)
  })
})
