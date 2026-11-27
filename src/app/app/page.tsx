import type { Metadata } from 'next'
import { DashboardClient } from './DashboardClient'

export const metadata: Metadata = { title: 'Dashboard · Sprint Agent' }

export default function AppPage() {
  return <DashboardClient />
}
