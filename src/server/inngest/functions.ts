// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import 'server-only'
import { inngest } from './client'
import { createAdminClient } from '@/lib/supabase/admin'
import { activeWorkspaceIds, runAgentTick } from '@/server/agent/runTick'
import { deliverDue } from '@/server/outbox'
import { importInstallation } from '@/server/github/sync'
import { importTracker, writeBackTask } from '@/server/trackers/jobs'
import type { TrackerKind } from '@/server/trackers/connections'

/** Every 5 minutes: one agent tick per active workspace, fanned out as events. */
export const scheduleAgentTicks = inngest.createFunction(
  { id: 'schedule-agent-ticks', triggers: [{ cron: '*/5 * * * *' }] },
  async ({ step }) => {
    const ids = await step.run('list-workspaces', () => activeWorkspaceIds(createAdminClient()))
    if (ids.length) await step.sendEvent('fan-out', ids.map((workspaceId) => ({ name: 'agent/tick.requested', data: { workspaceId } })))
    return { workspaces: ids.length }
  },
)

/** One workspace's tick. Never two at once per workspace; retried with backoff on failure. */
export const agentTick = inngest.createFunction(
  {
    id: 'agent-tick',
    triggers: [{ event: 'agent/tick.requested' }],
    concurrency: { key: 'event.data.workspaceId', limit: 1 },
    retries: 3,
  },
  async ({ event, step }) => {
    const workspaceId = String((event.data as { workspaceId?: string }).workspaceId ?? '')
    if (!workspaceId) return { skipped: 'no workspace' }
    return step.run('tick', () => runAgentTick(createAdminClient(), workspaceId))
  },
)

/** Delivers queued webhooks: right after something is queued, and every 2 minutes for retries. */
export const deliverOutbox = inngest.createFunction(
  {
    id: 'deliver-outbox',
    triggers: [{ event: 'outbox/enqueued' }, { cron: '*/2 * * * *' }],
    concurrency: { limit: 1 },
    retries: 2,
  },
  async ({ step }) => step.run('deliver', () => deliverDue(createAdminClient(), { limit: 100 })),
)

/** Full GitHub import after an install. One at a time per workspace; retried on GitHub hiccups. */
export const githubImport = inngest.createFunction(
  { id: 'github-import', triggers: [{ event: 'github/import.requested' }], concurrency: { key: 'event.data.workspaceId', limit: 1 }, retries: 3 },
  async ({ event, step }) => {
    const { workspaceId, installationId } = event.data as { workspaceId: string; installationId: number }
    return step.run('import', () => importInstallation(createAdminClient(), workspaceId, installationId))
  },
)

/** Labels/comments on GitHub, Linear or Jira. Serialised per workspace and throttled well inside their limits. */
export const trackerWriteBack = inngest.createFunction(
  {
    id: 'tracker-writeback',
    triggers: [{ event: 'tracker/writeback.requested' }],
    concurrency: { key: 'event.data.workspaceId', limit: 1 },
    throttle: { key: 'event.data.workspaceId', limit: 60, period: '1m' },
    retries: 4,
  },
  async ({ event, step }) => {
    const { workspaceId, taskId } = event.data as { workspaceId: string; taskId: string }
    return step.run('write-back', () => writeBackTask(createAdminClient(), workspaceId, taskId))
  },
)

/** Full Linear/Jira import after connecting. One at a time per workspace; retried on API hiccups. */
export const trackerImport = inngest.createFunction(
  { id: 'tracker-import', triggers: [{ event: 'tracker/import.requested' }], concurrency: { key: 'event.data.workspaceId', limit: 1 }, retries: 3 },
  async ({ event, step }) => {
    const { workspaceId, kind } = event.data as { workspaceId: string; kind: TrackerKind }
    return step.run('import', () => importTracker(createAdminClient(), workspaceId, kind))
  },
)

export const functions = [scheduleAgentTicks, agentTick, deliverOutbox, githubImport, trackerWriteBack, trackerImport]
