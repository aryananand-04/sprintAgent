// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { readState as sealRead, sealConfigured, signState as sealSign } from '@/server/seal'
import type { Tokens } from '@/server/trackers/connections'

const API = 'https://api.linear.app'

function env() {
  const clientId = process.env.LINEAR_CLIENT_ID
  const clientSecret = process.env.LINEAR_CLIENT_SECRET
  const webhookSecret = process.env.LINEAR_WEBHOOK_SECRET
  if (!clientId || !clientSecret || !webhookSecret || !sealConfigured()) return null
  return { clientId, clientSecret, webhookSecret }
}

export const linearConfigured = () => env() !== null
export const signState = (p: { ws: string; uid: string }) => sealSign(p, `linear:${env()!.clientSecret}`)
export const readState = (s: string | null) => { const e = env(); return e ? sealRead(s, `linear:${e.clientSecret}`) : null }

/** Installs as the app (actor=app), so labels and comments come from "Sprint Agent", not the admin. */
export function authorizeUrl(state: string, redirectUri: string): string {
  const q = new URLSearchParams({ client_id: env()!.clientId, redirect_uri: redirectUri, response_type: 'code', scope: 'read,write', state, actor: 'app', prompt: 'consent' })
  return `https://linear.app/oauth/authorize?${q}`
}

export class LinearError extends Error {
  constructor(public code: string) { super(`Linear: ${code}`) }
}

async function token(body: Record<string, string>): Promise<Tokens> {
  const e = env()
  if (!e) throw new LinearError('not_configured')
  const res = await fetch(`${API}/oauth/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ...body, client_id: e.clientId, client_secret: e.clientSecret }), signal: AbortSignal.timeout(10_000),
  })
  const d = (await res.json().catch(() => null)) as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string } | null
  if (!res.ok || !d?.access_token) throw new LinearError(d?.error ?? `HTTP_${res.status}`)
  return { accessToken: d.access_token, refreshToken: d.refresh_token ?? null, expiresIn: d.expires_in ?? null }
}

export const exchangeCode = (code: string, redirectUri: string) => token({ grant_type: 'authorization_code', code, redirect_uri: redirectUri })
/** Access tokens last 24h; each refresh returns a new refresh token (the old one stays usable briefly). */
export const refreshLinear = (refreshToken: string) => token({ grant_type: 'refresh_token', refresh_token: refreshToken })

export async function revoke(accessToken: string) {
  await fetch(`${API}/oauth/revoke`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: accessToken }), signal: AbortSignal.timeout(10_000) }).catch(() => {})
}

/** One GraphQL call. Linear reports errors in the body with HTTP 200 as well, so both are checked. */
export async function gql<T>(accessToken: string, query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(`${API}/graphql`, {
    method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }), signal: AbortSignal.timeout(15_000),
  })
  const d = (await res.json().catch(() => null)) as { data?: T; errors?: Array<{ message: string; extensions?: { code?: string } }> } | null
  if (!res.ok || !d || d.errors?.length || !d.data) throw new LinearError(d?.errors?.[0]?.extensions?.code ?? d?.errors?.[0]?.message ?? `HTTP_${res.status}`)
  return d.data
}

/**
 * `Linear-Signature` is a hex HMAC-SHA256 of the raw body with the app's webhook secret. The body's
 * `webhookTimestamp` must be within a minute, so a captured delivery can't be replayed later.
 */
export function verifyLinearWebhook(raw: string, signature: string | null, webhookTimestamp: unknown, now = Date.now()): boolean {
  const e = env()
  if (!e || !signature || typeof webhookTimestamp !== 'number' || Math.abs(now - webhookTimestamp) > 60_000) return false
  const want = Buffer.from(createHmac('sha256', e.webhookSecret).update(raw).digest('hex'))
  const got = Buffer.from(signature)
  return got.length === want.length && timingSafeEqual(got, want)
}
