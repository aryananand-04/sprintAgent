import { handleChat } from '../../../../server/llm'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request): Promise<Response> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  if (!data?.claims?.sub) return Response.json({ error: 'UNAUTHENTICATED' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const res = await handleChat(body, process.env.GROQ_API_KEY)
  return Response.json(res.body, { status: res.status })
}
