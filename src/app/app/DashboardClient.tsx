'use client'

import dynamic from 'next/dynamic'

// Client-only until P1d: the store hydrates from localStorage.
const DashboardApp = dynamic(() => import('../../DashboardApp'), { ssr: false })

export function DashboardClient() {
  return <DashboardApp />
}
