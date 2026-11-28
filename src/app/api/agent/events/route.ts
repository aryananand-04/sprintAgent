// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { can, type Role } from '@/lib/permissions'
import { requestWriteBack } from '@/server/trackers/jobs'

const Decision = z.enum(['ACT', 'ASK', 'ESCALATE'])
const Counts = z.object({ correct: z.number().int().min(0), total: z.number().int().min(0) })
  .refine((c) => c.correct <= c.total, 'correct must not exceed total')

const Body = z.object({
  workspaceId: z.guid(),
  decisions: z.array(z.object({
    taskId: z.guid().nullable(),
    kind: z.enum(['triage', 'assign', 'rebalance', 'escalate', 'ad-hoc']),
    source: z.enum(['ai', 'rules']),
    decision: Decision.nullable(),
    rationale: z.string().min(1).max(2_000),
    payload: z.record(z.string(), z.unknown()).default({}),
  })).max(50).default([]),
  calibration: z.object({ ACT: Counts, ASK: Counts, ESCALATE: Counts }).optional(),
  policyTune: z.object({ actMinClarity: z.number().int().min(1).max(5) }).optional(),
})

/**
 * Agent writes that users can't make directly under RLS (decision log, calibration, self-tuning).
 * Contributors+ may log decisions their client made; PM+ may update calibration and self-tune ±1.
 */
export async function POST(req: Request): Promise<Response> {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getClaims()
  const userId = auth?.claims?.sub
  if (!userId) return Response.json({ error: 'UNAUTHENTICATED' }, { status: 401 })

  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'INVALID_REQUEST' }, { status: 400 })
  const { workspaceId, decisions, calibration, policyTune } = parsed.data

  // Role is read through RLS with the caller's own session.
  const { data: member } = await supabase.from('workspace_members').select('role')
    .eq('workspace_id', workspaceId).eq('user_id', userId).maybeSingle()
  const role = (member?.role ?? null) as Role | null
  if (!can(role, 'task:create')) return Response.json({ error: 'FORBIDDEN' }, { status: 403 })
  if ((calibration || policyTune) && !can(role, 'task:manage')) return Response.json({ error: 'FORBIDDEN' }, { status: 403 })

  const admin = createAdminClient()

  if (decisions.length) {
    const { error } = await admin.from('decisions').insert(decisions.map((d) => ({
      workspace_id: workspaceId,
      task_id: d.taskId,
      kind: d.kind,
      source: d.source,
      decision: d.decision,
      rationale: d.rationale,
      payload: d.payload as never,
      actor_id: userId,
    })))
    if (error) return Response.json({ error: 'WRITE_FAILED' }, { status: 409 })
    // Triage made in the app is mirrored to GitHub issues (if the workspace opted in).
    const triaged = [...new Set(decisions.filter((d) => d.kind === 'triage' && d.taskId).map((d) => d.taskId as string))]
    await requestWriteBack(workspaceId, triaged).catch((e) => console.error('[trackers] write-back request', e))
  }

  if (calibration) {
    // Counters only move forward; a stale client can't reset them.
    const { data: current } = await admin.from('calibration').select('decision, correct, total').eq('workspace_id', workspaceId)
    const rows = (['ACT', 'ASK', 'ESCALATE'] as const).map((d) => {
      const cur = current?.find((c) => c.decision === d) ?? { correct: 0, total: 0 }
      const total = Math.max(cur.total, calibration[d].total)
      return { workspace_id: workspaceId, decision: d, total, correct: Math.min(total, Math.max(cur.correct, calibration[d].correct)) }
    })
    const { error } = await admin.from('calibration').upsert(rows, { onConflict: 'workspace_id,decision' })
    if (error) return Response.json({ error: 'WRITE_FAILED' }, { status: 409 })
  }

  if (policyTune) {
    const { data: policy } = await admin.from('autonomy_policies').select('act_min_clarity, ask_max_clarity')
      .eq('workspace_id', workspaceId).single()
    const delta = policy ? Math.abs(policyTune.actMinClarity - policy.act_min_clarity) : 99
    if (!policy || delta > 1 || policyTune.actMinClarity <= policy.ask_max_clarity) {
      return Response.json({ error: 'TUNE_OUT_OF_RANGE' }, { status: 422 })
    }
    if (delta === 1) {
      const { error } = await admin.from('autonomy_policies').update({ act_min_clarity: policyTune.actMinClarity })
        .eq('workspace_id', workspaceId)
      if (error) return Response.json({ error: 'WRITE_FAILED' }, { status: 409 })
      await admin.from('decisions').insert({
        workspace_id: workspaceId, kind: 'override', source: 'rules', decision: null, actor_id: userId,
        rationale: `Self-tuned ACT clarity threshold ${policy.act_min_clarity} → ${policyTune.actMinClarity} from calibration.`,
      })
    }
  }

  return Response.json({ ok: true })
}
