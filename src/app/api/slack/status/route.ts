// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { getSession } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { slackConfigured } from '@/server/slack/api'
import { disconnect } from '@/server/slack/install'

/** Which Slack team and channel this workspace is linked to (PM+ through RLS; the token is never readable). */
export async function GET(): Promise<Response> {
  const session = await getSession()
  if (!session?.current) return Response.json({ error: 'UNAUTHENTICATED' }, { status: 401 })
  const db = await createClient()
  const { data } = await db.from('slack_installations').select('team_name, channel_name, created_at, dm_briefings').eq('workspace_id', session.current.workspace.id).maybeSingle()
  return Response.json({ configured: slackConfigured(), installation: data ?? null })
}

/** Admin disconnects: the token is revoked at Slack and forgotten here. */
export async function DELETE(): Promise<Response> {
  const session = await getSession()
  if (!session?.current) return Response.json({ error: 'UNAUTHENTICATED' }, { status: 401 })
  if (session.current.role !== 'admin') return Response.json({ error: 'FORBIDDEN' }, { status: 403 })
  await disconnect(createAdminClient(), session.current.workspace.id)
  return Response.json({ ok: true })
}
