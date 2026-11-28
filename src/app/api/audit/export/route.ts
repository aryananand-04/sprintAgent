// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { getSession } from '@/lib/session'
import { can } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/server'
import { toCsv } from '@/logic/csv'
import { ENTITLEMENTS, PLAN_NAMES, planWith } from '@/logic/billing'
import { getPlan } from '@/server/billing/plan'
import { createAdminClient } from '@/lib/supabase/admin'

const COLUMNS = ['chain_index', 'id', 'workspace_id', 'created_at', 'kind', 'source', 'decision', 'rationale', 'subject_id', 'actor_ref', 'payload', 'prev_hash', 'hash'] as const
const PAGE = 1_000
const MAX_ROWS = 50_000

/**
 * The decision log with its hash chain, as CSV or JSON (PM+). Anyone holding the export can recompute
 * the chain to check nothing was changed after it was written (see docs/earned-autonomy-spec.md).
 */
export async function GET(req: Request): Promise<Response> {
  const session = await getSession()
  if (!session?.current) return Response.json({ error: 'UNAUTHENTICATED' }, { status: 401 })
  if (!can(session.current.role, 'task:manage')) return Response.json({ error: 'FORBIDDEN' }, { status: 403 })
  // Verifying the chain is on every plan; taking the log away is a compliance feature.
  if (!ENTITLEMENTS[await getPlan(createAdminClient(), session.current.workspace.id)].auditExport) {
    return Response.json({ error: 'PLAN_REQUIRED', plan: planWith('auditExport'), message: `Exporting the decision log is on ${PLAN_NAMES[planWith('auditExport')]}.` }, { status: 402 })
  }
  const format = new URL(req.url).searchParams.get('format') === 'json' ? 'json' : 'csv'
  const db = await createClient()
  const ws = session.current.workspace.id

  const rows: Array<Record<string, unknown>> = []
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await db.from('decisions').select(COLUMNS.join(', ')).eq('workspace_id', ws)
      .order('chain_index').range(from, from + PAGE - 1)
    if (error) return Response.json({ error: 'READ_FAILED' }, { status: 500 })
    rows.push(...((data ?? []) as unknown as Array<Record<string, unknown>>))
    if (!data || data.length < PAGE) break
  }
  const slug = session.current.workspace.slug
  const stamp = new Date().toISOString().slice(0, 10)
  const headers = { 'Cache-Control': 'no-store', 'Content-Disposition': `attachment; filename="sprint-agent-decisions-${slug}-${stamp}.${format}"` }
  if (format === 'json') return new Response(JSON.stringify({ workspace: slug, exportedAt: new Date().toISOString(), hashAlgorithm: 'sha256', decisions: rows }, null, 2), { headers: { ...headers, 'Content-Type': 'application/json' } })
  return new Response(toCsv(rows, [...COLUMNS]), { headers: { ...headers, 'Content-Type': 'text/csv; charset=utf-8' } })
}
