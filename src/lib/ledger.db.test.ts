// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
// Runs against the local Supabase (npm run test:db): the offline verifier must agree with Postgres.
import { describe, it, expect, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/db/database.types'
import { verifyLedger, type LedgerRow } from './ledger'

const db = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } })
let rows: LedgerRow[] = []

beforeAll(async () => {
  const ws = (await db.from('workspaces').select('id').eq('slug', 'acme-demo').single()).data!.id
  // Awkward content on purpose: unicode, quotes, nested and numeric payloads, nulls, newlines.
  await db.from('decisions').insert([
    { workspace_id: ws, kind: 'license', source: 'rules', rationale: 'Earned “Act” for bug assign work.\nAgreed 63/64.', payload: { to: 3, from: 2, action: 'assign', ratio: 0.984, nested: { b: [1, 'x', null], aa: true } } },
    { workspace_id: ws, kind: 'override', source: 'human', decision: 'ACT', rationale: 'Ünïcödé, "quotes", | pipes', payload: {} },
  ])
  const { data } = await db.from('decisions').select('chain_index, id, workspace_id, created_at, kind, source, decision, rationale, subject_id, actor_ref, payload, prev_hash, hash').eq('workspace_id', ws).order('chain_index')
  rows = data as unknown as LedgerRow[]
})

describe('offline ledger verification', () => {
  it('recomputes every hash Postgres wrote', () => {
    expect(rows.length).toBeGreaterThanOrEqual(2)
    expect(verifyLedger(rows)).toEqual({ ok: true, checked: rows.length, brokenAt: null })
  })
  it('catches an edited row, a dropped row and a reordered chain', () => {
    const edited = rows.map((r, i) => (i === rows.length - 1 ? { ...r, rationale: 'edited' } : r))
    expect(verifyLedger(edited)).toMatchObject({ ok: false, brokenAt: rows[rows.length - 1].id })
    expect(verifyLedger(rows.slice(1)).ok).toBe(false)
    expect(verifyLedger(rows.map((r, i) => (i === 0 ? { ...r, payload: { x: 1 } } : r))).ok).toBe(false)
  })
})
