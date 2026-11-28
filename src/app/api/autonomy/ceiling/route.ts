// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { z } from 'zod'
import { getSession } from '@/lib/session'
import { createAdminClient } from '@/lib/supabase/admin'
import { ACTIONS, LEVEL_NAMES, TASK_TYPES, type Level, type LicensedAction } from '@/logic/earnedAutonomy'
import { ENTITLEMENTS, PLAN_NAMES, planWith } from '@/logic/billing'
import { getPlan } from '@/server/billing/plan'
import type { TaskType } from '@/types'

const Body = z.object({
  cap: z.number().int().min(0).max(3),
  taskType: z.enum(TASK_TYPES as [TaskType, ...TaskType[]]).optional(),
  action: z.enum(Object.keys(ACTIONS) as [LicensedAction, ...LicensedAction[]]).optional(),
}).refine((b) => (b.taskType === undefined) === (b.action === undefined), 'taskType and action go together')

/**
 * Admin sets the agent's ceiling. One ceiling for everything is on every plan: restraining the agent
 * never costs extra. A ceiling per task type and action is a Business feature. Earned levels are
 * untouched either way, and every change is written to the decision log.
 */
export async function POST(req: Request): Promise<Response> {
  const session = await getSession()
  if (!session?.current) return Response.json({ error: 'UNAUTHENTICATED' }, { status: 401 })
  if (session.current.role !== 'admin') return Response.json({ error: 'FORBIDDEN' }, { status: 403 })
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'INVALID_REQUEST' }, { status: 400 })
  const { cap, taskType, action } = parsed.data
  const db = createAdminClient()
  const ws = session.current.workspace.id

  if (taskType && !ENTITLEMENTS[await getPlan(db, ws)].perTypePolicy) {
    return Response.json({ error: 'PLAN_REQUIRED', plan: planWith('perTypePolicy'), message: `A ceiling per kind of work is on ${PLAN_NAMES[planWith('perTypePolicy')]}. One ceiling for everything is on every plan.` }, { status: 402 })
  }
  const targets = taskType && action ? [{ taskType, action }]
    : TASK_TYPES.flatMap((t) => (Object.keys(ACTIONS) as LicensedAction[]).map((a) => ({ taskType: t, action: a })))
  // Rows that don't exist yet start at the default earned level; only the ceiling is written here.
  const { error } = await db.from('autonomy_licenses').upsert(
    targets.map((t) => ({ workspace_id: ws, task_type: t.taskType, action: t.action, cap })),
    { onConflict: 'workspace_id,task_type,action', ignoreDuplicates: false },
  )
  if (error) return Response.json({ error: 'WRITE_FAILED' }, { status: 500 })

  const scope = taskType && action ? `${taskType} ${ACTIONS[action].label.toLowerCase()}` : 'all work'
  const message = `Ceiling for ${scope} set to “${LEVEL_NAMES[cap as Level]}” by ${session.user.name}.`
  await db.from('decisions').insert({ workspace_id: ws, kind: 'license', source: 'human', decision: null, rationale: message, actor_id: session.user.id, payload: { cap, taskType: taskType ?? null, action: action ?? null } })
  await db.from('feed_events').insert({ workspace_id: ws, type: 'status', message })
  return Response.json({ ok: true, cap, scope: taskType ? 'one' : 'all' })
}
