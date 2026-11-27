// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { getSession } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'
import { githubConfigured } from '@/server/github/app'

/** Connected GitHub accounts for the current workspace (PM+ through RLS). */
export async function GET(): Promise<Response> {
  const session = await getSession()
  if (!session?.current) return Response.json({ error: 'UNAUTHENTICATED' }, { status: 401 })
  const db = await createClient()
  const { data } = await db.from('github_installations').select('account_login, created_at').eq('workspace_id', session.current.workspace.id)
  return Response.json({ configured: githubConfigured(), installations: data ?? [] })
}
