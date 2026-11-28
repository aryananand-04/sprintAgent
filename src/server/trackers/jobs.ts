// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/db/database.types'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseIssueUrl } from '@/logic/github'
import { linearIdentifier } from '@/logic/linear'
import { inngest, jobsEnabled } from '@/server/inngest/client'
import { afterResponse } from '@/server/background'
import { githubConfigured } from '@/server/github/app'
import { relayAnswer as relayToGitHub, writeBack as githubWriteBack } from '@/server/github/writeback'
import { linearConfigured } from '@/server/linear/api'
import { importLinear, linearWriteBack, relayToLinear } from '@/server/linear/sync'
import type { TrackerKind } from './connections'
import { parseJiraRef } from '@/logic/jira'
import { jiraConfigured } from '@/server/jira/api'
import { importJira, jiraWriteBack, relayToJira } from '@/server/jira/sync'

type Db = SupabaseClient<Database>

export const trackersConfigured = () => githubConfigured() || linearConfigured() || jiraConfigured()

async function refOf(db: Db, ws: string, taskId: string) {
  const { data } = await db.from('tasks').select('external_ref').eq('workspace_id', ws).eq('id', taskId).maybeSingle()
  return data?.external_ref ?? null
}

/** Mirrors a task's triage onto whichever tracker it came from (each checks the workspace opted in). */
export async function writeBackTask(db: Db, ws: string, taskId: string): Promise<string> {
  const ref = await refOf(db, ws, taskId)
  if (parseIssueUrl(ref)) return githubConfigured() ? githubWriteBack(db, ws, taskId) : 'not-configured'
  if (linearIdentifier(ref)) return linearConfigured() ? linearWriteBack(db, ws, taskId) : 'not-configured'
  if (parseJiraRef(ref)) return jiraConfigured() ? jiraWriteBack(db, ws, taskId) : 'not-configured'
  return 'not-tracked'
}

/** An answer given in Slack, mirrored onto the ticket's tracker issue (write-back workspaces only). */
export async function relayAnswer(db: Db, ws: string, taskId: string, who: string, body: string): Promise<string> {
  const ref = await refOf(db, ws, taskId)
  if (parseIssueUrl(ref) && githubConfigured()) return relayToGitHub(db, ws, taskId, who, body)
  if (linearIdentifier(ref) && linearConfigured()) return relayToLinear(db, ws, taskId, who, body)
  if (parseJiraRef(ref) && jiraConfigured()) return relayToJira(db, ws, taskId, who, body)
  return 'not-tracked'
}

/**
 * Mirror triage onto trackers for these tasks: as durable, throttled jobs when Inngest is set up, else
 * after the response. Bulk imports deliberately don't call this, so connecting never spams a tracker.
 */
export async function requestWriteBack(workspaceId: string, taskIds: string[]) {
  if (!taskIds.length || !trackersConfigured()) return
  if (jobsEnabled()) {
    await inngest.send(taskIds.map((taskId) => ({ name: 'tracker/writeback.requested', data: { workspaceId, taskId } })))
    return
  }
  await afterResponse(async () => {
    const db = createAdminClient()
    for (const id of taskIds) await writeBackTask(db, workspaceId, id).catch((e) => console.error('[trackers] write-back', e instanceof Error ? e.message : e))
  })
}

/** Full import after connecting. Durable job when Inngest is set up, else right after the response. */
export async function importTracker(db: Db, ws: string, kind: TrackerKind) {
  return kind === 'linear' ? importLinear(db, ws) : importJira(db, ws)
}

export async function startTrackerImport(workspaceId: string, kind: TrackerKind) {
  if (jobsEnabled()) {
    await inngest.send({ name: 'tracker/import.requested', data: { workspaceId, kind } })
    return
  }
  await afterResponse(() => importTracker(createAdminClient(), workspaceId, kind)
    .then((r) => console.info(`[${kind}] import`, r)).catch((e) => console.error(`[${kind}] import`, e instanceof Error ? e.message : e)))
}
