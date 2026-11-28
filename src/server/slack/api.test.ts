// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { describe, it, expect, beforeAll } from 'vitest'
import { createHmac, randomBytes } from 'node:crypto'
import { authorizeUrl, readState, signState, slackConfigured, verifySlackRequest } from './api'

const SECRET = 'signing-secret'
const sign = (raw: string, ts: number) => `v0=${createHmac('sha256', SECRET).update(`v0:${ts}:${raw}`).digest('hex')}`

beforeAll(() => {
  Object.assign(process.env, { SLACK_CLIENT_ID: 'cid', SLACK_CLIENT_SECRET: 'csecret', SLACK_SIGNING_SECRET: SECRET, TOKEN_ENCRYPTION_KEY: randomBytes(32).toString('base64') })
})

describe('verifySlackRequest', () => {
  const now = 1_800_000_000_000
  const ts = now / 1000
  it('accepts a fresh, correctly signed body', () => {
    expect(verifySlackRequest('a=1', String(ts), sign('a=1', ts), now)).toBe(true)
  })
  it('rejects a changed body, a bad signature, or a replay older than 5 minutes', () => {
    expect(verifySlackRequest('a=2', String(ts), sign('a=1', ts), now)).toBe(false)
    expect(verifySlackRequest('a=1', String(ts), 'v0=deadbeef', now)).toBe(false)
    expect(verifySlackRequest('a=1', String(ts), null, now)).toBe(false)
    expect(verifySlackRequest('a=1', String(ts - 301), sign('a=1', ts - 301), now)).toBe(false)
    expect(verifySlackRequest('a=1', 'soon', sign('a=1', ts), now)).toBe(false)
  })
})

describe('install round-trip', () => {
  it('is configured only with every secret', () => {
    expect(slackConfigured()).toBe(true)
    const k = process.env.TOKEN_ENCRYPTION_KEY
    delete process.env.TOKEN_ENCRYPTION_KEY
    expect(slackConfigured()).toBe(false)
    process.env.TOKEN_ENCRYPTION_KEY = k
  })
  it('asks for the scopes it uses and round-trips state', () => {
    const u = new URL(authorizeUrl('st', 'https://app.example/api/slack/oauth'))
    expect(u.searchParams.get('scope')).toContain('incoming-webhook')
    expect(u.searchParams.get('redirect_uri')).toBe('https://app.example/api/slack/oauth')
    expect(readState(signState({ ws: 'w', uid: 'u' }))).toEqual({ ws: 'w', uid: 'u' })
  })
})
