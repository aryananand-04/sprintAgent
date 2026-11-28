// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { z } from 'zod'
import { getSession } from '@/lib/session'
import { createAdminClient } from '@/lib/supabase/admin'

const Body = z.object({ dmBriefings: z.boolean() })

/** Admin turns the daily Slack DMs on or off. Users can't write the install row, so the server does. */
export async function POST(req: Request): Promise<Response> {
  const session = await getSession()
  if (!session?.current) return Response.json({ error: 'UNAUTHENTICATED' }, { status: 401 })
  if (session.current.role !== 'admin') return Response.json({ error: 'FORBIDDEN' }, { status: 403 })
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'INVALID_REQUEST' }, { status: 400 })
  const { data, error } = await createAdminClient().from('slack_installations')
    .update({ dm_briefings: parsed.data.dmBriefings }).eq('workspace_id', session.current.workspace.id).select('id')
  if (error) return Response.json({ error: 'WRITE_FAILED' }, { status: 500 })
  if (!data?.length) return Response.json({ error: 'NOT_CONNECTED' }, { status: 409 })
  return Response.json({ ok: true })
}
