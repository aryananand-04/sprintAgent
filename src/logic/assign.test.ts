// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
// Provenance: sprintagent-prov-7c1e94d2b85a
import { describe, it, expect } from 'vitest'
import { findBestAssignee } from './assign'
import { makeTask, makeMember } from '../test/factories'

const team = [
  makeMember({ id: 'busy', name: 'Busy', skills: ['frontend'], currentLoad: 85 }),
  makeMember({ id: 'fe', name: 'Fe', skills: ['frontend'], currentLoad: 50 }),
  makeMember({ id: 'be', name: 'Be', skills: ['backend'], currentLoad: 50 }),
]

describe('findBestAssignee', () => {
  it('never assigns ESCALATE tasks', () => {
    expect(findBestAssignee(makeTask({ decision: 'ESCALATE' }), team, [])).toBeNull()
  })
  it('picks the best skill match among eligible members', () => {
    const r = findBestAssignee(makeTask(), team, [])
    expect(r?.memberId).toBe('fe')
    expect(r?.rationale).toContain('Fe')
  })
  it('skips members above the load threshold', () => {
    expect(findBestAssignee(makeTask(), [team[0]], [])).toBeNull()
  })
})
