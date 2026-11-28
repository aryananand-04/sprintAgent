// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
// Provenance: sprintagent-prov-7c1e94d2b85a
import { describe, it, expect } from 'vitest'
import { needsTriage, planTriageSteps, triageSummary, type TriageOutcome } from './backlogTriage'
import { makeMember, makeTask } from '../test/factories'

const out = (decision: TriageOutcome['decision']): TriageOutcome => ({ decision, reason: `because ${decision}`, score: 50 })

describe('needsTriage', () => {
  it('only untriaged backlog work', () => {
    expect(needsTriage(makeTask())).toBe(true)
    expect(needsTriage(makeTask({ decision: 'ASK' }))).toBe(false)
    expect(needsTriage(makeTask({ status: 'in-progress' }))).toBe(false)
  })
})

describe('planTriageSteps', () => {
  const team = [makeMember({ id: 'a', skills: ['frontend', 'bug'], capacity: 4 }), makeMember({ id: 'b', skills: ['frontend', 'bug'], capacity: 4 })]

  it('ACT gets an owner, and each assignment counts towards the next', () => {
    const t1 = makeTask({ id: 't1', storyPoints: 4 }), t2 = makeTask({ id: 't2', storyPoints: 4 })
    const steps = planTriageSteps([{ task: t1, outcome: out('ACT') }, { task: t2, outcome: out('ACT') }], [t1, t2], team)
    expect(steps.map((s) => s.assign?.memberId).sort()).toEqual(['a', 'b'])
    expect(steps[0].assign!.rationale).toBeTruthy()
  })
  it('leaves already-owned ACT work alone', () => {
    const t = makeTask({ assigneeId: 'a' })
    expect(planTriageSteps([{ task: t, outcome: out('ACT') }], [t], team)[0].assign).toBeUndefined()
  })
  it('ESCALATE picks a category; ASK does nothing else', () => {
    const vague = makeTask({ id: 'v', clarity: 1 }), risky = makeTask({ id: 'r', risk: 5 }), other = makeTask({ id: 'o' })
    const steps = planTriageSteps(
      [{ task: vague, outcome: out('ESCALATE') }, { task: risky, outcome: out('ESCALATE') }, { task: other, outcome: out('ESCALATE') }, { task: other, outcome: out('ASK') }],
      [vague, risky, other], team,
    )
    expect(steps.map((s) => s.escalation?.category)).toEqual(['missing-criteria', 'blocker', 'ambiguous', undefined])
    expect(steps[3].assign).toBeUndefined()
  })
  it('nobody eligible: ACT stays unassigned', () => {
    const t = makeTask(), busy = makeTask({ id: 'busy', assigneeId: 'm-1', status: 'in-progress', storyPoints: 8 })
    expect(planTriageSteps([{ task: t, outcome: out('ACT') }], [t, busy], [makeMember({ capacity: 2 })])[0].assign).toBeUndefined()
  })
})

describe('triageSummary', () => {
  it('counts by decision', () => {
    const t = makeTask()
    expect(triageSummary([])).toBeNull()
    expect(triageSummary([{ taskId: t.id, outcome: out('ACT') }])).toBe('Triaged 1 new ticket: 1 ACT.')
    expect(triageSummary([{ taskId: 'x', outcome: out('ACT') }, { taskId: 'y', outcome: out('ESCALATE') }, { taskId: 'z', outcome: out('ACT') }]))
      .toBe('Triaged 3 new tickets: 2 ACT, 1 ESCALATE.')
  })
})
