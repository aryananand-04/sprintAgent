// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
export interface ChatMessage {
  role: 'system' | 'user'
  content: string
}

export interface ChatOptions {
  messages: ChatMessage[]
  tier?: 'fast' | 'smart'
  temperature?: number
  maxTokens?: number
}

let disabled = false

/** Calls the server-side LLM proxy. Throws on any failure so callers can fall back deterministically. */
export async function chat(opts: ChatOptions): Promise<string> {
  if (disabled) throw new Error('AI_DISABLED')
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  })
  const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string }
  if (data.error === 'AI_DISABLED') disabled = true
  if (!res.ok || typeof data.text !== 'string') throw new Error(data.error ?? `HTTP_${res.status}`)
  return data.text
}

/** Single-prompt convenience wrapper. */
export const prompt = (content: string, opts: Omit<ChatOptions, 'messages'> = {}) =>
  chat({ ...opts, messages: [{ role: 'user', content }] })
