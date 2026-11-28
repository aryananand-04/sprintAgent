// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/db/database.types'
import type { TaskType } from '@/types'
import {
  ACTIONS, DEFAULT_LEVEL, LEVEL_NAMES, TASK_TYPES, UNDO_WINDOW_HOURS, evaluateLicense, levelFor,
  type Level, type LicensedAction,
} from '@/logic/earnedAutonomy'

type Db = SupabaseClient<Database>

export interface License { taskType: TaskType; action: LicensedAction; earned: Level; cap: Level; effective: Level }

export async function loadLicenses(db: Db, ws: string): Promise<License[]> {
  const { data } = await db.from('autonomy_licenses').select('task_type, action, earned_level, cap').eq('workspace_id', ws)
  return (data ?? []).map((r) => ({
    taskType: r.task_type, action: r.action, earned: r.earned_level as Level, cap: r.cap as Level,
    effective: Math.min(r.earned_level, r.cap) as Level,
  }))
}

export const licenseLevel = (licenses: License[], taskType: TaskType, action: LicensedAction) => levelFor(licenses, taskType, action)

export interface PredictionInput {
  taskId: string
  taskType: TaskType
  action: LicensedAction
  level: Level
  predictedMemberId: string
  previousMemberId?: string | null
  confidence?: number | null
  rationale: string
}

/**
 * Records what the agent would do (L0/L1: shadow) or did (L2/L3: acted). One open prediction per task
 * and action: a newer one replaces an older one (which then doesn't count).
 */
export async function recordPrediction(db: Db, ws: string, p: PredictionInput, now = new Date()) {
  await db.from('predictions').update({ outcome: 'expired', resolved_at: now.toISOString() })
    .eq('task_id', p.taskId).eq('action', p.action).is('outcome', null)
  const acted = p.level >= 2
  const { error } = await db.from('predictions').insert({
    workspace_id: ws, task_id: p.taskId, task_type: p.taskType, action: p.action, mode: acted ? 'acted' : 'shadow',
    predicted_member_id: p.predictedMemberId, previous_member_id: p.previousMemberId ?? null,
    confidence: p.confidence ?? null, rationale: p.rationale.slice(0, 1_000),
    undo_until: p.level === 2 ? new Date(now.getTime() + UNDO_WINDOW_HOURS * 3_600_000).toISOString() : null,
  })
  if (error) throw error
}

/** Shadow predictions nobody acted on in two weeks say nothing either way. */
export const SHADOW_TTL_DAYS = 14

export async function expireStalePredictions(db: Db, ws: string, now = new Date()) {
  await db.from('predictions').update({ outcome: 'expired', resolved_at: now.toISOString() })
    .eq('workspace_id', ws).eq('mode', 'shadow').is('outcome', null)
    .lt('created_at', new Date(now.getTime() - SHADOW_TTL_DAYS * 86_400_000).toISOString())
}

/**
 * Re-evaluates every licence from its evidence. A level change is written to the decision log (the
 * trust ledger) and the feed, with the numbers behind it. Returns the changes.
 */
export async function recomputeLicenses(db: Db, ws: string, now = new Date()) {
  const [{ data: rows }, { data: existing }] = await Promise.all([
    db.from('predictions').select('task_type, action, outcome, resolved_at').eq('workspace_id', ws).in('outcome', ['agree', 'disagree']),
    db.from('autonomy_licenses').select('*').eq('workspace_id', ws),
  ])
  const changes: Array<{ taskType: TaskType; action: LicensedAction; from: Level; to: Level; reason: string }> = []

  for (const taskType of TASK_TYPES) {
    for (const action of Object.keys(ACTIONS) as LicensedAction[]) {
      const outcomes = (rows ?? []).filter((r) => r.task_type === taskType && r.action === action)
        .map((r) => ({ agree: r.outcome === 'agree', at: r.resolved_at ?? '' }))
      const cur = existing?.find((l) => l.task_type === taskType && l.action === action)
      if (!cur && !outcomes.length) continue // nothing to say yet; the default applies
      const from = (cur?.earned_level ?? DEFAULT_LEVEL) as Level
      const e = evaluateLicense({ action, earned: from, cap: (cur?.cap ?? 3) as Level, outcomes })
      const same = cur && cur.earned_level === e.earned && cur.n === e.n && cur.agree === e.agree && cur.reason === e.reason
      if (same) continue
      await db.from('autonomy_licenses').upsert({
        workspace_id: ws, task_type: taskType, action, earned_level: e.earned, n: e.n, agree: e.agree,
        lower_bound: e.lower, reason: e.reason, ...(e.change && { changed_at: now.toISOString() }),
      }, { onConflict: 'workspace_id,task_type,action' })
      if (e.change) changes.push({ taskType, action, from, to: e.earned, reason: e.reason })
    }
  }

  for (const c of changes) {
    const what = `${c.taskType} ${ACTIONS[c.action].label.toLowerCase()}`
    const message = c.to > c.from
      ? `Earned “${LEVEL_NAMES[c.to]}” for ${what}. ${c.reason}`
      : `Back to “${LEVEL_NAMES[c.to]}” for ${what}. ${c.reason}`
    await db.from('decisions').insert({ workspace_id: ws, kind: 'license', source: 'rules', decision: null, rationale: message, payload: { taskType: c.taskType, action: c.action, from: c.from, to: c.to } })
    await db.from('feed_events').insert({ workspace_id: ws, type: c.to > c.from ? 'status' : 'risk', message })
  }
  return changes
}
