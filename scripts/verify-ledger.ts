// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
// Usage: npm run ledger:verify -- sprint-agent-decisions-<workspace>-<date>.json
import { readFileSync } from 'node:fs'
import { verifyLedger, type LedgerRow } from '../src/lib/ledger'

const file = process.argv[2]
if (!file) { console.error('Usage: npm run ledger:verify -- <export.json>'); process.exit(2) }
const { decisions } = JSON.parse(readFileSync(file, 'utf8')) as { decisions: LedgerRow[] }
const r = verifyLedger(decisions)
console.log(r.ok ? `Intact: ${r.checked} decisions, every hash matches.` : `Broken at decision ${r.brokenAt} (row ${r.checked}).`)
process.exit(r.ok ? 0 : 1)
