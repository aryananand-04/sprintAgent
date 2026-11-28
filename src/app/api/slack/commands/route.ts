// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { createAdminClient } from '@/lib/supabase/admin'
import { ephemeral } from '@/logic/slack'
import { verifySlackRequest } from '@/server/slack/api'
import { linkForTeam } from '@/server/slack/install'
import { gate } from '@/server/slack/actions'
import { intakeFromSlack } from '@/server/slack/intake'

/** `/sprint <request>`: files the request, triages it, and answers only the person who typed it. */
export async function POST(req: Request): Promise<Response> {
  const raw = await req.text()
  if (!verifySlackRequest(raw, req.headers.get('x-slack-request-timestamp'), req.headers.get('x-slack-signature'))) {
    return Response.json({ error: 'BAD_SIGNATURE' }, { status: 401 })
  }
  const f = new URLSearchParams(raw)
  const teamId = f.get('team_id'), userId = f.get('user_id')
  if (!teamId || !userId) return Response.json(ephemeral('That request was missing who sent it.'))

  const db = createAdminClient()
  const link = await linkForTeam(db, teamId)
  if (!link) return Response.json(ephemeral('This Slack workspace isn’t linked to Sprint Agent. An admin can connect it under Agent settings.'))
  const g = await gate(db, link, userId, 'task:create')
  if (!g.ok) return Response.json(ephemeral(g.message))
  try {
    return Response.json(ephemeral(await intakeFromSlack(db, link.workspaceId, g.member, f.get('text') ?? '')))
  } catch (e) {
    console.error('[slack] intake', e instanceof Error ? e.message : e)
    return Response.json(ephemeral('Something went wrong while filing that. Check the board before trying again, in case it got through.'))
  }
}
