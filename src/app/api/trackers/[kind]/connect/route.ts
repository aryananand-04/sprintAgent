// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { siteOrigin } from '@/lib/origin'
import { createAdminClient } from '@/lib/supabase/admin'
import { canConnect, planLimitResponse } from '@/server/billing/plan'
import { providerFor } from '@/server/trackers/providers'

/** Admin starts connecting Linear or Jira. The signed state ties the round-trip to this workspace and user. */
export async function GET(_req: Request, ctx: { params: Promise<{ kind: string }> }): Promise<Response> {
  const p = providerFor((await ctx.params).kind)
  if (!p) return Response.json({ error: 'NOT_FOUND' }, { status: 404 })
  const session = await getSession()
  if (!session?.current) return Response.json({ error: 'UNAUTHENTICATED' }, { status: 401 })
  if (session.current.role !== 'admin') return Response.json({ error: 'FORBIDDEN' }, { status: 403 })
  if (!p.provider.configured()) return Response.json({ error: 'NOT_CONFIGURED' }, { status: 503 })
  if (!(await canConnect(createAdminClient(), session.current.workspace.id, p.kind))) return planLimitResponse()
  const state = p.provider.signState({ ws: session.current.workspace.id, uid: session.user.id })
  redirect(p.provider.authorizeUrl(state, `${await siteOrigin()}/api/trackers/${p.kind}/oauth`))
}
