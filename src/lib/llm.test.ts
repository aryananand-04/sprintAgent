// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { describe, it, expect, vi } from 'vitest'
import { chat } from './llm'

const reply = (status: number, body: object) =>
  vi.fn().mockResolvedValue({ ok: status < 400, status, json: async () => body })

describe('chat', () => {
  it('returns text on success', async () => {
    vi.stubGlobal('fetch', reply(200, { text: 'ok' }))
    await expect(chat({ messages: [{ role: 'user', content: 'x' }] })).resolves.toBe('ok')
  })
  it('throws upstream errors', async () => {
    vi.stubGlobal('fetch', reply(502, { error: 'UPSTREAM_ERROR' }))
    await expect(chat({ messages: [{ role: 'user', content: 'x' }] })).rejects.toThrow('UPSTREAM_ERROR')
  })
  it('stops calling the server once AI is disabled', async () => {
    const f = reply(503, { error: 'AI_DISABLED' })
    vi.stubGlobal('fetch', f)
    await expect(chat({ messages: [{ role: 'user', content: 'x' }] })).rejects.toThrow('AI_DISABLED')
    await expect(chat({ messages: [{ role: 'user', content: 'x' }] })).rejects.toThrow('AI_DISABLED')
    expect(f).toHaveBeenCalledTimes(1)
  })
})
