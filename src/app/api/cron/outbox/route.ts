// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { createAdminClient } from '@/lib/supabase/admin'
import { cronAuthorized } from '@/server/cronAuth'
import { deliverDue } from '@/server/outbox'

/** Retries due deliveries. Called by the scheduler with `Authorization: Bearer $CRON_SECRET`. */
export async function GET(req: Request): Promise<Response> {
  if (!cronAuthorized(req)) return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  return Response.json(await deliverDue(createAdminClient(), { limit: 100 }))
}
