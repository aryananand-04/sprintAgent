// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { siteOrigin } from '@/lib/origin'
import { createAdminClient } from '@/lib/supabase/admin'
import { exchangeCode, readState } from '@/server/slack/api'
import { saveInstall } from '@/server/slack/install'

/**
 * Slack sends the admin back here. We only link the team if the signed state matches the signed-in
 * admin and workspace, and the team isn't already linked to another workspace.
 */
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const origin = await siteOrigin()
  const back = (q: string) => NextResponse.redirect(new URL(`/app?slack=${q}`, origin))
  if (url.searchParams.get('error')) return back('cancelled') // the admin pressed Cancel on Slack's page
  const session = await getSession()
  const state = readState(url.searchParams.get('state'))
  if (!session?.current || !state || state.uid !== session.user.id || state.ws !== session.current.workspace.id || session.current.role !== 'admin') return back('denied')
  const code = url.searchParams.get('code')
  if (!code || code.length > 200) return back('invalid')

  const install = await exchangeCode(code, `${origin}/api/slack/oauth`).catch((e) => { console.error('[slack] oauth', e instanceof Error ? e.message : e); return null })
  if (!install) return back('error')
  const result = await saveInstall(createAdminClient(), state.ws, session.user.id, install).catch((e) => { console.error('[slack] save', e); return 'error' as const })
  return back(result)
}
