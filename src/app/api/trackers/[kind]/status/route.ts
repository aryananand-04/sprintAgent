// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { getSession } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { providerFor } from '@/server/trackers/providers'
import { connectionFor, forgetConnection } from '@/server/trackers/connections'

/** What's linked (PM+ through RLS; tokens are never readable). */
export async function GET(_req: Request, ctx: { params: Promise<{ kind: string }> }): Promise<Response> {
  const p = providerFor((await ctx.params).kind)
  if (!p) return Response.json({ error: 'NOT_FOUND' }, { status: 404 })
  const session = await getSession()
  if (!session?.current) return Response.json({ error: 'UNAUTHENTICATED' }, { status: 401 })
  const { data } = await (await createClient()).from('tracker_connections').select('name, site_url, write_back, created_at')
    .eq('workspace_id', session.current.workspace.id).eq('kind', p.kind).maybeSingle()
  return Response.json({ configured: p.provider.configured(), connection: data ?? null })
}

/** Admin disconnects: tokens revoked and webhooks removed where the tracker allows, then forgotten. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ kind: string }> }): Promise<Response> {
  const p = providerFor((await ctx.params).kind)
  if (!p) return Response.json({ error: 'NOT_FOUND' }, { status: 404 })
  const session = await getSession()
  if (!session?.current) return Response.json({ error: 'UNAUTHENTICATED' }, { status: 401 })
  if (session.current.role !== 'admin') return Response.json({ error: 'FORBIDDEN' }, { status: 403 })
  const db = createAdminClient()
  const ws = session.current.workspace.id
  const conn = await connectionFor(db, ws, p.kind)
  if (conn && p.provider.beforeDisconnect) await p.provider.beforeDisconnect(db, conn).catch((e) => console.error(`[${p.kind}] disconnect`, e instanceof Error ? e.message : e))
  await forgetConnection(db, ws, p.kind)
  return Response.json({ ok: true })
}
