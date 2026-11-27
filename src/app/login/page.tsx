// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AuthCard } from '@/components/auth/AuthCard'
import { LoginForm } from './LoginForm'
import { enabledProviders, getSession, passwordLoginEnabled } from '@/lib/session'
import { safeNext } from '@/lib/safeNext'

export const metadata: Metadata = { title: 'Sign in · Sprint Agent' }

const ERRORS: Record<string, string> = {
  link: 'That sign-in link is invalid or has expired. Request a new one.',
  provider: 'That sign-in method is not available right now.',
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams
  const next = safeNext(params.next)
  if (await getSession()) redirect(next)

  return (
    <AuthCard title="Sign in" subtitle="Pick up where the sprint left off.">
      {params.error && ERRORS[params.error] && (
        <p role="alert" className="mb-6 rounded-lg border border-esc-accent/30 bg-esc-tint px-3 py-2 text-xs text-esc-accent">
          {ERRORS[params.error]}
        </p>
      )}
      <LoginForm next={next} providers={enabledProviders()} passwordEnabled={passwordLoginEnabled()} />
    </AuthCard>
  )
}
