// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
/**
 * Runs AI calls with bounded concurrency and polite retries, replacing fixed timer staggers.
 * - RATE_LIMITED / UPSTREAM_ERROR: retry with exponential backoff (or the server's Retry-After).
 * - AI_DISABLED: stop retrying; every queued job fails fast so callers fall back to rules.
 */
export class AiError extends Error {
  constructor(public code: string, public retryAfterMs = 0) { super(code) }
}

const RETRYABLE = new Set(['RATE_LIMITED', 'UPSTREAM_ERROR', 'NETWORK'])

export function createAiQueue({ concurrency = 2, retries = 3, baseDelayMs = 1_000, sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms)) } = {}) {
  let active = 0
  const waiting: Array<() => void> = []

  const acquire = () => new Promise<void>((resolve) => {
    if (active < concurrency) { active++; resolve() } else waiting.push(() => { active++; resolve() })
  })
  const release = () => { active--; waiting.shift()?.() }

  return async function run<T>(job: () => Promise<T>): Promise<T> {
    await acquire()
    try {
      for (let attempt = 0; ; attempt++) {
        try {
          return await job()
        } catch (e) {
          const err = e instanceof AiError ? e : new AiError('NETWORK')
          if (!RETRYABLE.has(err.code) || attempt >= retries) throw err
          await sleep(err.retryAfterMs || baseDelayMs * 2 ** attempt)
        }
      }
    } finally {
      release()
    }
  }
}

/** One shared queue for the dashboard. */
export const aiQueue = createAiQueue()
