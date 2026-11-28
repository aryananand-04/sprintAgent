// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { z } from 'zod'
import { getSession } from '@/lib/session'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canConnect, planLimitResponse } from '@/server/billing/plan'
import { checkWebhookUrl, maskUrl } from '@/logic/delivery'

const Kind = z.enum(['slack_webhook', 'outbound_webhook'])

/** Admin-only. Reads and writes go through the admin's own session, so RLS enforces the role too. */
async function adminContext(): Promise<{ error: Response } | { ws: string; db: Awaited<ReturnType<typeof createClient>> }> {
  const session = await getSession()
  if (!session?.current) return { error: Response.json({ error: 'UNAUTHENTICATED' }, { status: 401 }) }
  if (session.current.role !== 'admin') return { error: Response.json({ error: 'FORBIDDEN' }, { status: 403 }) }
  return { ws: session.current.workspace.id, db: await createClient() }
}

export async function GET(): Promise<Response> {
  const ctx = await adminContext()
  if ('error' in ctx) return ctx.error
  const { data, error } = await ctx.db.from('integrations').select('kind, url, enabled').eq('workspace_id', ctx.ws)
  if (error) return Response.json({ error: 'READ_FAILED' }, { status: 500 })
  // Never send the secret URL back to the browser.
  return Response.json({ integrations: (data ?? []).map((i) => ({ kind: i.kind, enabled: i.enabled, masked: maskUrl(i.url) })) })
}

export async function PUT(req: Request): Promise<Response> {
  const ctx = await adminContext()
  if ('error' in ctx) return ctx.error
  const parsed = z.object({ kind: Kind, url: z.string().trim().max(2_000) }).safeParse(await req.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'INVALID_REQUEST' }, { status: 400 })
  const problem = checkWebhookUrl(parsed.data.kind, parsed.data.url)
  if (problem) return Response.json({ error: 'INVALID_URL', message: problem }, { status: 422 })
  if (parsed.data.kind === 'slack_webhook') {
    // A pasted webhook from another Slack app would carry our Resolve buttons to an app that can't answer them.
    const { data: app } = await ctx.db.from('slack_installations').select('id').eq('workspace_id', ctx.ws).maybeSingle()
    if (!(await canConnect(createAdminClient(), ctx.ws, 'slack'))) return planLimitResponse()
    if (app) return Response.json({ error: 'SLACK_APP_INSTALLED', message: 'The Slack app is installed. Change the channel with “Change channel” under Slack app instead.' }, { status: 409 })
  }
  const { error } = await ctx.db.from('integrations')
    .upsert({ workspace_id: ctx.ws, kind: parsed.data.kind, url: parsed.data.url, enabled: true }, { onConflict: 'workspace_id,kind' })
  if (error) return Response.json({ error: 'WRITE_FAILED' }, { status: 409 })
  return Response.json({ ok: true, masked: maskUrl(parsed.data.url) })
}

export async function DELETE(req: Request): Promise<Response> {
  const ctx = await adminContext()
  if ('error' in ctx) return ctx.error
  const kind = Kind.safeParse(new URL(req.url).searchParams.get('kind'))
  if (!kind.success) return Response.json({ error: 'INVALID_REQUEST' }, { status: 400 })
  await ctx.db.from('integrations').delete().eq('workspace_id', ctx.ws).eq('kind', kind.data)
  return Response.json({ ok: true })
}
