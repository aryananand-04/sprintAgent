// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import 'server-only'
import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

/** 32-byte key, base64 (`openssl rand -base64 32`). Seals third-party tokens at rest. */
function key(): Buffer {
  const k = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY ?? '', 'base64')
  if (k.length !== 32) throw new Error('TOKEN_ENCRYPTION_KEY must be 32 bytes, base64')
  return k
}

export const sealConfigured = () => Buffer.from(process.env.TOKEN_ENCRYPTION_KEY ?? '', 'base64').length === 32

/** AES-256-GCM. Output: `v1.<iv>.<tag>.<ciphertext>` (base64url). `aad` binds it to one row/purpose. */
export function seal(plain: string, aad: string): string {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', key(), iv).setAAD(Buffer.from(aad))
  const ct = Buffer.concat([c.update(plain, 'utf8'), c.final()])
  return ['v1', iv, c.getAuthTag(), ct].map((p) => (typeof p === 'string' ? p : p.toString('base64url'))).join('.')
}

/** Throws if the value was tampered with, sealed for another `aad`, or under another key. */
export function unseal(sealed: string, aad: string): string {
  const [v, iv, tag, ct] = sealed.split('.')
  if (v !== 'v1' || !iv || !tag || !ct) throw new Error('UNSEAL_FORMAT')
  const d = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url')).setAAD(Buffer.from(aad))
  d.setAuthTag(Buffer.from(tag, 'base64url'))
  return Buffer.concat([d.update(Buffer.from(ct, 'base64url')), d.final()]).toString('utf8')
}

/** Signed, expiring `state` for OAuth round-trips, binding it to one workspace and one user. */
export function signState(payload: { ws: string; uid: string }, secret: string, ttlMs = 15 * 60_000): string {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + ttlMs })).toString('base64url')
  return `${body}.${createHmac('sha256', `state:${secret}`).update(body).digest('base64url')}`
}

export function readState(state: string | null, secret: string): { ws: string; uid: string } | null {
  if (!state) return null
  const [body, sig] = state.split('.')
  if (!body || !sig) return null
  const want = Buffer.from(createHmac('sha256', `state:${secret}`).update(body).digest('base64url'))
  const got = Buffer.from(sig)
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString()) as { ws: string; uid: string; exp: number }
    return p.exp > Date.now() && typeof p.ws === 'string' && typeof p.uid === 'string' ? { ws: p.ws, uid: p.uid } : null
  } catch { return null }
}
