'use client'

import { createContext, useContext } from 'react'
import { can, type Permission } from '@/lib/permissions'
import type { Membership, SessionUser } from '@/lib/session'

export interface ClientSession {
  user: SessionUser
  current: Membership
  memberships: Membership[]
}

const SessionContext = createContext<ClientSession | null>(null)

export function SessionProvider({ value, children }: { value: ClientSession; children: React.ReactNode }) {
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): ClientSession {
  const s = useContext(SessionContext)
  if (!s) throw new Error('useSession must be used inside <SessionProvider>')
  return s
}

export function useCan(p: Permission): boolean {
  return can(useSession().current.role, p)
}
