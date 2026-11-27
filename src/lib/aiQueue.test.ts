// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { describe, it, expect, vi } from 'vitest'
import { createAiQueue, AiError } from './aiQueue'

const noSleep = vi.fn(async () => {})

describe('aiQueue', () => {
  it('never runs more than `concurrency` jobs at once', async () => {
    const q = createAiQueue({ concurrency: 2, sleep: noSleep })
    let live = 0, peak = 0
    const job = async () => { live++; peak = Math.max(peak, live); await new Promise((r) => setTimeout(r, 5)); live-- }
    await Promise.all(Array.from({ length: 8 }, () => q(job)))
    expect(peak).toBe(2)
  })
  it('retries rate limits with backoff, honouring Retry-After', async () => {
    const sleep = vi.fn(async () => {})
    const q = createAiQueue({ sleep, baseDelayMs: 100 })
    let n = 0
    const out = await q(async () => { if (n++ < 2) throw new AiError('RATE_LIMITED', n === 1 ? 5_000 : 0); return 'ok' })
    expect(out).toBe('ok')
    expect(sleep.mock.calls.map((c) => (c as unknown[])[0])).toEqual([5_000, 200])
  })
  it('fails fast when AI is disabled', async () => {
    const q = createAiQueue({ sleep: noSleep })
    const job = vi.fn(async () => { throw new AiError('AI_DISABLED') })
    await expect(q(job)).rejects.toThrow('AI_DISABLED')
    expect(job).toHaveBeenCalledTimes(1)
  })
  it('gives up after the retry budget', async () => {
    const q = createAiQueue({ retries: 2, sleep: noSleep })
    const job = vi.fn(async () => { throw new AiError('UPSTREAM_ERROR') })
    await expect(q(job)).rejects.toThrow('UPSTREAM_ERROR')
    expect(job).toHaveBeenCalledTimes(3)
  })
})
