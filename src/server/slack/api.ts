// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { readState as sealRead, sealConfigured, signState as sealSign } from '@/server/seal'

const API = 'https://slack.com/api'

/** Bot scopes, asked for once at install. Each one is used: posting, slash command, mentions, channel pick, user→member mapping, DMs. */
export const SLACK_SCOPES = ['chat:write', 'commands', 'app_mentions:read', 'incoming-webhook', 'users:read', 'users:read.email', 'im:write']

function env() {
  const clientId = process.env.SLACK_CLIENT_ID
  const clientSecret = process.env.SLACK_CLIENT_SECRET
  const signingSecret = process.env.SLACK_SIGNING_SECRET
  if (!clientId || !clientSecret || !signingSecret || !sealConfigured()) return null
  return { clientId, clientSecret, signingSecret }
}

export const slackConfigured = () => env() !== null

export const signState = (payload: { ws: string; uid: string }) => sealSign(payload, `slack:${env()!.clientSecret}`)
export const readState = (state: string | null) => { const e = env(); return e ? sealRead(state, `slack:${e.clientSecret}`) : null }

export function authorizeUrl(state: string, redirectUri: string): string {
  const q = new URLSearchParams({ client_id: env()!.clientId, scope: SLACK_SCOPES.join(','), state, redirect_uri: redirectUri })
  return `https://slack.com/oauth/v2/authorize?${q}`
}

/**
 * Verifies `X-Slack-Signature` over the raw body (constant time) and rejects anything older than five
 * minutes, so a captured request can't be replayed later.
 */
export function verifySlackRequest(raw: string, timestamp: string | null, signature: string | null, now = Date.now()): boolean {
  const e = env()
  const ts = Number(timestamp)
  if (!e || !signature?.startsWith('v0=') || !Number.isFinite(ts) || Math.abs(now / 1000 - ts) > 300) return false
  const want = Buffer.from(`v0=${createHmac('sha256', e.signingSecret).update(`v0:${timestamp}:${raw}`).digest('hex')}`)
  const got = Buffer.from(signature)
  return got.length === want.length && timingSafeEqual(got, want)
}

export class SlackError extends Error {
  constructor(public code: string) { super(`Slack: ${code}`) }
}

/** Form-encodes Web API arguments; nested values (blocks) go as JSON strings, as Slack expects. */
export const formBody = (args: Record<string, unknown>) =>
  new URLSearchParams(Object.entries(args).filter(([, v]) => v !== undefined).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]))

/**
 * Calls a Web API method with a bot token. Form-encoded, because read methods (users.info,
 * users.lookupByEmail) reject JSON bodies. Slack answers 200 with `ok: false` on errors, so check both.
 */
export async function slackApi<T = Record<string, unknown>>(method: string, token: string, args: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${API}/${method}`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}` },
    body: formBody(args), signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new SlackError(`HTTP_${res.status}`)
  const data = (await res.json()) as { ok: boolean; error?: string } & T
  if (!data.ok) throw new SlackError(data.error ?? 'unknown_error')
  return data
}

const OAuthAccess = z.object({
  ok: z.literal(true),
  access_token: z.string().startsWith('xoxb-'),
  bot_user_id: z.string(),
  team: z.object({ id: z.string(), name: z.string() }),
  incoming_webhook: z.object({ url: z.string().startsWith('https://hooks.slack.com/'), channel: z.string(), channel_id: z.string() }).optional(),
})
export type SlackInstall = z.infer<typeof OAuthAccess>

/** Exchanges the OAuth code for a bot token (form-encoded, client credentials in the body as Slack documents). */
export async function exchangeCode(code: string, redirectUri: string): Promise<SlackInstall> {
  const e = env()
  if (!e) throw new SlackError('not_configured')
  const res = await fetch(`${API}/oauth.v2.access`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, redirect_uri: redirectUri, client_id: e.clientId, client_secret: e.clientSecret }),
    signal: AbortSignal.timeout(10_000),
  })
  const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
  if (!data?.ok) throw new SlackError(data?.error ?? `HTTP_${res.status}`)
  return OAuthAccess.parse(data)
}
