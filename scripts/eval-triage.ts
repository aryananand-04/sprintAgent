// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
/**
 * AI triage eval against the hand-labelled golden set.
 *   npm run eval:triage            (needs GROQ_API_KEY in env or .env.local)
 * Reports how often the raw model, the rules and the final guarded decision match the labels,
 * and writes reports/eval-triage.json. Exits 1 if the final decision agrees with labels < MIN_AGREEMENT.
 */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { GOLDEN_TRIAGE } from '../src/test/golden/triage'
import { DEFAULT_AUTONOMY_CONFIG } from '../src/logic/constants'
import { TriageRequest, runTriage, type TriageOutcome } from '../src/server/ai/triage'
import { groqCompleter } from '../src/server/llm'

const MIN_AGREEMENT = Number(process.env.MIN_AGREEMENT ?? 0.9)

if (!process.env.GROQ_API_KEY && existsSync('.env.local')) process.loadEnvFile('.env.local')
const key = process.env.GROQ_API_KEY
if (!key) { console.error('GROQ_API_KEY is not set; nothing to evaluate.'); process.exit(2) }

type Row = { id: string; expected: string } & ({ out: TriageOutcome } | { error: string })
const rows: Row[] = []
for (const g of GOLDEN_TRIAGE) {
  try {
    const out = await runTriage(TriageRequest.parse({ task: g.task, config: DEFAULT_AUTONOMY_CONFIG }), key, groqCompleter)
    rows.push({ id: g.id, expected: g.expected, out })
  } catch (e) {
    rows.push({ id: g.id, expected: g.expected, error: e instanceof Error ? e.message : String(e) })
  }
  await new Promise((r) => setTimeout(r, 300))
}

const ok = rows.filter((r): r is Row & { out: TriageOutcome } => 'out' in r)
const rate = (f: (r: (typeof ok)[number]) => boolean) => ok.length ? ok.filter(f).length / ok.length : 0
const summary = {
  cases: rows.length, answered: ok.length, errors: rows.length - ok.length,
  model: rate((r) => r.out.ai === r.expected),
  rules: rate((r) => r.out.rules === r.expected),
  final: rate((r) => r.out.decision === r.expected),
  overruled: ok.filter((r) => r.out.overruled).length,
  tooCautious: ok.filter((r) => r.out.decision !== r.expected && r.out.decision !== 'ACT').length,
}

console.table(rows.map((r) => 'out' in r
  ? { id: r.id, expected: r.expected, model: r.out.ai, rules: r.out.rules, final: r.out.decision, match: r.out.decision === r.expected ? 'yes' : 'NO' }
  : { id: r.id, expected: r.expected, model: 'error', rules: '', final: '', match: r.error }))
const pct = (n: number) => `${Math.round(n * 100)}%`
console.log(`Model ${pct(summary.model)} · rules ${pct(summary.rules)} · final ${pct(summary.final)} · overruled ${summary.overruled} · errors ${summary.errors}`)

mkdirSync('reports', { recursive: true })
writeFileSync('reports/eval-triage.json', JSON.stringify({ at: new Date().toISOString(), summary, rows }, null, 2))
process.exit(summary.answered && summary.final >= MIN_AGREEMENT ? 0 : 1)
