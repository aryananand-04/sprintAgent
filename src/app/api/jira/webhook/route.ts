// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAgentText } from '@/logic/github'
import { adfToText, jiraRef, type JiraIssue } from '@/logic/jira'
import { verifyJiraWebhook } from '@/server/jira/api'
import { syncJiraIssue } from '@/server/jira/sync'
import { taskIdForRef } from '@/server/trackers/upsert'
import { requestWriteBack } from '@/server/trackers/jobs'
import { applyAnswer } from '@/server/agent/answer'
import { afterResponse } from '@/server/background'
import type { Connection } from '@/server/trackers/connections'

const Payload = z.object({
  webhookEvent: z.string(),
  matchedWebhookIds: z.array(z.number()).min(1),
  issue: z.object({ id: z.string(), key: z.string(), fields: z.record(z.string(), z.unknown()) }).optional(),
  comment: z.object({
    id: z.string(),
    body: z.unknown(),
    author: z.object({ accountType: z.string().optional(), displayName: z.string().optional() }).optional(),
  }).optional(),
})

/** Jira → us. JWT first; the matched webhook id tells us which workspace; work runs after a quick 200. */
export async function POST(req: Request): Promise<Response> {
  if (!verifyJiraWebhook(req.headers.get('authorization'))) return Response.json({ error: 'BAD_SIGNATURE' }, { status: 401 })
  const p = Payload.safeParse(await req.json().catch(() => null))
  if (!p.success) return Response.json({ ok: true, ignored: 'shape' })
  const { webhookEvent, matchedWebhookIds, issue, comment } = p.data
  const delivery = req.headers.get('x-atlassian-webhook-identifier')

  await afterResponse(async () => {
    const db = createAdminClient()
    const { data: row } = await db.from('tracker_connections').select('id, workspace_id, external_id, site_url, name, write_back, meta, kind')
      .eq('kind', 'jira').contains('meta', { webhookIds: [matchedWebhookIds[0]] }).maybeSingle()
    if (!row || !issue) return
    const ws = row.workspace_id
    const conn: Connection = { id: row.id, workspaceId: ws, kind: 'jira', externalId: row.external_id, name: row.name, siteUrl: row.site_url, writeBack: row.write_back, meta: row.meta as Record<string, unknown> }
    const jiraIssue = issue as unknown as JiraIssue

    if (webhookEvent === 'jira:issue_created' || webhookEvent === 'jira:issue_updated' || webhookEvent === 'jira:issue_deleted') {
      if (webhookEvent === 'jira:issue_deleted') jiraIssue.fields.status = { statusCategory: { key: 'done' } } // gone in Jira: close it here
      const result = await syncJiraIssue(db, ws, conn, jiraIssue)
      if (result === 'created') {
        const id = await taskIdForRef(db, ws, jiraRef(conn.siteUrl, issue.key))
        if (id) await requestWriteBack(ws, [id])
      }
      return
    }

    // A person commented on an ASK issue: same handling as GitHub/Linear replies and Slack answers.
    if (webhookEvent === 'comment_created' && comment && comment.author?.accountType === 'atlassian') {
      const body = adfToText(comment.body as never)
      if (!body.trim() || isAgentText(body)) return
      const { data: first } = await db.rpc('claim_agent_cooldown', { ws, check_key: `jira-comment-${delivery ?? comment.id}`, cooldown_seconds: 30 * 86_400 })
      if (!first) return
      const { data: task } = await db.from('tasks').select('*').eq('workspace_id', ws).eq('external_ref', jiraRef(conn.siteUrl, issue.key)).maybeSingle()
      if (!task || task.decision !== 'ASK' || task.status === 'done') return
      const who = comment.author.displayName ?? 'Someone'
      const out = await applyAnswer(db, ws, task, { authorName: `${who} in Jira`, body, via: 'jira', who })
      if (out.result === 'retriaged') await requestWriteBack(ws, [out.taskId])
    }
  })
  return Response.json({ ok: true })
}
