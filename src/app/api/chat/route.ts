// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { handleChat } from '@/server/llm'
import { getSession } from '@/lib/session'
import { createAdminClient } from '@/lib/supabase/admin'
import { aiQuotaResponse, consumeAi } from '@/server/billing/plan'

export async function POST(req: Request): Promise<Response> {
  const session = await getSession()
  if (!session?.current) return Response.json({ error: 'UNAUTHENTICATED' }, { status: 401 })

  const apiKey = process.env.GROQ_API_KEY
  const body = await req.json().catch(() => null)
  if (apiKey && !(await consumeAi(createAdminClient(), session.current.workspace.id))) return aiQuotaResponse()
  const res = await handleChat(body, apiKey)
  return Response.json(res.body, { status: res.status })
}
