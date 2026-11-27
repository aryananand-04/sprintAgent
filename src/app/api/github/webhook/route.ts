// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyWebhook } from '@/server/github/app'
import { syncIssue, workspaceForInstallation } from '@/server/github/sync'
import type { GhIssue } from '@/logic/github'
import { requestWriteBack } from '@/server/github/jobs'

interface Payload {
  action?: string
  installation?: { id: number }
  issue?: GhIssue
  repository?: { full_name: string }
}

const ISSUE_ACTIONS = new Set(['opened', 'edited', 'closed', 'reopened', 'labeled', 'unlabeled'])

/** GitHub → us. Signature first; unknown installations and events are acknowledged and ignored. */
export async function POST(req: Request): Promise<Response> {
  const raw = await req.text()
  if (!verifyWebhook(raw, req.headers.get('x-hub-signature-256'))) return Response.json({ error: 'BAD_SIGNATURE' }, { status: 401 })

  const event = req.headers.get('x-github-event')
  let p: Payload
  try { p = JSON.parse(raw) as Payload } catch { return Response.json({ error: 'BAD_JSON' }, { status: 400 }) }
  const installationId = p.installation?.id
  if (!installationId) return Response.json({ ok: true, ignored: 'no installation' })

  const db = createAdminClient()
  if (event === 'installation' && p.action === 'deleted') {
    await db.from('github_installations').delete().eq('installation_id', installationId)
    return Response.json({ ok: true })
  }

  const ws = await workspaceForInstallation(db, installationId)
  if (!ws) return Response.json({ ok: true, ignored: 'not linked' })

  if (event === 'issues' && p.issue && p.repository && ISSUE_ACTIONS.has(p.action ?? '')) {
    const result = await syncIssue(db, ws, p.repository.full_name, p.issue)
    if (result === 'created') {
      const { data } = await db.from('tasks').select('id').eq('workspace_id', ws).eq('external_ref', p.issue.html_url).maybeSingle()
      if (data) await requestWriteBack(ws, [data.id])
    }
    return Response.json({ ok: true, result })
  }
  return Response.json({ ok: true, ignored: event })
}
