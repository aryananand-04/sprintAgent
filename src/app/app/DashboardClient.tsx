// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { useSprintStore, type WorkspaceSnapshot } from '@/store/useSprintStore'
import { createClient } from '@/lib/supabase/client'
import { startSync } from '@/lib/data/sync'
import { useSession } from '@/components/auth/SessionProvider'
import { refreshWorkspace } from './actions'

// Client-only: the dashboard reads browser APIs (localStorage, matchMedia) during render.
const DashboardApp = dynamic(() => import('../../components/dashboard/DashboardApp'), { ssr: false })

export function DashboardClient({ snapshot }: { snapshot: WorkspaceSnapshot }) {
  const { user, current } = useSession()
  // Hydrate once, synchronously, before the dashboard's first render (remounted per workspace via key).
  useState(() => { useSprintStore.getState().hydrate(snapshot); return true })

  useEffect(() => {
    try { localStorage.removeItem('sprint-agent-v17') } catch { /* legacy local-only data */ }
    return startSync({
      supabase: createClient(),
      workspaceId: snapshot.workspaceId,
      userId: user.id,
      role: current.role,
      refresh: refreshWorkspace,
    })
  }, [snapshot.workspaceId, user.id, current.role])

  return <DashboardApp />
}
