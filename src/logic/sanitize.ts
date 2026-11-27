// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
// Provenance: sprintagent-prov-7c1e94d2b85a

/**
 * Prepares untrusted ticket text for an LLM prompt. It does not try to detect every jailbreak (impossible);
 * it removes the tricks that let text masquerade as structure, and caps the length. The prompt treats the
 * result strictly as data inside <ticket> tags, and the rule guard (aiGuard.ts) bounds what any output can do.
 */
// Control characters, zero-width and bidi overrides, line/paragraph separators, BOM.
// eslint-disable-next-line no-control-regex -- stripping control characters is the point
const CONTROL = new RegExp('[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F\\u200B-\\u200F\\u2028-\\u202E\\u2060-\\u2064\\uFEFF]', 'g')
const FENCE = /<\/?\s*(ticket|system|assistant|user|instructions?)\b[^>]*>/gi

export function sanitizeForPrompt(text: string | undefined, max = 2_000): string {
  if (!text) return ''
  const clean = text.normalize('NFKC').replace(CONTROL, '').replace(FENCE, '[tag removed]').replace(/\n{3,}/g, '\n\n').trim()
  return clean.length > max ? `${clean.slice(0, max)} [truncated]` : clean
}

/** Phrases typical of prompt injection. Used to warn the reviewer, never to block the ticket. */
const SUSPICIOUS = /\b(ignore|disregard|forget)\b.{0,40}\b(previous|above|prior|all)\b.{0,20}\b(instructions?|rules|prompts?)\b|\byou are now\b|\bsystem prompt\b|\brespond with\b.{0,30}"?decision"?/i

export function looksLikeInjection(text: string | undefined): boolean {
  return !!text && SUSPICIOUS.test(text)
}
