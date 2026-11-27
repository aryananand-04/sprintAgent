import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import type { Role } from '@/lib/permissions'

export const WORKSPACE_COOKIE = 'sa_ws'

export interface SessionUser {
  id: string
  email: string
  name: string
  avatarUrl: string | null
}

export interface Membership {
  workspace: { id: string; name: string; slug: string }
  role: Role
}

export interface Session {
  user: SessionUser
  memberships: Membership[]
  current: Membership | null
}

/** Per-request session: verified JWT claims + workspace memberships (read through RLS). */
export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims
  if (!claims?.sub) return null

  const meta = (claims.user_metadata ?? {}) as Record<string, unknown>
  const email = typeof claims.email === 'string' ? claims.email : ''
  const user: SessionUser = {
    id: claims.sub,
    email,
    name: (meta.full_name as string) || (meta.name as string) || email.split('@')[0] || 'You',
    avatarUrl: (meta.avatar_url as string) || null,
  }

  const { data: rows, error } = await supabase
    .from('workspace_members')
    .select('role, workspaces!inner(id, name, slug)')
    .eq('user_id', user.id)
    .order('created_at')
  if (error) throw error

  const memberships: Membership[] = (rows ?? []).map((r) => ({ role: r.role, workspace: r.workspaces }))
  const preferred = (await cookies()).get(WORKSPACE_COOKIE)?.value
  const current = memberships.find((m) => m.workspace.id === preferred) ?? memberships[0] ?? null

  return { user, memberships, current }
})

/** OAuth providers enabled for this deployment (must also be enabled in Supabase). */
export function enabledProviders(): Array<'github' | 'google'> {
  return (process.env.AUTH_PROVIDERS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s): s is 'github' | 'google' => s === 'github' || s === 'google')
}

export const passwordLoginEnabled = () =>
  process.env.NODE_ENV !== 'production' || process.env.ALLOW_PASSWORD_LOGIN === 'true'
