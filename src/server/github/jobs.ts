// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import 'server-only'
import { after } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { inngest, jobsEnabled } from '@/server/inngest/client'
import { importInstallation } from './sync'

/** Imports in the background: as a durable job when Inngest is set up, else right after the response. */
export async function startImport(workspaceId: string, installationId: number) {
  if (jobsEnabled()) {
    await inngest.send({ name: 'github/import.requested', data: { workspaceId, installationId } })
    return
  }
  after(() => importInstallation(createAdminClient(), workspaceId, installationId)
    .then((r) => console.info('[github] import', r)).catch((e) => console.error('[github] import', e)))
}
