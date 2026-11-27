// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import type { NextConfig } from 'next'
import { execSync } from 'node:child_process'

// Build fingerprint exposed as <meta name="sa-build">: Vercel/CI commit, else local git, else 'dev'.
const buildSha = (() => {
  const env = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA
  if (env) return env.slice(0, 12)
  try { return execSync('git rev-parse --short=12 HEAD', { encoding: 'utf8' }).trim() } catch { return 'dev' }
})()

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  env: { NEXT_PUBLIC_BUILD_SHA: buildSha },
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }]
  },
}

export default config
