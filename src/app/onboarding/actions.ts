// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { WORKSPACE_COOKIE } from '@/lib/session'

export interface OnboardingState {
  error?: string
}

const Workspace = z.object({
  name: z.string().trim().min(2, 'Name is too short.').max(60, 'Name is too long.'),
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]{1,47}$/, 'Use 2–48 lowercase letters, numbers or dashes.'),
})

export async function createWorkspace(_prev: OnboardingState, form: FormData): Promise<OnboardingState> {
  const parsed = Workspace.safeParse({ name: form.get('name'), slug: form.get('slug') })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message }

  const supabase = await createClient()
  const { data: id, error } = await supabase.rpc('create_workspace', { p_name: parsed.data.name, p_slug: parsed.data.slug })
  if (error) {
    return { error: error.code === '23505' ? 'That URL is taken — try another.' : 'Could not create the workspace.' }
  }

  ;(await cookies()).set(WORKSPACE_COOKIE, id, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 365 })
  redirect('/app')
}

export async function switchWorkspace(form: FormData) {
  const id = z.guid().safeParse(form.get('workspaceId'))
  if (id.success) {
    ;(await cookies()).set(WORKSPACE_COOKIE, id.data, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 365 })
  }
  redirect('/app')
}
