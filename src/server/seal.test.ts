// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { describe, it, expect, beforeAll, vi } from 'vitest'
import { randomBytes } from 'node:crypto'
import { readState, seal, signState, unseal } from './seal'

beforeAll(() => { process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString('base64') })

describe('seal', () => {
  it('round-trips and never contains the plaintext', () => {
    const s = seal('xoxb-secret', 'slack-bot:T1')
    expect(s).not.toContain('xoxb')
    expect(unseal(s, 'slack-bot:T1')).toBe('xoxb-secret')
  })
  it('refuses another row, a tampered value, or another key', () => {
    const s = seal('xoxb-secret', 'slack-bot:T1')
    expect(() => unseal(s, 'slack-bot:T2')).toThrow()
    const parts = s.split('.'); parts[3] = Buffer.from('xoxb-forged').toString('base64url')
    expect(() => unseal(parts.join('.'), 'slack-bot:T1')).toThrow()
    expect(() => unseal('junk', 'slack-bot:T1')).toThrow('UNSEAL_FORMAT')
    process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString('base64')
    expect(() => unseal(s, 'slack-bot:T1')).toThrow()
  })
  it('needs a 32-byte key', () => {
    const k = process.env.TOKEN_ENCRYPTION_KEY
    process.env.TOKEN_ENCRYPTION_KEY = 'short'
    expect(() => seal('x', 'y')).toThrow(/32 bytes/)
    process.env.TOKEN_ENCRYPTION_KEY = k
  })
})

describe('signed state', () => {
  const p = { ws: 'w1', uid: 'u1' }
  it('reads back what it signed, only with the same secret', () => {
    expect(readState(signState(p, 'a'), 'a')).toEqual(p)
    expect(readState(signState(p, 'a'), 'b')).toBeNull()
    expect(readState(null, 'a')).toBeNull()
    expect(readState('x.y', 'a')).toBeNull()
  })
  it('expires', () => {
    vi.useFakeTimers()
    const s = signState(p, 'a', 1_000)
    vi.advanceTimersByTime(1_001)
    expect(readState(s, 'a')).toBeNull()
    vi.useRealTimers()
  })
})
