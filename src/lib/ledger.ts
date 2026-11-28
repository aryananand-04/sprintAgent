// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
// Offline verification of an exported decision log (Earned Autonomy spec §6). No database needed:
// this recomputes exactly what the `app.decision_hash` trigger function computed when each row was written.
import { createHash } from 'node:crypto'

export interface LedgerRow {
  id: string
  workspace_id: string
  chain_index: number | string
  created_at: string
  kind: string
  source: string
  decision: string | null
  rationale: string
  subject_id: string | null
  actor_ref: string | null
  payload: unknown
  prev_hash: string | null
  hash: string
}

/** PostgreSQL `jsonb` text: object keys by length then bytes, `, ` and `: ` separators, UTF-8 as is. */
export function jsonbText(v: unknown): string {
  if (v === null || v === undefined) return 'null'
  if (Array.isArray(v)) return `[${v.map(jsonbText).join(', ')}]`
  if (typeof v === 'object') {
    const keys = Object.keys(v as object).sort((a, b) => {
      const la = Buffer.byteLength(a), lb = Buffer.byteLength(b)
      return la !== lb ? la - lb : Buffer.compare(Buffer.from(a), Buffer.from(b))
    })
    return `{${keys.map((k) => `${JSON.stringify(k)}: ${jsonbText((v as Record<string, unknown>)[k])}`).join(', ')}}`
  }
  return JSON.stringify(v)
}

/** Microseconds since the epoch from an ISO timestamp (Postgres keeps microseconds; Date keeps ms). */
export function isoToMicros(iso: string): bigint {
  const m = iso.match(/^(.*?)(?:\.(\d+))?(Z|[+-]\d{2}(?::?\d{2})?)$/)
  if (!m) throw new Error(`bad timestamp: ${iso}`)
  const whole = BigInt(Date.parse(`${m[1]}${m[3].length === 3 ? `${m[3]}:00` : m[3]}`)) * 1000n
  const frac = (m[2] ?? '').padEnd(6, '0').slice(0, 6)
  return whole + BigInt(frac)
}

export function rowHash(prev: string | null, r: LedgerRow): string {
  const material = [
    prev ?? '', r.id, String(r.chain_index), r.workspace_id, r.kind, r.source, r.decision ?? '', r.rationale,
    jsonbText(typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload), r.subject_id ?? '', r.actor_ref ?? '',
    isoToMicros(r.created_at).toString(),
  ].join('|')
  return createHash('sha256').update(material, 'utf8').digest('hex')
}

/** Walks the chain in order. `brokenAt` is the first row whose link or hash doesn't match. */
export function verifyLedger(rows: LedgerRow[]): { ok: boolean; checked: number; brokenAt: string | null } {
  const sorted = [...rows].sort((a, b) => Number(a.chain_index) - Number(b.chain_index))
  let prev: string | null = null
  for (const [i, r] of sorted.entries()) {
    if (Number(r.chain_index) !== i + 1 || (r.prev_hash ?? null) !== prev || rowHash(prev, r) !== r.hash) return { ok: false, checked: i + 1, brokenAt: r.id }
    prev = r.hash
  }
  return { ok: true, checked: sorted.length, brokenAt: null }
}
