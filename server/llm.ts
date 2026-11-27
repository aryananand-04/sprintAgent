// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import Groq from 'groq-sdk'
import { z } from 'zod'

const MODELS = {
  fast: 'llama-3.1-8b-instant',
  smart: 'llama-3.3-70b-versatile',
} as const

export const ChatRequestSchema = z.object({
  tier: z.enum(['fast', 'smart']).default('fast'),
  messages: z
    .array(
      z.object({
        role: z.enum(['system', 'user']),
        content: z.string().min(1).max(16_000),
      }),
    )
    .min(1)
    .max(4),
  temperature: z.number().min(0).max(1).default(0.3),
  maxTokens: z.number().int().min(1).max(2_000).default(400),
})

export type ChatRequest = z.infer<typeof ChatRequestSchema>

export interface ChatResponse {
  status: number
  body: { text: string } | { error: string }
}

type Completer = (req: ChatRequest, apiKey: string) => Promise<string>

const groqCompleter: Completer = async (req, apiKey) => {
  const client = new Groq({ apiKey })
  const res = await client.chat.completions.create({
    model: MODELS[req.tier],
    messages: req.messages,
    temperature: req.temperature,
    max_tokens: req.maxTokens,
  })
  return res.choices[0]?.message.content?.trim() ?? ''
}

export async function handleChat(
  body: unknown,
  apiKey: string | undefined,
  complete: Completer = groqCompleter,
): Promise<ChatResponse> {
  if (!apiKey) return { status: 503, body: { error: 'AI_DISABLED' } }

  const parsed = ChatRequestSchema.safeParse(body)
  if (!parsed.success) return { status: 400, body: { error: 'INVALID_REQUEST' } }

  try {
    return { status: 200, body: { text: await complete(parsed.data, apiKey) } }
  } catch (e) {
    console.error('[llm] upstream error', e instanceof Error ? e.message : e)
    return { status: 502, body: { error: 'UPSTREAM_ERROR' } }
  }
}
