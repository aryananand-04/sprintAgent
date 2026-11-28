// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { createAdminClient } from '@/lib/supabase/admin'
import { canConnect } from '@/server/billing/plan'
import { asApp, readState } from '@/server/github/app'
import { startImport } from '@/server/github/jobs'

/**
 * GitHub sends the admin back here after installing. We only link the installation if the signed state
 * matches the signed-in admin and workspace, the installation really belongs to our app, and it isn't
 * already linked elsewhere.
 */
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const back = (q: string) => NextResponse.redirect(new URL(`/app?github=${q}`, url.origin))
  const session = await getSession()
  const state = readState(url.searchParams.get('state'))
  const installationId = Number(url.searchParams.get('installation_id'))
  if (!session?.current || !state || state.uid !== session.user.id || state.ws !== session.current.workspace.id || session.current.role !== 'admin') return back('denied')
  if (!Number.isSafeInteger(installationId) || installationId <= 0) return back('invalid')

  const inst = await asApp<{ id: number; account: { login: string } }>(`/app/installations/${installationId}`).catch(() => null)
  if (!inst) return back('invalid')

  const db = createAdminClient()
  if (!(await canConnect(db, state.ws, 'github'))) return back('plan-limit')
  const { error } = await db.from('github_installations')
    .insert({ workspace_id: state.ws, installation_id: inst.id, account_login: inst.account.login, connected_by: session.user.id })
  if (error?.code === '23505') {
    const { data } = await db.from('github_installations').select('workspace_id').eq('installation_id', inst.id).single()
    if (data?.workspace_id !== state.ws) return back('taken')
  } else if (error) return back('error')

  await startImport(state.ws, inst.id)
  return back('connected')
}
