// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
// Provenance: sprintagent-prov-7c1e94d2b85a
import { describe, it, expect } from 'vitest'
import { shadowDigest, type DigestPrediction } from './shadowDigest'

const p = (over: Partial<DigestPrediction> = {}): DigestPrediction => ({ taskType: 'bug', action: 'assign', agree: true, taskTitle: 'T', predictedName: 'Mei', actualName: 'Mei', ...over })

describe('shadowDigest', () => {
  it('no decisions this week: no digest', () => expect(shadowDigest([], [])).toBeNull())

  it('totals, per-kind lines with the distance to the next level, and where we differed', () => {
    const text = shadowDigest(
      [p(), p(), p({ taskType: 'feature' }), p({ taskType: 'feature', agree: false, taskTitle: 'Checkout <copy>', actualName: 'Dev' })],
      [{ taskType: 'bug', action: 'assign', earned: 3, cap: 3, n: 64, agree: 63 }, { taskType: 'feature', action: 'assign', earned: 1, cap: 1, n: 14, agree: 11 }],
    )!
    expect(text).toContain('Agreed with you 3 of 4 times (75%).')
    expect(text).toContain('• bug — assign work: 2/2. Act.')
    expect(text).toMatch(/• feature — assign work: 1\/2\. Suggest\. \d+ more agreeing decisions to Act with undo\./)
    expect(text).toContain('• “Checkout &lt;copy&gt;”: I\'d have picked Mei; you picked Dev.')
  })

  it('says when an admin capped an earned level', () => {
    expect(shadowDigest([p()], [{ taskType: 'bug', action: 'assign', earned: 3, cap: 1, n: 64, agree: 63 }])).toContain('(Earned Act, capped by an admin.)')
  })
})
