// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/db/database.types'
import type { AutonomyConfig, Task, TeamMember, TriageAudit } from '@/types'
import { triageTask } from '@/logic/triage'
import { needsTriage, planTriageSteps, triageSummary, type TriageOutcome } from '@/logic/backlogTriage'
import { TriageRequest, runTriage } from '@/server/ai/triage'
import { groqCompleter, type Completer } from '@/server/llm'
import { enqueue } from '@/server/outbox'
import { requestWriteBack } from '@/server/trackers/jobs'

type Db = SupabaseClient<Database>

/** Per tick, so a big untriaged backlog drains over a few ticks instead of one long burst of model calls. */
export const TRIAGE_PER_TICK = 10
/** A claimed task isn't retried for this long if the run dies half-way. */
const CLAIM_SECONDS = 6 * 3600

export interface BacklogOptions { apiKey?: string; complete?: Completer; max?: number; /** Only these task ids (e.g. one just filed from Slack). */ only?: string[] }

type Outcome = TriageOutcome & { source: 'ai' | 'rules'; audit?: TriageAudit }

/** Model first when configured (bounded by the rules), rules alone otherwise or on any failure. */
async function decide(task: Task, config: AutonomyConfig, apiKey: string | undefined, complete: Completer): Promise<Outcome> {
  if (apiKey) {
    const req = TriageRequest.safeParse({ task, config })
    if (req.success) {
      try {
        const r = await runTriage(req.data, apiKey, complete)
        return { decision: r.decision, reason: r.reason, score: r.score, source: 'ai', audit: { ai: r.ai, rules: r.rules, disagreed: r.disagreed, overruled: r.overruled, suspicious: r.suspicious } }
      } catch { /* fall through to rules */ }
    }
  }
  const r = triageTask(task, config)
  return { decision: r.decision, reason: r.reason, score: r.score, source: 'rules' }
}

/**
 * Triages backlog tickets nobody has triaged yet, then follows through like the app does: ACT gets
 * an owner, ESCALATE goes to the PM. Each ticket is claimed first, so concurrent runners split work.
 */
export async function triageBacklog(
  db: Db, ws: string, snap: { tasks: Task[]; team: TeamMember[]; autonomyConfig: AutonomyConfig },
  { apiKey = process.env.GROQ_API_KEY, complete = groqCompleter, max = TRIAGE_PER_TICK, only }: BacklogOptions = {},
): Promise<number> {
  const claimed: Task[] = []
  for (const task of snap.tasks.filter((t) => needsTriage(t) && (!only || only.includes(t.id)))) {
    if (claimed.length >= max) break
    const { data: ok, error } = await db.rpc('claim_agent_cooldown', { ws, check_key: `triage-${task.id}`, cooldown_seconds: CLAIM_SECONDS })
    if (error) throw error
    if (ok) claimed.push(task)
  }
  if (!claimed.length) return 0

  const outcomes: Array<{ task: Task; outcome: Outcome }> = []
  for (const task of claimed) outcomes.push({ task, outcome: await decide(task, snap.autonomyConfig, apiKey, complete) })
  const steps = planTriageSteps(outcomes, snap.tasks, snap.team)

  const applied: typeof steps = []
  const feed = (row: Omit<Database['public']['Tables']['feed_events']['Insert'], 'workspace_id'>) => db.from('feed_events').insert({ workspace_id: ws, ...row })
  for (const [i, step] of steps.entries()) {
    const { task, outcome } = outcomes[i]
    const { decision, reason, score } = step.outcome
    const assigned = step.assign
    // Only if still untriaged: a person may have triaged it while the model was thinking.
    const { data: updated, error } = await db.from('tasks').update({
      decision, decision_reason: assigned?.rationale ?? reason, triage_score: score, is_ai_triaged: outcome.source === 'ai',
      status: assigned ? 'assigned' : task.status === 'backlog' ? 'triaged' : task.status,
      ...(assigned && { assignee_id: assigned.memberId, confidence: assigned.confidence }),
    }).eq('id', task.id).eq('workspace_id', ws).is('decision', null).select('id')
    if (error) throw error
    if (!updated?.length) continue
    applied.push(step)

    await db.from('decisions').insert({
      workspace_id: ws, task_id: task.id, kind: 'triage', source: outcome.source, decision, rationale: reason,
      payload: { runner: 'server', score, ...(outcome.audit && { audit: outcome.audit }) } as never,
    })
    if (outcome.audit?.overruled) await feed({ type: 'triage', task_id: task.id, decision, message: `Triaged "${task.title}" → ${decision}. The model wanted ${outcome.audit.ai}; the rules said no.` })

    if (assigned) {
      await feed({ type: 'assign', message: assigned.rationale, task_id: task.id, member_id: assigned.memberId, decision: 'ACT' })
      await db.from('decisions').insert({ workspace_id: ws, task_id: task.id, kind: 'assign', source: 'rules', decision: 'ACT', rationale: assigned.rationale, payload: { runner: 'server', to: assigned.memberId, confidence: assigned.confidence } })
      await enqueue(db, ws, { type: 'decision', taskTitle: task.title, decision: 'ACT', reason: assigned.rationale }).catch(() => 0)
    }
    if (step.escalation) {
      const { count } = await db.from('escalations').select('id', { count: 'exact', head: true }).eq('workspace_id', ws).eq('task_id', task.id).is('resolved_at', null)
      if (!count) {
        const { data: created } = await db.from('escalations').insert({ workspace_id: ws, task_id: task.id, task_title: task.title, reason, recommendation: step.escalation.recommendation, urgency: task.urgency, category: step.escalation.category }).select('id').single()
        await feed({ type: 'escalate', message: reason, task_id: task.id, decision: 'ESCALATE' })
        await enqueue(db, ws, { type: 'escalation', taskTitle: task.title, reason, recommendation: step.escalation.recommendation, urgency: task.urgency, escalationId: created?.id }).catch(() => 0)
      }
    }
  }

  const summary = triageSummary(applied)
  if (summary) await feed({ type: 'status', message: summary })
  await requestWriteBack(ws, applied.map((s) => s.taskId)).catch((e) => console.error('[trackers] write-back request', e))
  return applied.length
}
