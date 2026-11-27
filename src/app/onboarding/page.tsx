// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AuthCard } from '@/components/auth/AuthCard'
import { OnboardingForm } from './OnboardingForm'
import { getSession } from '@/lib/session'

export const metadata: Metadata = { title: 'Create your workspace · Sprint Agent' }

export default async function OnboardingPage() {
  const session = await getSession()
  if (!session) redirect('/login?next=/onboarding')

  return (
    <AuthCard title="Name your workspace" subtitle="One per team. You’ll be its admin, which mostly means you get the escalations.">
      <OnboardingForm />
    </AuthCard>
  )
}
