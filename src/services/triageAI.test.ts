// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
// Provenance: sprintagent-prov-7c1e94d2b85a
import { describe, it, expect } from 'vitest'
import { parseResult } from './triageAI'

const valid = {
  decision: 'ACT',
  score: 72,
  reason: 'Clear bug with repro steps.',
  dimensions: { urgency: 4, impact: 3, effort: 2, risk: 2, clarity: 5 },
}

describe('parseResult', () => {
  it('accepts valid JSON wrapped in prose', () => {
    expect(parseResult(`Sure!\n${JSON.stringify(valid)}\nDone`)).toEqual(valid)
  })
  it.each([
    ['unknown decision', { ...valid, decision: 'MAYBE' }],
    ['score out of range', { ...valid, score: 150 }],
    ['dimension out of range', { ...valid, dimensions: { ...valid.dimensions, risk: 9 } }],
    ['missing dimensions', { ...valid, dimensions: undefined }],
  ])('rejects %s', (_n, bad) => {
    expect(() => parseResult(JSON.stringify(bad))).toThrow()
  })
  it('rejects responses without JSON', () => {
    expect(() => parseResult('no json here')).toThrow('NO_JSON')
  })
})
