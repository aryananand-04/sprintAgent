// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { describe, it, expect, beforeAll } from 'vitest'
import { createHmac, randomBytes } from 'node:crypto'
import { authorizeUrl, linearConfigured, verifyLinearWebhook } from './api'

const SECRET = 'lin-webhook-secret'
const sign = (raw: string) => createHmac('sha256', SECRET).update(raw).digest('hex')

beforeAll(() => {
  Object.assign(process.env, { LINEAR_CLIENT_ID: 'cid', LINEAR_CLIENT_SECRET: 'cs', LINEAR_WEBHOOK_SECRET: SECRET, TOKEN_ENCRYPTION_KEY: randomBytes(32).toString('base64') })
})

describe('Linear webhooks', () => {
  const now = 1_800_000_000_000
  it('accepts a fresh, correctly signed body', () => {
    expect(verifyLinearWebhook('{"a":1}', sign('{"a":1}'), now - 5_000, now)).toBe(true)
  })
  it('rejects a changed body, a missing signature, or anything older than a minute', () => {
    expect(verifyLinearWebhook('{"a":2}', sign('{"a":1}'), now, now)).toBe(false)
    expect(verifyLinearWebhook('{"a":1}', null, now, now)).toBe(false)
    expect(verifyLinearWebhook('{"a":1}', sign('{"a":1}'), now - 61_000, now)).toBe(false)
    expect(verifyLinearWebhook('{"a":1}', sign('{"a":1}'), 'now', now)).toBe(false)
  })
})

describe('Linear install', () => {
  it('installs as the app with read+write', () => {
    expect(linearConfigured()).toBe(true)
    const u = new URL(authorizeUrl('st', 'https://app.example/api/trackers/linear/oauth'))
    expect(Object.fromEntries(u.searchParams)).toMatchObject({ actor: 'app', scope: 'read,write', response_type: 'code', state: 'st' })
  })
})
