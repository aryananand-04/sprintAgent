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
    <AuthCard title="Create your workspace" subtitle="One workspace per team. You'll be its admin and can invite people next.">
      <OnboardingForm />
    </AuthCard>
  )
}
