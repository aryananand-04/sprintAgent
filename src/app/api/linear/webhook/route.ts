// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAgentText } from '@/logic/github'
import { linearRef, type LinearIssue } from '@/logic/linear'
import { verifyLinearWebhook } from '@/server/linear/api'
import { linearRefForIssueId, syncLinearIssue } from '@/server/linear/sync'
import { connectionByExternalId, forgetConnection } from '@/server/trackers/connections'
import { taskIdForRef } from '@/server/trackers/upsert'
import { requestWriteBack } from '@/server/trackers/jobs'
import { applyAnswer } from '@/server/agent/answer'
import { afterResponse } from '@/server/background'

const Envelope = z.object({
  type: z.string(),
  action: z.string(),
  organizationId: z.string(),
  url: z.string().optional(),
  webhookTimestamp: z.number(),
  actor: z.object({ type: z.string().optional(), name: z.string().optional() }).nullable().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
})

/** Linear → us. Signature and freshness first; then the work runs after a quick 200 (Linear waits 5s). */
export async function POST(req: Request): Promise<Response> {
  const raw = await req.text()
  let json: unknown
  try { json = JSON.parse(raw) } catch { return Response.json({ error: 'BAD_JSON' }, { status: 400 }) }
  const ts = (json as { webhookTimestamp?: unknown } | null)?.webhookTimestamp
  if (!verifyLinearWebhook(raw, req.headers.get('linear-signature'), ts)) return Response.json({ error: 'BAD_SIGNATURE' }, { status: 401 })
  const p = Envelope.safeParse(json)
  if (!p.success) return Response.json({ ok: true, ignored: 'shape' })
  const { type, action, organizationId, url, actor, data } = p.data

  await afterResponse(async () => {
    const db = createAdminClient()
    const conn = await connectionByExternalId(db, 'linear', organizationId)
    if (!conn) return
    const ws = conn.workspaceId

    if (type === 'OAuthApp' && action === 'revoked') return forgetConnection(db, ws, 'linear')

    if (type === 'Issue' && data) {
      const issue = { ...data, url: (data.url as string | undefined) ?? url } as unknown as LinearIssue
      if (action === 'remove') issue.state = { type: 'canceled' } // deleted in Linear: close it here
      const result = await syncLinearIssue(db, ws, issue)
      if (result === 'created') {
        const id = await taskIdForRef(db, ws, linearRef(issue.url) ?? '')
        if (id) await requestWriteBack(ws, [id])
      }
      return
    }

    // A person replied on an ASK issue: same handling as GitHub replies and Slack answers.
    if (type === 'Comment' && action === 'create' && data && actor?.type === 'user') {
      const body = typeof data.body === 'string' ? data.body : ''
      const issueId = typeof data.issueId === 'string' ? data.issueId : null
      if (!body.trim() || isAgentText(body) || !issueId || typeof data.id !== 'string') return
      const { data: first } = await db.rpc('claim_agent_cooldown', { ws, check_key: `lin-comment-${data.id}`, cooldown_seconds: 30 * 86_400 })
      if (!first) return
      const ref = await linearRefForIssueId(db, conn, issueId)
      if (!ref) return
      const { data: row } = await db.from('tasks').select('*').eq('workspace_id', ws).eq('external_ref', ref).maybeSingle()
      if (!row || row.decision !== 'ASK' || row.status === 'done') return
      const who = actor.name ?? 'Someone'
      const out = await applyAnswer(db, ws, row, { authorName: `${who} in Linear`, body, via: 'linear', who })
      if (out.result === 'retriaged') await requestWriteBack(ws, [out.taskId])
    }
  })
  return Response.json({ ok: true })
}
