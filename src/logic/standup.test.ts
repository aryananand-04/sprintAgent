// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
// Provenance: sprintagent-prov-7c1e94d2b85a
import { describe, it, expect } from 'vitest'
import { generateStandupText, isTimeZone, standupDue } from './standup'
import { makeMember, makeSprint, makeTask } from '../test/factories'
import type { EscalationItem } from '../types'

describe('standupDue', () => {
  const at = (iso: string) => new Date(iso)
  it('is due from 9am local, keyed by the local day', () => {
    expect(standupDue(at('2026-11-30T08:59:00Z'), 'UTC')).toEqual({ due: false, day: '2026-11-30' })
    expect(standupDue(at('2026-11-30T09:00:00Z'), 'UTC')).toEqual({ due: true, day: '2026-11-30' })
  })
  it('uses the workspace zone, across the date line', () => {
    // 17:00 UTC on the 30th is 09:00 on the 30th in Los Angeles (PST, UTC−8)
    expect(standupDue(at('2026-11-30T16:59:00Z'), 'America/Los_Angeles').due).toBe(false)
    expect(standupDue(at('2026-11-30T17:00:00Z'), 'America/Los_Angeles')).toEqual({ due: true, day: '2026-11-30' })
    // 22:00 UTC on the 30th is already 09:00 on 1 Dec in Sydney (AEDT, UTC+11)
    expect(standupDue(at('2026-11-30T22:00:00Z'), 'Australia/Sydney')).toEqual({ due: true, day: '2026-12-01' })
  })
  it('treats an unknown zone as UTC', () => {
    expect(standupDue(at('2026-11-30T09:30:00Z'), 'Mars/Olympus')).toEqual({ due: true, day: '2026-11-30' })
  })
})

describe('isTimeZone', () => {
  it('knows IANA zones and rejects junk', () => {
    expect(isTimeZone('Asia/Kolkata')).toBe(true)
    expect(isTimeZone('')).toBe(false)
    expect(isTimeZone('Mars/Olympus')).toBe(false)
  })
})

describe('generateStandupText', () => {
  const now = new Date('2026-11-30T09:00:00Z')
  const esc: EscalationItem = { id: 'e', taskId: 't', taskTitle: 'PAY-1: Refund flow', reason: 'r', recommendation: 'Decide on partial refunds before Friday', urgency: 'high', category: 'scope-conflict', createdAt: now.toISOString(), resolved: false }

  it('summarises people, health and open decisions', () => {
    const text = generateStandupText(
      [makeTask({ id: 'a', title: 'API-2: Rate limit', assigneeId: 'm-1', status: 'in-progress' }), makeTask({ id: 'b', title: 'API-3: Cache', status: 'blocked' })],
      [makeMember(), makeMember({ id: 'm-2', name: 'Lin' })],
      makeSprint(), [esc], now, 'UTC',
    )
    expect(text).toContain('Monday, Nov 30')
    expect(text).toContain('50% complete')
    expect(text).toContain('In progress: API-2')
    expect(text).toContain('No active tasks')
    expect(text).toContain('1 task blocked')
    expect(text).toContain('→ PAY-1: Decide on partial refunds')
  })
  it('an empty sprint reads 0%, not NaN%', () => {
    expect(generateStandupText([], [], makeSprint({ committedPoints: 0, completedPoints: 0 }), [], now)).toContain('0% complete')
  })
})
