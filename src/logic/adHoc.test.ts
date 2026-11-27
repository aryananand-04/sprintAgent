// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
// Provenance: sprintagent-prov-7c1e94d2b85a
import { describe, it, expect } from 'vitest'
import { resolveAdHoc } from './adHoc'
import { makeTask, makeMember, makeSprint } from '../test/factories'

const sprint = makeSprint() // buffer = 50 - 40 = 10
const team = [makeMember()]

describe('resolveAdHoc', () => {
  it('escalates scope-breaking effort', () => {
    expect(resolveAdHoc(makeTask({ effort: 5 }), sprint, team, []).resolution).toBe('escalate')
  })
  it('escalates low clarity', () => {
    expect(resolveAdHoc(makeTask({ clarity: 2 }), sprint, team, []).resolution).toBe('escalate')
  })
  it('absorbs small work that fits the buffer', () => {
    const r = resolveAdHoc(makeTask({ storyPoints: 3 }), sprint, team, [])
    expect(r).toMatchObject({ resolution: 'absorb', assigneeId: 'm-1' })
  })
  it('swaps out the lowest-scored low-urgency backlog item', () => {
    const backlog = [
      makeTask({ id: 'a', urgency: 'low', triageScore: 40 }),
      makeTask({ id: 'b', urgency: 'low', triageScore: 20 }),
      makeTask({ id: 'c', urgency: 'high', triageScore: 5 }),
    ]
    const r = resolveAdHoc(makeTask({ id: 'new', storyPoints: 8 }), sprint, team, backlog)
    expect(r).toMatchObject({ resolution: 'swap', swapCandidateId: 'b' })
  })
  it('escalates when nothing can be absorbed or swapped', () => {
    expect(resolveAdHoc(makeTask({ storyPoints: 8 }), sprint, team, []).resolution).toBe('escalate')
  })
})
