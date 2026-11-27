// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { describe, it, expect, vi } from 'vitest'
import { handleChat } from './llm'

const body = { messages: [{ role: 'user', content: 'hi' }] }

describe('handleChat', () => {
  it('returns 503 when no key is configured', async () => {
    expect((await handleChat(body, undefined)).status).toBe(503)
  })
  it.each([
    ['null body', null],
    ['no messages', { messages: [] }],
    ['assistant role', { messages: [{ role: 'assistant', content: 'x' }] }],
    ['token cap exceeded', { ...body, maxTokens: 5_000 }],
    ['unknown tier', { ...body, tier: 'huge' }],
  ])('returns 400 for %s', async (_n, bad) => {
    expect((await handleChat(bad, 'k', vi.fn())).status).toBe(400)
  })
  it('applies defaults and returns text', async () => {
    const complete = vi.fn().mockResolvedValue('hello')
    const res = await handleChat(body, 'k', complete)
    expect(res).toEqual({ status: 200, body: { text: 'hello' } })
    expect(complete).toHaveBeenCalledWith(expect.objectContaining({ tier: 'fast', maxTokens: 400, temperature: 0.3 }), 'k')
  })
  it('returns 502 on upstream failure', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await handleChat(body, 'k', vi.fn().mockRejectedValue(new Error('boom')))
    expect(res.status).toBe(502)
  })
})
