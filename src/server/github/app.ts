// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import 'server-only'
import { createHmac, createSign, timingSafeEqual } from 'node:crypto'
import { nextPageUrl } from '@/logic/github'
import { readState as sealReadState, signState as sealSignState } from '@/server/seal'

const API = 'https://api.github.com'

function env() {
  const id = process.env.GITHUB_APP_ID
  const slug = process.env.GITHUB_APP_SLUG
  const key64 = process.env.GITHUB_APP_PRIVATE_KEY_BASE64
  const webhookSecret = process.env.GITHUB_APP_WEBHOOK_SECRET
  if (!id || !slug || !key64 || !webhookSecret) return null
  return { id, slug, key: Buffer.from(key64, 'base64').toString('utf8'), webhookSecret }
}

export const githubConfigured = () => env() !== null
export const installUrl = (state: string) => `https://github.com/apps/${env()!.slug}/installations/new?state=${encodeURIComponent(state)}`

/** Short-lived JWT that authenticates as the app itself (10 min max; we use 9). */
export function appJwt(now = Math.floor(Date.now() / 1000)): string {
  const e = env()
  if (!e) throw new Error('GITHUB_NOT_CONFIGURED')
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const body = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iat: now - 60, exp: now + 540, iss: e.id })}`
  return `${body}.${createSign('RSA-SHA256').update(body).sign(e.key, 'base64url')}`
}

const headers = (token: string) => ({ Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'sprint-agent' })

export class GitHubError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

async function call<T>(url: string, token: string, init: RequestInit = {}): Promise<{ data: T; res: Response }> {
  const full = url.startsWith('http') ? url : `${API}${url}`
  const res = await fetch(full, { ...init, headers: { ...headers(token), ...init.headers }, signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new GitHubError(res.status, `GitHub ${res.status} on ${new URL(full).pathname}`)
  return { data: (res.status === 204 ? null : await res.json()) as T, res }
}

/** Calls as the app (installation lookups). */
export const asApp = <T>(path: string, init?: RequestInit) => call<T>(path, appJwt(), init).then((r) => r.data)

// Installation tokens last an hour; reuse them until 5 minutes before expiry.
const tokens = new Map<number, { token: string; expires: number }>()

export async function installationToken(installationId: number): Promise<string> {
  const hit = tokens.get(installationId)
  if (hit && hit.expires - Date.now() > 5 * 60_000) return hit.token
  const t = await asApp<{ token: string; expires_at: string }>(`/app/installations/${installationId}/access_tokens`, { method: 'POST' })
  tokens.set(installationId, { token: t.token, expires: new Date(t.expires_at).getTime() })
  return t.token
}

/** Calls as an installation (repo data, write-back). */
export async function asInstallation<T>(installationId: number, path: string, init?: RequestInit): Promise<T> {
  return (await call<T>(path, await installationToken(installationId), init)).data
}

/** Follows `Link: rel="next"` pages up to `maxPages` (100 items each), so large backlogs import fully. */
export async function paginate<T>(installationId: number, path: string, maxPages = 50): Promise<T[]> {
  const token = await installationToken(installationId)
  const out: T[] = []
  let url: string | null = `${path}${path.includes('?') ? '&' : '?'}per_page=100`
  for (let page = 0; url && page < maxPages; page++) {
    const { data, res }: { data: T[] | { repositories: T[] }; res: Response } = await call(url, token)
    out.push(...(Array.isArray(data) ? data : data.repositories))
    url = nextPageUrl(res.headers.get('link'))
  }
  return out
}

/** Verifies `X-Hub-Signature-256` over the raw body (constant time). */
export function verifyWebhook(rawBody: string, signature: string | null): boolean {
  const e = env()
  if (!e || !signature?.startsWith('sha256=')) return false
  const want = Buffer.from(`sha256=${createHmac('sha256', e.webhookSecret).update(rawBody).digest('hex')}`)
  const got = Buffer.from(signature)
  return got.length === want.length && timingSafeEqual(got, want)
}

/** Install round-trip state, signed with the webhook secret (see `server/seal`). */
export const signState = (payload: { ws: string; uid: string }) => sealSignState(payload, env()!.webhookSecret)
export const readState = (state: string | null) => { const e = env(); return e ? sealReadState(state, e.webhookSecret) : null }
