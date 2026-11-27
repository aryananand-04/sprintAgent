// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import 'server-only'
import { inngest } from './client'
import { createAdminClient } from '@/lib/supabase/admin'
import { activeWorkspaceIds, runAgentTick } from '@/server/agent/runTick'
import { deliverDue } from '@/server/outbox'

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

export const functions = [scheduleAgentTicks, agentTick, deliverOutbox]
