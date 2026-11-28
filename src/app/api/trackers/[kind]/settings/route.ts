// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { z } from 'zod'
import { getSession } from '@/lib/session'
import { createAdminClient } from '@/lib/supabase/admin'
import { providerFor } from '@/server/trackers/providers'

const Body = z.object({ writeBack: z.boolean() })

/** Admin turns write-back (labels + ASK comments on the tracker) on or off. */
export async function POST(req: Request, ctx: { params: Promise<{ kind: string }> }): Promise<Response> {
  const p = providerFor((await ctx.params).kind)
  if (!p) return Response.json({ error: 'NOT_FOUND' }, { status: 404 })
  const session = await getSession()
  if (!session?.current) return Response.json({ error: 'UNAUTHENTICATED' }, { status: 401 })
  if (session.current.role !== 'admin') return Response.json({ error: 'FORBIDDEN' }, { status: 403 })
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'INVALID_REQUEST' }, { status: 400 })
  const { data, error } = await createAdminClient().from('tracker_connections').update({ write_back: parsed.data.writeBack })
    .eq('workspace_id', session.current.workspace.id).eq('kind', p.kind).select('id')
  if (error) return Response.json({ error: 'WRITE_FAILED' }, { status: 500 })
  if (!data?.length) return Response.json({ error: 'NOT_CONNECTED' }, { status: 409 })
  return Response.json({ ok: true })
}
