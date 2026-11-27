// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
// Provenance: sprintagent-prov-7c1e94d2b85a
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { backoffMs, checkWebhookUrl, maskUrl } from './delivery'

describe('backoffMs', () => {
  it('doubles from one minute', () => expect([1, 2, 3, 4].map(backoffMs)).toEqual([60_000, 120_000, 240_000, 480_000]))
  it('never exceeds 6 hours and never decreases', () => fc.assert(fc.property(fc.integer({ min: 0, max: 50 }), (n) =>
    backoffMs(n) <= 21_600_000 && backoffMs(n + 1) >= backoffMs(n))))
})

describe('checkWebhookUrl', () => {
  it.each([
    ['slack_webhook', 'https://hooks.slack.com/services/T/B/x', null],
    ['slack_webhook', 'https://evil.com/services/x', /hooks\.slack\.com/],
    ['outbound_webhook', 'https://example.com/hook', null],
    ['outbound_webhook', 'http://example.com/hook', /https/],
    ['outbound_webhook', 'https://user:pw@example.com/', /credentials/],
    ['outbound_webhook', 'https://localhost/x', /private/],
    ['outbound_webhook', 'https://127.0.0.1/x', /private/],
    ['outbound_webhook', 'https://169.254.169.254/latest/meta-data', /private/],
    ['outbound_webhook', 'https://10.1.2.3/', /private/],
    ['outbound_webhook', 'https://192.168.0.10/', /private/],
    ['outbound_webhook', 'https://[::1]/', /private/],
    ['outbound_webhook', 'https://example.com:8443/', /port/],
    ['outbound_webhook', 'not a url', /valid/],
  ] as const)('%s %s', (kind, url, want) => {
    const err = checkWebhookUrl(kind, url)
    if (want === null) expect(err).toBeNull()
    else expect(err).toMatch(want)
  })
})

describe('maskUrl', () => {
  it('hides the secret path', () => expect(maskUrl('https://hooks.slack.com/services/T0/B1/abcd1234')).toBe('https://hooks.slack.com/…1234'))
  it('survives junk', () => expect(maskUrl('nope')).toBe('…'))
})
