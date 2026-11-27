'use server'

import { getSession } from '@/lib/session'
import { loadWorkspace } from '@/lib/data/loadWorkspace'

/** Re-reads the workspace after a rejected write or a sprint rollover. */
export async function refreshWorkspace(workspaceId: string) {
  const session = await getSession()
  if (!session?.memberships.some((m) => m.workspace.id === workspaceId)) return null
  return loadWorkspace(workspaceId)
}
