/** Only allow same-origin relative paths as post-login redirects (prevents open redirects). */
export function safeNext(next: string | null | undefined, fallback = '/app'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback
  try {
    const url = new URL(next, 'http://x')
    return url.origin === 'http://x' ? url.pathname + url.search + url.hash : fallback
  } catch {
    return fallback
  }
}
