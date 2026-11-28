// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
// Provenance: sprintagent-prov-7c1e94d2b85a
import { describe, it, expect } from 'vitest'
import { personalBriefing } from './personalBriefing'
import { makeTask } from '../test/factories'

const sprint = { name: 'Sprint 23', daysRemaining: 1 }
const base = { name: 'Mei Lin', sprint, assigned: [], waitingOnThem: [], openEscalations: 0 }

describe('personalBriefing', () => {
  it('nothing for them: no DM', () => expect(personalBriefing(base)).toBeNull())

  it('blocked first, then doing, then next; questions and decisions after', () => {
    const text = personalBriefing({
      ...base,
      assigned: [makeTask({ id: 'a', title: 'API-1: Cache', status: 'assigned' }), makeTask({ id: 'b', title: 'API-2: Limits', status: 'in-progress' }), makeTask({ id: 'c', title: 'API-3: <Auth>', status: 'blocked' }), makeTask({ id: 'd', status: 'done' })],
      waitingOnThem: [{ task: makeTask({ title: 'Make it nicer' }), question: 'Which page?' }],
      openEscalations: 2,
    })!
    expect(text.startsWith('Morning, Mei. Sprint 23, 1 day left.')).toBe(true)
    const order = ['*Blocked*', '*In progress*', '*Up next*', '*Waiting on your answer*', '*2 escalations need a decision.*'].map((s) => text.indexOf(s))
    expect(order.every((i, k) => i >= 0 && (k === 0 || i > order[k - 1]))).toBe(true)
    expect(text).toContain('• API-3: &lt;Auth&gt;')
    expect(text).toContain('• Make it nicer: Which page?')
    expect(text).not.toContain('Fix login button') // done work isn't listed
  })

  it('caps long lists and long titles', () => {
    const many = Array.from({ length: 7 }, (_, i) => makeTask({ id: `t${i}`, status: 'assigned', title: i === 0 ? 'x'.repeat(120) : `T${i}` }))
    const text = personalBriefing({ ...base, assigned: many, openEscalations: 1 })!
    expect(text).toContain('• and 2 more')
    expect(text).toContain(`${'x'.repeat(89)}…`)
    expect(text).toContain('*1 escalation needs a decision.*')
  })
})
