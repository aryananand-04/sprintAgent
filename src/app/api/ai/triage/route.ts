// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { getSession } from '@/lib/session'
import { can } from '@/lib/permissions'
import { groqCompleter } from '@/server/llm'
import { TriageRequest, runTriage } from '@/server/ai/triage'
import { createRateLimiter } from '@/server/rateLimit'
import { createAdminClient } from '@/lib/supabase/admin'
import { aiQuotaResponse, consumeAi } from '@/server/billing/plan'

// 30 AI triages per user per minute: a backlog bootstrap fits, a runaway loop doesn't.
const limit = createRateLimiter({ limit: 30, windowMs: 60_000 })

export async function POST(req: Request): Promise<Response> {
  const session = await getSession()
  if (!session) return Response.json({ error: 'UNAUTHENTICATED' }, { status: 401 })
  if (!can(session.current?.role ?? null, 'task:create')) return Response.json({ error: 'FORBIDDEN' }, { status: 403 })

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return Response.json({ error: 'AI_DISABLED' }, { status: 503 })

  const rl = limit(session.user.id)
  if (!rl.ok) return Response.json({ error: 'RATE_LIMITED' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } })

  const parsed = TriageRequest.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'INVALID_REQUEST' }, { status: 400 })
  if (!(await consumeAi(createAdminClient(), session.current!.workspace.id))) return aiQuotaResponse()

  try {
    return Response.json(await runTriage(parsed.data, apiKey, groqCompleter))
  } catch (e) {
    console.error('[ai/triage]', e instanceof Error ? e.message : e)
    return Response.json({ error: 'UPSTREAM_ERROR' }, { status: 502 })
  }
}
