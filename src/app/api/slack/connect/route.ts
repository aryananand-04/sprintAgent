// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { siteOrigin } from '@/lib/origin'
import { createAdminClient } from '@/lib/supabase/admin'
import { canConnect, planLimitResponse } from '@/server/billing/plan'
import { authorizeUrl, signState, slackConfigured } from '@/server/slack/api'

/** Admin starts the Slack install. The signed state ties the round-trip to this workspace and user. */
export async function GET(): Promise<Response> {
  const session = await getSession()
  if (!session?.current) return Response.json({ error: 'UNAUTHENTICATED' }, { status: 401 })
  if (session.current.role !== 'admin') return Response.json({ error: 'FORBIDDEN' }, { status: 403 })
  if (!slackConfigured()) return Response.json({ error: 'SLACK_NOT_CONFIGURED' }, { status: 503 })
  if (!(await canConnect(createAdminClient(), session.current.workspace.id, 'slack'))) return planLimitResponse()
  redirect(authorizeUrl(signState({ ws: session.current.workspace.id, uid: session.user.id }), `${await siteOrigin()}/api/slack/oauth`))
}
