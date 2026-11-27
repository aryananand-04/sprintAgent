// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import 'server-only'
import { after } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { inngest, jobsEnabled } from '@/server/inngest/client'
import { importInstallation } from './sync'
import { writeBack } from './writeback'
import { githubConfigured } from './app'

/** Imports in the background: as a durable job when Inngest is set up, else right after the response. */
export async function startImport(workspaceId: string, installationId: number) {
  if (jobsEnabled()) {
    await inngest.send({ name: 'github/import.requested', data: { workspaceId, installationId } })
    return
  }
  after(() => importInstallation(createAdminClient(), workspaceId, installationId)
    .then((r) => console.info('[github] import', r)).catch((e) => console.error('[github] import', e)))
}

/**
 * Mirror triage onto GitHub for these tasks (no-op unless the workspace enabled write-back and the
 * task came from GitHub). Bulk imports deliberately don't call this, so connecting never spams a repo.
 */
export async function requestWriteBack(workspaceId: string, taskIds: string[]) {
  if (!taskIds.length || !githubConfigured()) return
  if (jobsEnabled()) {
    await inngest.send(taskIds.map((taskId) => ({ name: 'github/writeback.requested', data: { workspaceId, taskId } })))
    return
  }
  after(async () => {
    const db = createAdminClient()
    for (const id of taskIds) await writeBack(db, workspaceId, id).catch((e) => console.error('[github] write-back', e))
  })
}
