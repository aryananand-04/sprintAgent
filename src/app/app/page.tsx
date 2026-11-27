import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { DashboardClient } from './DashboardClient'
import { SessionProvider } from '@/components/auth/SessionProvider'
import { getSession } from '@/lib/session'

export const metadata: Metadata = { title: 'Dashboard · Sprint Agent' }

export default async function AppPage() {
  const session = await getSession()
  if (!session) redirect('/login?next=/app')
  if (!session.current) redirect('/onboarding')

  return (
    <SessionProvider value={{ user: session.user, current: session.current, memberships: session.memberships }}>
      <DashboardClient />
    </SessionProvider>
  )
}
