// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { describe, it, expect, vi } from 'vitest'
import { formatPayload, send } from './outbox'

const ok = vi.fn(async () => new Response('ok'))
const pub = async () => ['93.184.216.34']

describe('formatPayload', () => {
  it('escapes Slack control characters in user text', () => {
    const p = JSON.stringify(formatPayload('slack_webhook', { type: 'escalation', taskTitle: 'T', reason: '<!channel> & co', recommendation: '', urgency: 'high' }))
    expect(p).toContain('&lt;!channel&gt; &amp; co')
  })
  it('sends structured JSON to outbound webhooks', () => {
    expect(formatPayload('outbound_webhook', { type: 'decision', taskTitle: 'T', decision: 'ACT', reason: 'r' })).toMatchObject({ event: 'decision', data: { decision: 'ACT' } })
  })
})

describe('send', () => {
  it('posts JSON without following redirects', async () => {
    await send('https://example.com/h', 'outbound_webhook', { a: 1 }, ok, pub)
    expect(ok).toHaveBeenCalledWith('https://example.com/h', expect.objectContaining({ method: 'POST', redirect: 'error' }))
  })
  it('refuses hosts that resolve to private addresses (DNS rebinding)', async () => {
    await expect(send('https://example.com/h', 'outbound_webhook', {}, ok, async () => ['10.0.0.5'])).rejects.toThrow('REFUSED')
  })
  it('refuses bad URLs before any network call', async () => {
    const f = vi.fn()
    await expect(send('https://169.254.169.254/x', 'outbound_webhook', {}, f, pub)).rejects.toThrow('REFUSED')
    expect(f).not.toHaveBeenCalled()
  })
  it('treats non-2xx as failure', async () => {
    await expect(send('https://example.com/h', 'outbound_webhook', {}, async () => new Response('no', { status: 500 }), pub)).rejects.toThrow('HTTP_500')
  })
})
