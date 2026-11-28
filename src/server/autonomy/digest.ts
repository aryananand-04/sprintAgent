// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/db/database.types'
import { shadowDigest, type DigestPrediction } from '@/logic/shadowDigest'
import { weeklyDue } from '@/logic/standup'
import type { Level } from '@/logic/earnedAutonomy'
import { enqueue } from '@/server/outbox'

type Db = SupabaseClient<Database>
export type DigestResult = 'not-due' | 'already' | 'empty' | 'no-integration' | 'sent'

/**
 * Monday morning (workspace time), once a week: how the agent's predictions compared with what people
 * did over the last seven days, per kind of work, and how far each licence is from the next level.
 */
export async function sendWeeklyDigest(db: Db, ws: string, now = new Date()): Promise<DigestResult> {
  const { data: w } = await db.from('workspaces').select('timezone').eq('id', ws).single()
  const { due, week } = weeklyDue(now, w?.timezone ?? 'UTC')
  if (!due) return 'not-due'
  const { data: first, error } = await db.rpc('claim_agent_cooldown', { ws, check_key: `digest-${week}`, cooldown_seconds: 8 * 86_400 })
  if (error) throw error
  if (!first) return 'already'

  const since = new Date(now.getTime() - 7 * 86_400_000).toISOString()
  const [{ data: preds }, { data: licenses }, { data: team }] = await Promise.all([
    db.from('predictions').select('task_type, action, outcome, predicted_member_id, actual_member_id, tasks(title)')
      .eq('workspace_id', ws).in('outcome', ['agree', 'disagree']).gte('resolved_at', since),
    db.from('autonomy_licenses').select('task_type, action, earned_level, cap, n, agree').eq('workspace_id', ws),
    db.from('team_members').select('id, name').eq('workspace_id', ws),
  ])
  const name = (id: string | null) => (id ? team?.find((m) => m.id === id)?.name ?? null : null)
  const week7: DigestPrediction[] = (preds ?? []).map((p) => ({
    taskType: p.task_type, action: p.action, agree: p.outcome === 'agree',
    taskTitle: (p.tasks as { title?: string } | null)?.title ?? 'a task',
    predictedName: name(p.predicted_member_id), actualName: name(p.actual_member_id),
  }))
  const text = shadowDigest(week7, (licenses ?? []).map((l) => ({ taskType: l.task_type, action: l.action, earned: l.earned_level as Level, cap: l.cap as Level, n: l.n, agree: l.agree })))
  if (!text) return 'empty'
  const queued = await enqueue(db, ws, { type: 'digest', text }).catch(async (e) => {
    await db.from('agent_cooldowns').delete().eq('workspace_id', ws).eq('key', `digest-${week}`) // retry next tick
    throw e
  })
  if (!queued) return 'no-integration'
  await db.from('feed_events').insert({ workspace_id: ws, type: 'status', message: 'Sent the weekly “what I would’ve done” digest.' })
  return 'sent'
}
