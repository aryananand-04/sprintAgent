// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { describe, it, expect } from 'vitest'
import { createRateLimiter } from './rateLimit'

describe('createRateLimiter', () => {
  it('allows `limit` calls per window, then reports when to retry', () => {
    let t = 0
    const check = createRateLimiter({ limit: 2, windowMs: 10_000, now: () => t })
    expect(check('u').ok).toBe(true)
    expect(check('u').ok).toBe(true)
    expect(check('u')).toEqual({ ok: false, retryAfterSec: 10 })
    expect(check('other').ok).toBe(true)
    t = 10_000
    expect(check('u').ok).toBe(true)
  })
})
