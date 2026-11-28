// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { getSession } from '@/lib/session'
import { can } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/server'

/** Recomputes the decision log's hash chain (PM+). Any edit or deletion shows up as the first broken row. */
export async function GET(): Promise<Response> {
  const session = await getSession()
  if (!session?.current) return Response.json({ error: 'UNAUTHENTICATED' }, { status: 401 })
  if (!can(session.current.role, 'task:manage')) return Response.json({ error: 'FORBIDDEN' }, { status: 403 })
  const { data, error } = await (await createClient()).rpc('verify_decision_chain', { ws: session.current.workspace.id })
  if (error || !data?.[0]) return Response.json({ error: 'VERIFY_FAILED' }, { status: 500 })
  return Response.json({ checked: data[0].checked, ok: data[0].ok, brokenAt: data[0].broken_at })
}
