// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { readState as sealRead, sealConfigured, signState as sealSign } from '@/server/seal'
import type { Tokens } from '@/server/trackers/connections'

/** Classic scopes: read/write issues and comments, manage our dynamic webhooks, and a refresh token. */
export const JIRA_SCOPES = ['read:jira-work', 'write:jira-work', 'manage:jira-webhook', 'read:jira-user', 'offline_access']

function env() {
  const clientId = process.env.JIRA_CLIENT_ID
  const clientSecret = process.env.JIRA_CLIENT_SECRET
  if (!clientId || !clientSecret || !sealConfigured()) return null
  return { clientId, clientSecret }
}

export const jiraConfigured = () => env() !== null
export const signState = (p: { ws: string; uid: string }) => sealSign(p, `jira:${env()!.clientSecret}`)
export const readState = (s: string | null) => { const e = env(); return e ? sealRead(s, `jira:${e.clientSecret}`) : null }

export function authorizeUrl(state: string, redirectUri: string): string {
  const q = new URLSearchParams({ audience: 'api.atlassian.com', client_id: env()!.clientId, scope: JIRA_SCOPES.join(' '), redirect_uri: redirectUri, state, response_type: 'code', prompt: 'consent' })
  return `https://auth.atlassian.com/authorize?${q}`
}

export class JiraError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

async function token(body: Record<string, string>): Promise<Tokens> {
  const e = env()
  if (!e) throw new JiraError(0, 'Jira: not_configured')
  const res = await fetch('https://auth.atlassian.com/oauth/token', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, client_id: e.clientId, client_secret: e.clientSecret }), signal: AbortSignal.timeout(10_000),
  })
  const d = (await res.json().catch(() => null)) as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string } | null
  if (!res.ok || !d?.access_token) throw new JiraError(res.status, `Jira token: ${d?.error ?? res.status}`)
  return { accessToken: d.access_token, refreshToken: d.refresh_token ?? null, expiresIn: d.expires_in ?? null }
}

export const exchangeCode = (code: string, redirectUri: string) => token({ grant_type: 'authorization_code', code, redirect_uri: redirectUri })
/** Refresh tokens rotate: each use returns a new one (the previous stays valid for a few minutes). */
export const refreshJira = (refreshToken: string) => token({ grant_type: 'refresh_token', refresh_token: refreshToken })

/** Jira sites this token can reach. We link the first Jira site; `id` is its cloud id. */
export async function accessibleSites(accessToken: string): Promise<Array<{ id: string; name: string; url: string; scopes: string[] }>> {
  const res = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' }, signal: AbortSignal.timeout(10_000) })
  if (!res.ok) throw new JiraError(res.status, `Jira resources: ${res.status}`)
  return res.json()
}

/** Calls Jira's REST API v3 for one site. */
export async function jiraApi<T>(accessToken: string, cloudId: string, path: string, init: RequestInit = {}): Promise<T> {
  const url = `https://api.atlassian.com/ex/jira/${encodeURIComponent(cloudId)}/rest/api/3${path}`
  const res = await fetch(url, {
    ...init, headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json', 'Content-Type': 'application/json', ...init.headers },
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new JiraError(res.status, `Jira ${res.status} on ${init.method ?? 'GET'} ${path.split('?')[0]}`)
  return (res.status === 204 ? null : await res.json().catch(() => null)) as T
}

const b64json = (s: string) => { try { return JSON.parse(Buffer.from(s, 'base64url').toString()) as Record<string, unknown> } catch { return null } }

/**
 * Jira signs webhooks for OAuth apps with a JWT in `Authorization: Bearer`, keyed with the app's
 * client secret. We require HS256, a valid signature, and (when present) an unexpired `exp`.
 */
export function verifyJiraWebhook(authorization: string | null, now = Date.now()): boolean {
  const e = env()
  const jwt = authorization?.match(/^Bearer\s+([\w-]+\.[\w-]+\.[\w-]+)$/)?.[1]
  if (!e || !jwt) return false
  const [h, p, sig] = jwt.split('.')
  const header = b64json(h)
  const payload = b64json(p)
  if (header?.alg !== 'HS256' || !payload) return false
  const want = Buffer.from(createHmac('sha256', e.clientSecret).update(`${h}.${p}`).digest('base64url'))
  const got = Buffer.from(sig)
  if (got.length !== want.length || !timingSafeEqual(got, want)) return false
  return typeof payload.exp !== 'number' || payload.exp * 1000 + 60_000 > now
}
