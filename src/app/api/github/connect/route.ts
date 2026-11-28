// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { createAdminClient } from '@/lib/supabase/admin'
import { canConnect, planLimitResponse } from '@/server/billing/plan'
import { githubConfigured, installUrl, signState } from '@/server/github/app'

/** Admin starts the install on GitHub. The signed state ties the round-trip to this workspace and user. */
export async function GET(): Promise<Response> {
  const session = await getSession()
  if (!session?.current) return Response.json({ error: 'UNAUTHENTICATED' }, { status: 401 })
  if (session.current.role !== 'admin') return Response.json({ error: 'FORBIDDEN' }, { status: 403 })
  if (!githubConfigured()) return Response.json({ error: 'GITHUB_NOT_CONFIGURED' }, { status: 503 })
  if (!(await canConnect(createAdminClient(), session.current.workspace.id, 'github'))) return planLimitResponse()
  redirect(installUrl(signState({ ws: session.current.workspace.id, uid: session.user.id })))
}
