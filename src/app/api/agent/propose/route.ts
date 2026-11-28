// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { z } from 'zod'
import { getSession } from '@/lib/session'
import { can } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createRateLimiter } from '@/server/rateLimit'
import { proposeAssignment } from '@/server/autonomy/propose'

const limit = createRateLimiter({ limit: 30, windowMs: 60_000 })
const Body = z.object({ taskId: z.guid() })

/** After someone files work in the app: let the agent assign or suggest an owner, within its licence. */
export async function POST(req: Request): Promise<Response> {
  const session = await getSession()
  if (!session?.current) return Response.json({ error: 'UNAUTHENTICATED' }, { status: 401 })
  if (!can(session.current.role, 'task:create')) return Response.json({ error: 'FORBIDDEN' }, { status: 403 })
  if (!limit(session.user.id).ok) return Response.json({ error: 'RATE_LIMITED' }, { status: 429 })
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'INVALID_REQUEST' }, { status: 400 })
  const ws = session.current.workspace.id
  // The caller must be able to see the task (RLS) before the agent looks at it with the service key.
  const { data: visible } = await (await createClient()).from('tasks').select('id').eq('id', parsed.data.taskId).eq('workspace_id', ws).maybeSingle()
  if (!visible) return Response.json({ error: 'NOT_FOUND' }, { status: 404 })
  return Response.json(await proposeAssignment(createAdminClient(), ws, parsed.data.taskId))
}
