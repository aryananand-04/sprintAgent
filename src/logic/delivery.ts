// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
// Provenance: sprintagent-prov-7c1e94d2b85a

/** Outbox retry policy: 1, 2, 4, 8, 16 minutes… capped at 6 hours; gives up after MAX_ATTEMPTS. */
export const MAX_ATTEMPTS = 8

export function backoffMs(attempts: number): number {
  return Math.min(60_000 * 2 ** Math.max(0, attempts - 1), 6 * 60 * 60_000)
}

export type IntegrationKind = 'slack_webhook' | 'outbound_webhook'

/**
 * Webhook URLs are user-supplied and fetched by our server, so they are checked against SSRF:
 * https only, no credentials, no localhost/private/link-local hosts. Slack must be a Slack webhook host.
 * Returns an error message, or null if the URL is acceptable.
 */
export function checkWebhookUrl(kind: IntegrationKind, raw: string): string | null {
  let u: URL
  try { u = new URL(raw) } catch { return 'That isn’t a valid URL.' }
  if (u.protocol !== 'https:') return 'Use an https:// URL.'
  if (u.username || u.password) return 'Remove credentials from the URL.'
  if (u.port && u.port !== '443') return 'Use the default https port.'
  const host = u.hostname.toLowerCase().replace(/\.$/, '')
  if (kind === 'slack_webhook' && host !== 'hooks.slack.com') return 'Slack webhooks start with https://hooks.slack.com/.'
  if (isPrivateHost(host)) return 'That address points at a private network.'
  return null
}

/** True for hosts or IP literals we must never call (also used on resolved addresses against DNS rebinding). */
export function isPrivateHost(host: string): boolean {
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return true
  if (host.startsWith('[') || host.includes(':')) return true // IPv6 literals: refuse rather than parse
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (!m) return false
  const [a, b] = [Number(m[1]), Number(m[2])]
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
}

/** Masks a secret URL for display: keeps the host and the last 4 characters. */
export function maskUrl(raw: string): string {
  try {
    const u = new URL(raw)
    return `${u.protocol}//${u.host}/…${raw.slice(-4)}`
  } catch { return '…' }
}
