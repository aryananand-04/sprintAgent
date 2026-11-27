import { handleChat } from '../server/llm'

export async function POST(req: Request): Promise<Response> {
  const body = await req.json().catch(() => null)
  const res = await handleChat(body, process.env.GROQ_API_KEY)
  return Response.json(res.body, { status: res.status })
}
