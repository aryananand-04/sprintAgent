// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
/**
 * Adds or checks SPDX headers on first-party source files.
 *   npm run spdx        add missing headers
 *   npm run spdx:check  fail if any are missing (CI)
 * Files under src/logic also carry the provenance canary, which the
 * canary-watch workflow searches for on GitHub.
 */
import { execSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { CANARY } from '../src/lib/provenance'

const ID = 'SPDX-License-Identifier: FSL-1.1-ALv2'
const OWNER = 'SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand'

// Generated files are rewritten by tools and checked for drift in CI, so they stay untouched.
const SKIP = [/^supabase\/(migrations|seed\.sql)/, /^src\/db\/database\.types\.ts$/, /^next-env\.d\.ts$/]
const EXT = /\.(tsx?|mjs|js|css|sql)$/

const comment = (file: string, lines: string[]) =>
  file.endsWith('.css') ? `/* ${lines.join('\n   ')} */\n` : file.endsWith('.sql') ? lines.map((l) => `-- ${l}\n`).join('') : lines.map((l) => `// ${l}\n`).join('')

function linesFor(file: string) {
  return file.startsWith('src/logic/') ? [ID, OWNER, `Provenance: ${CANARY}`] : [ID, OWNER]
}

const files = execSync('git ls-files --cached --others --exclude-standard', { encoding: 'utf8' })
  .split('\n').filter((f) => EXT.test(f) && !SKIP.some((r) => r.test(f)) && existsSync(f)) // deleted but not yet committed

const check = process.argv.includes('--check')
const missing: string[] = []
for (const file of files) {
  const src = readFileSync(file, 'utf8')
  const head = src.slice(0, 400)
  const needCanary = file.startsWith('src/logic/') && !head.includes(CANARY)
  if (head.includes(ID) && head.includes(OWNER) && !needCanary) continue
  missing.push(file)
  if (!check && !head.includes(ID)) writeFileSync(file, comment(file, linesFor(file)) + src)
}

if (check && missing.length) {
  console.error(`Missing SPDX header in ${missing.length} file(s) (run npm run spdx):\n  ${missing.join('\n  ')}`)
  process.exit(1)
}
console.log(check ? `SPDX headers OK (${files.length} files)` : `Added headers to ${missing.length} file(s)`)
