// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
/**
 * Fixed-window rate limiter. In-memory, so it limits per server instance: enough to stop a runaway client
 * loop in one tab. A shared store (Upstash) replaces this when the agent moves server-side (P4).
 */
export function createRateLimiter({ limit, windowMs, now = Date.now }: { limit: number; windowMs: number; now?: () => number }) {
  const hits = new Map<string, { start: number; count: number }>()
  return function check(key: string): { ok: boolean; retryAfterSec: number } {
    const t = now()
    const w = hits.get(key)
    if (!w || t - w.start >= windowMs) {
      hits.set(key, { start: t, count: 1 })
      if (hits.size > 10_000) for (const [k, v] of hits) if (t - v.start >= windowMs) hits.delete(k)
      return { ok: true, retryAfterSec: 0 }
    }
    if (w.count >= limit) return { ok: false, retryAfterSec: Math.ceil((w.start + windowMs - t) / 1000) }
    w.count++
    return { ok: true, retryAfterSec: 0 }
  }
}
