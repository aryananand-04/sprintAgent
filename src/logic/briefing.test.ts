// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
// Provenance: sprintagent-prov-7c1e94d2b85a
import { describe, it, expect } from 'vitest'
import { generateBriefings } from './briefing'
import { makeTask, makeMember, makeSprint } from '../test/factories'
import type { EscalationItem } from '../types'

const esc = (id: string, resolved = false) => ({ id, taskId: id, taskTitle: `Task ${id}: detail`, resolved }) as unknown as EscalationItem
const sev = (views: ReturnType<typeof generateBriefings>, type: string, label: string) =>
  views.find((v) => v.type === type)!.items.find((i) => i.label === label)?.severity

describe('generateBriefings', () => {
  it('returns one brief per audience', () => {
    const views = generateBriefings([], [], makeSprint(), [])
    expect(views.map((v) => v.type)).toEqual(['team', 'pm', 'manager'])
  })

  it('reports a calm sprint as ok everywhere', () => {
    const views = generateBriefings([makeTask({ status: 'done' })], [makeMember({ currentLoad: 40 })], makeSprint({ completedPoints: 36, velocity: 60, daysRemaining: 8 }), [])
    for (const v of views) for (const i of v.items) if (i.severity) expect(i.severity).toBe('ok')
  })

  it('escalates severity when the sprint is in trouble', () => {
    const tasks = [
      ...Array.from({ length: 6 }, (_, i) => makeTask({ id: `p${i}`, status: 'in-progress', assigneeId: 'm-1' })),
      makeTask({ id: 'b1', status: 'blocked', title: 'Auth: SSO' }),
      makeTask({ id: 'b2', status: 'blocked', title: 'Promo: codes' }),
      makeTask({ id: 'x', status: 'backlog', decision: 'ESCALATE' }),
    ]
    const team = [makeMember({ currentLoad: 95 }), makeMember({ id: 'm-2', name: 'Ana Ruiz', currentLoad: 90 })]
    const views = generateBriefings(tasks, team, makeSprint({ health: 'red', completedPoints: 4, daysRemaining: 1, velocity: 30 }), [esc('1'), esc('2'), esc('3'), esc('4', true)])
    expect(sev(views, 'pm', 'Open Escalations')).toBe('critical')
    expect(sev(views, 'manager', 'Team Health')).toBe('critical')
    expect(views[2].summary).toContain('Biggest risk: Auth is blocked')
    expect(views[0].summary).toContain('3 items need PM attention')
  })

  it('counts real escalations for an at-risk sprint (no hard-coded numbers)', () => {
    const views = generateBriefings([], [], makeSprint({ health: 'yellow', completedPoints: 18 }), [esc('1')])
    expect(JSON.stringify(views)).toContain('1 escalation need')
    expect(sev(views, 'manager', 'Team Health')).toBe('ok')
  })

  it('never divides by zero on an empty sprint', () => {
    const views = generateBriefings([], [], makeSprint({ committedPoints: 0, completedPoints: 0 }), [])
    expect(JSON.stringify(views)).not.toMatch(/NaN|Infinity/)
  })
})
