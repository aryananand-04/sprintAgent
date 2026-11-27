// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
/**
 * Writes local Supabase credentials into .env.local (keeps any other keys you set).
 * Run after `npm run db:start`: npm run db:env
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const status = Object.fromEntries(
  execFileSync('npx', ['supabase', 'status', '-o', 'env'], { encoding: 'utf8' })
    .split('\n')
    .map((l) => l.match(/^([A-Z_]+)="?(.*?)"?$/))
    .filter((m): m is RegExpMatchArray => !!m)
    .map((m) => [m[1], m[2]]),
)

const wanted: Record<string, string | undefined> = {
  NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.PUBLISHABLE_KEY,
  SUPABASE_SECRET_KEY: status.SECRET_KEY,
  DATABASE_URL: status.DB_URL,
}

const lines = existsSync('.env.local') ? readFileSync('.env.local', 'utf8').split('\n') : []
for (const [k, v] of Object.entries(wanted)) {
  if (!v) throw new Error(`supabase status did not return a value for ${k} — is the stack running?`)
  const i = lines.findIndex((l) => l.startsWith(`${k}=`))
  if (i >= 0) lines[i] = `${k}=${v}`
  else lines.push(`${k}=${v}`)
}
writeFileSync('.env.local', lines.filter((l, i, a) => l || i < a.length - 1).join('\n') + '\n')
console.log('.env.local updated with local Supabase credentials')
