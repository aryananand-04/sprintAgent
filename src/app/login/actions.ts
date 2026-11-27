'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { siteOrigin } from '@/lib/origin'
import { safeNext } from '@/lib/safeNext'
import { enabledProviders, passwordLoginEnabled } from '@/lib/session'

export interface AuthState {
  status: 'idle' | 'sent' | 'error'
  message?: string
}

const Email = z.email().max(254)

const callbackUrl = async (next: string) =>
  `${await siteOrigin()}/auth/callback?next=${encodeURIComponent(safeNext(next))}`

export async function sendMagicLink(_prev: AuthState, form: FormData): Promise<AuthState> {
  const email = Email.safeParse(String(form.get('email') ?? '').trim().toLowerCase())
  if (!email.success) return { status: 'error', message: 'Enter a valid email address.' }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email: email.data,
    options: { emailRedirectTo: await callbackUrl(String(form.get('next') ?? '')) },
  })
  // Same response whether or not the account exists (no user enumeration).
  if (error && error.status !== 422) return { status: 'error', message: 'Could not send the link. Try again in a minute.' }
  return { status: 'sent', message: `Check ${email.data} for a sign-in link.` }
}

export async function signInWithProvider(form: FormData) {
  const provider = String(form.get('provider'))
  if (!enabledProviders().includes(provider as 'github' | 'google')) redirect('/login?error=provider')

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: provider as 'github' | 'google',
    options: { redirectTo: await callbackUrl(String(form.get('next') ?? '')) },
  })
  if (error || !data.url) redirect('/login?error=provider')
  redirect(data.url)
}

const PasswordForm = z.object({ email: Email, password: z.string().min(1).max(128) })

export async function signInWithPassword(_prev: AuthState, form: FormData): Promise<AuthState> {
  if (!passwordLoginEnabled()) return { status: 'error', message: 'Password sign-in is disabled.' }
  const parsed = PasswordForm.safeParse({ email: form.get('email'), password: form.get('password') })
  if (!parsed.success) return { status: 'error', message: 'Enter your email and password.' }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) return { status: 'error', message: 'Invalid email or password.' }
  redirect(safeNext(String(form.get('next') ?? '')))
}
