// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
// Provenance: sprintagent-prov-7c1e94d2b85a
import { describe, it, expect } from 'vitest'
import { triageTask } from './triage'
import { GOLDEN_TRIAGE } from '../test/golden/triage'

// The rule engine is the floor the AI is measured against, so it must match every human label.
describe('golden set: rules', () => {
  it.each(GOLDEN_TRIAGE.map((g) => [g.id, g] as const))('%s', (_id, g) => {
    expect(triageTask(g.task).decision, g.why).toBe(g.expected)
  })
})
