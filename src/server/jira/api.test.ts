// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { describe, it, expect, beforeAll } from 'vitest'
import { createHmac, randomBytes } from 'node:crypto'
import { authorizeUrl, verifyJiraWebhook } from './api'

const SECRET = 'jira-client-secret'
export const jiraJwt = (payload: Record<string, unknown>, secret = SECRET, alg = 'HS256') => {
  const b = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const body = `${b({ alg, typ: 'JWT' })}.${b(payload)}`
  return `Bearer ${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`
}

beforeAll(() => {
  Object.assign(process.env, { JIRA_CLIENT_ID: 'cid', JIRA_CLIENT_SECRET: SECRET, TOKEN_ENCRYPTION_KEY: randomBytes(32).toString('base64') })
})

describe('Jira webhook token', () => {
  const now = 1_800_000_000_000
  it('accepts an HS256 token signed with the client secret', () => {
    expect(verifyJiraWebhook(jiraJwt({ iss: 'x', exp: now / 1000 + 60 }), now)).toBe(true)
    expect(verifyJiraWebhook(jiraJwt({ iss: 'x' }), now)).toBe(true)
  })
  it('rejects other secrets, other algorithms, expired tokens and junk', () => {
    expect(verifyJiraWebhook(jiraJwt({}, 'other'), now)).toBe(false)
    expect(verifyJiraWebhook(jiraJwt({}, SECRET, 'none'), now)).toBe(false)
    expect(verifyJiraWebhook(jiraJwt({ exp: now / 1000 - 120 }), now)).toBe(false)
    expect(verifyJiraWebhook('Bearer abc', now)).toBe(false)
    expect(verifyJiraWebhook(null, now)).toBe(false)
  })
})

describe('Jira install', () => {
  it('asks for offline access and webhook management', () => {
    const u = new URL(authorizeUrl('st', 'https://app.example/api/trackers/jira/oauth'))
    expect(u.searchParams.get('audience')).toBe('api.atlassian.com')
    expect(u.searchParams.get('scope')).toContain('offline_access')
    expect(u.searchParams.get('scope')).toContain('manage:jira-webhook')
  })
})
