// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
// Provenance: sprintagent-prov-7c1e94d2b85a
import { describe, it, expect } from 'vitest'
import { AUTONOMY_RULES } from './autonomy'

describe('AUTONOMY_RULES', () => {
  it('has unique ids and covers every lane', () => {
    expect(new Set(AUTONOMY_RULES.map((r) => r.id)).size).toBe(AUTONOMY_RULES.length)
    expect(new Set(AUTONOMY_RULES.map((r) => r.category))).toEqual(new Set(['ACT', 'ASK', 'ESCALATE']))
  })
  it('explains every rule with an example', () => {
    for (const r of AUTONOMY_RULES) {
      expect(r.condition.length).toBeGreaterThan(10)
      expect(r.rationale.length).toBeGreaterThan(10)
      expect(r.examples.length).toBeGreaterThan(0)
    }
  })
})
