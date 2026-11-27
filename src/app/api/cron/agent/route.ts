// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { createAdminClient } from '@/lib/supabase/admin'
import { cronAuthorized } from '@/server/cronAuth'
import { activeWorkspaceIds, runAgentTick } from '@/server/agent/runTick'

/** Runs the agent's periodic checks for every active workspace. Called by the scheduler. */
export async function GET(req: Request): Promise<Response> {
  if (!cronAuthorized(req)) return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const db = createAdminClient()
  const results = []
  for (const ws of await activeWorkspaceIds(db)) {
    results.push(await runAgentTick(db, ws).catch((e) => ({ workspaceId: ws, error: e instanceof Error ? e.message : String(e) })))
  }
  return Response.json({ results })
}
