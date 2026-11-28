// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { after } from 'next/server'
import { getSession } from '@/lib/session'
import { can } from '@/lib/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import { siteOrigin } from '@/lib/origin'
import { OutboxEvent, enqueue, deliverDue } from '@/server/outbox'
import { createRateLimiter } from '@/server/rateLimit'
import { inngest, jobsEnabled } from '@/server/inngest/client'

const limit = createRateLimiter({ limit: 60, windowMs: 60_000 })

/** Queue an event for the workspace's integrations, then try to deliver straight away (after the response). */
export async function POST(req: Request): Promise<Response> {
  const session = await getSession()
  if (!session?.current) return Response.json({ error: 'UNAUTHENTICATED' }, { status: 401 })
  if (!can(session.current.role, 'task:create')) return Response.json({ error: 'FORBIDDEN' }, { status: 403 })
  if (!limit(session.user.id).ok) return Response.json({ error: 'RATE_LIMITED' }, { status: 429 })

  const parsed = OutboxEvent.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'INVALID_REQUEST' }, { status: 400 })
  // The standup and the weekly digest are written and sent by the server agent; browsers can't post them.
  if (parsed.data.type === 'standup' || parsed.data.type === 'digest') return Response.json({ error: 'SERVER_ONLY' }, { status: 400 })

  const ws = session.current.workspace.id
  const db = createAdminClient()


  const queued = await enqueue(db, ws, parsed.data, `${await siteOrigin()}/app`).catch(() => -1)
  if (queued < 0) return Response.json({ error: 'WRITE_FAILED' }, { status: 500 })
  if (queued) {
    // With a job runner, delivery is durable and retried there; without one, try once after responding.
    if (jobsEnabled()) await inngest.send({ name: 'outbox/enqueued', data: { workspaceId: ws } }).catch((e) => console.error('[outbox] event', e))
    else after(() => deliverDue(db, { workspaceId: ws }).catch((e) => console.error('[outbox] deliver', e)))
  }
  return Response.json({ queued })
}
