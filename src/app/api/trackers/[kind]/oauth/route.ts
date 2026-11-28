// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { NextResponse } from 'next/server'
import { canConnect } from '@/server/billing/plan'
import { getSession } from '@/lib/session'
import { siteOrigin } from '@/lib/origin'
import { createAdminClient } from '@/lib/supabase/admin'
import { providerFor } from '@/server/trackers/providers'
import { connectionFor, saveConnection } from '@/server/trackers/connections'
import { startTrackerImport } from '@/server/trackers/jobs'

/**
 * The tracker sends the admin back here. We only link it if the signed state matches the signed-in
 * admin and workspace, and the org/site isn't already linked to another workspace. Then we import.
 */
export async function GET(req: Request, ctx: { params: Promise<{ kind: string }> }): Promise<Response> {
  const p = providerFor((await ctx.params).kind)
  if (!p) return Response.json({ error: 'NOT_FOUND' }, { status: 404 })
  const url = new URL(req.url)
  const origin = await siteOrigin()
  const back = (q: string) => NextResponse.redirect(new URL(`/app?${p.kind}=${q}`, origin))
  if (url.searchParams.get('error')) return back('cancelled')
  const session = await getSession()
  const state = p.provider.readState(url.searchParams.get('state'))
  if (!session?.current || !state || state.uid !== session.user.id || state.ws !== session.current.workspace.id || session.current.role !== 'admin') return back('denied')
  const code = url.searchParams.get('code')
  if (!code || code.length > 2_000) return back('invalid')

  const db = createAdminClient()
  if (!(await canConnect(db, state.ws, p.kind))) return back('plan-limit')
  try {
    const link = await p.provider.complete(code, `${origin}/api/trackers/${p.kind}/oauth`)
    const result = await saveConnection(db, state.ws, session.user.id, { kind: p.kind, ...link })
    if (result !== 'connected') return back(result)
    const conn = await connectionFor(db, state.ws, p.kind)
    if (conn && p.provider.afterConnect) await p.provider.afterConnect(db, conn, origin)
    await startTrackerImport(state.ws, p.kind)
    return back('connected')
  } catch (e) {
    console.error(`[${p.kind}] oauth`, e instanceof Error ? e.message : e)
    return back('error')
  }
}
