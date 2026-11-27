// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { z } from 'zod'
import { getSession } from '@/lib/session'
import { createAdminClient } from '@/lib/supabase/admin'

/** Admin switches GitHub write-back on or off for this workspace's installations. */
export async function POST(req: Request): Promise<Response> {
  const session = await getSession()
  if (!session?.current) return Response.json({ error: 'UNAUTHENTICATED' }, { status: 401 })
  if (session.current.role !== 'admin') return Response.json({ error: 'FORBIDDEN' }, { status: 403 })
  const parsed = z.object({ writeBack: z.boolean() }).safeParse(await req.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'INVALID_REQUEST' }, { status: 400 })
  const { error } = await createAdminClient().from('github_installations')
    .update({ write_back: parsed.data.writeBack }).eq('workspace_id', session.current.workspace.id)
  if (error) return Response.json({ error: 'WRITE_FAILED' }, { status: 500 })
  return Response.json({ ok: true, writeBack: parsed.data.writeBack })
}
