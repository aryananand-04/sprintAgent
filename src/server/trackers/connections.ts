// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Tables } from '@/db/database.types'
import { seal, unseal } from '@/server/seal'

type Db = SupabaseClient<Database>
export type TrackerKind = Database['public']['Enums']['tracker_kind']

export interface Tokens { accessToken: string; refreshToken?: string | null; expiresIn?: number | null }
export type Refresher = (refreshToken: string) => Promise<Tokens>

export interface Connection {
  id: string
  workspaceId: string
  kind: TrackerKind
  externalId: string
  name: string
  siteUrl: string
  writeBack: boolean
  meta: Record<string, unknown>
}

// Sealed for this connection and purpose, so a value copied to another row or column won't open.
const aad = (kind: string, ext: string, what: 'access' | 'refresh') => `tracker:${kind}:${ext}:${what}`
/** Refresh this long before expiry, so a token never dies mid-run. */
const SKEW_MS = 2 * 60_000

function sealTokens(kind: TrackerKind, ext: string, t: Tokens) {
  return {
    access_token_sealed: seal(t.accessToken, aad(kind, ext, 'access')),
    refresh_token_sealed: t.refreshToken ? seal(t.refreshToken, aad(kind, ext, 'refresh')) : null,
    expires_at: t.expiresIn ? new Date(Date.now() + t.expiresIn * 1000).toISOString() : null,
  }
}

const toConnection = (r: Tables<'tracker_connections'>): Connection => ({
  id: r.id, workspaceId: r.workspace_id, kind: r.kind, externalId: r.external_id, name: r.name, siteUrl: r.site_url,
  writeBack: r.write_back, meta: (r.meta ?? {}) as Record<string, unknown>,
})

/** Links an external org/site to a workspace. One each way; reconnecting updates tokens in place. */
export async function saveConnection(
  db: Db, ws: string, userId: string,
  c: { kind: TrackerKind; externalId: string; name: string; siteUrl: string; tokens: Tokens },
): Promise<'connected' | 'taken'> {
  const { data: other } = await db.from('tracker_connections').select('workspace_id').eq('kind', c.kind).eq('external_id', c.externalId).maybeSingle()
  if (other && other.workspace_id !== ws) return 'taken'
  const { error } = await db.from('tracker_connections').upsert({
    workspace_id: ws, kind: c.kind, external_id: c.externalId, name: c.name, site_url: c.siteUrl, connected_by: userId,
    ...sealTokens(c.kind, c.externalId, c.tokens),
  }, { onConflict: 'workspace_id,kind' })
  if (error?.code === '23505') return 'taken'
  if (error) throw error
  return 'connected'
}

export async function connectionFor(db: Db, ws: string, kind: TrackerKind): Promise<Connection | null> {
  const { data } = await db.from('tracker_connections').select('*').eq('workspace_id', ws).eq('kind', kind).maybeSingle()
  return data ? toConnection(data) : null
}

export async function connectionByExternalId(db: Db, kind: TrackerKind, externalId: string): Promise<Connection | null> {
  const { data } = await db.from('tracker_connections').select('*').eq('kind', kind).eq('external_id', externalId).maybeSingle()
  return data ? toConnection(data) : null
}

/**
 * A usable access token, refreshed when close to expiry. The new tokens are written only if nobody
 * else refreshed first (compare-and-set on the old sealed value); if someone did, theirs are used.
 * Both providers accept the previous refresh token briefly, so a race costs one extra refresh at most.
 */
export async function accessToken(db: Db, conn: Connection, refresh: Refresher): Promise<string> {
  const { data: r } = await db.from('tracker_connections').select('access_token_sealed, refresh_token_sealed, expires_at').eq('id', conn.id).single()
  if (!r) throw new Error('TRACKER_GONE')
  const fresh = !r.expires_at || new Date(r.expires_at).getTime() - Date.now() > SKEW_MS
  if (fresh || !r.refresh_token_sealed) return unseal(r.access_token_sealed, aad(conn.kind, conn.externalId, 'access'))

  const next = await refresh(unseal(r.refresh_token_sealed, aad(conn.kind, conn.externalId, 'refresh')))
  const sealed = sealTokens(conn.kind, conn.externalId, { ...next, refreshToken: next.refreshToken ?? null })
  const { data: won } = await db.from('tracker_connections')
    .update({ ...sealed, refresh_token_sealed: sealed.refresh_token_sealed ?? r.refresh_token_sealed })
    .eq('id', conn.id).eq('access_token_sealed', r.access_token_sealed).select('id')
  if (won?.length) return next.accessToken
  return accessToken(db, conn, refresh) // someone else refreshed: use theirs
}

export async function setMeta(db: Db, conn: Connection, meta: Record<string, unknown>) {
  await db.from('tracker_connections').update({ meta: { ...conn.meta, ...meta } as never }).eq('id', conn.id)
}

export async function forgetConnection(db: Db, ws: string, kind: TrackerKind) {
  await db.from('tracker_connections').delete().eq('workspace_id', ws).eq('kind', kind)
}
