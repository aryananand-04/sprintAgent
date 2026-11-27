// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { DashboardClient } from './DashboardClient'
import { SessionProvider } from '@/components/auth/SessionProvider'
import { getSession } from '@/lib/session'
import { loadWorkspace } from '@/lib/data/loadWorkspace'

export const metadata: Metadata = { title: 'Dashboard · Sprint Agent' }

export default async function AppPage() {
  const session = await getSession()
  if (!session) redirect('/login?next=/app')
  if (!session.current) redirect('/onboarding')

  const snapshot = await loadWorkspace(session.current.workspace.id)
  if (!snapshot) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background p-6 text-sm text-muted-foreground">
        This workspace has no active sprint yet. Ask a PM to start one.
      </main>
    )
  }

  return (
    <SessionProvider value={{ user: session.user, current: session.current, memberships: session.memberships }}>
      <DashboardClient key={snapshot.workspaceId} snapshot={snapshot} />
    </SessionProvider>
  )
}
