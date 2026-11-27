// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { describe, it, expect } from 'vitest'
import { diffById, fieldsChanged } from './diff'
import { taskFromRow, taskToUpdate, taskToInsert, escalationFromRow, calibrationFromRows, daysRemaining } from './mappers'
import { makeTask } from '../../test/factories'
import type { Tables } from '@/db/database.types'

const row: Tables<'tasks'> = {
  id: 't1', workspace_id: 'w', sprint_id: 's', title: 'T', description: 'D', type: 'bug', status: 'done',
  urgency: 'high', impact: 4, effort: 2, risk: 2, clarity: 4, assignee_id: null, external_blockers: ['legal'],
  source: 'PM', external_ref: null, story_points: 3, tags: ['x'], decision: 'ACT', decision_reason: null,
  triage_score: 84, confidence: null, is_ai_triaged: true, is_ad_hoc: false, ad_hoc_resolution: null,
  ad_hoc_swapped_task_id: null, goal_alignment: null, acceptance_criteria: null,
  completed_at: '2026-11-02T00:00:00Z', created_by: null, created_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-01T00:00:00Z',
}

describe('task mapping', () => {
  it('maps a row to the domain, turning nulls into undefined', () => {
    const t = taskFromRow(row, ['t0'])
    expect(t).toMatchObject({ id: 't1', dependencies: ['t0'], externalBlockers: ['legal'], assigneeId: undefined, completedAt: '2026-11-02T00:00:00Z' })
    expect(t.decisionReason).toBeUndefined()
  })
  it('round-trips writable fields', () => {
    const upd = taskToUpdate(taskFromRow(row), 's')
    for (const [k, v] of Object.entries(upd)) expect(row[k as keyof typeof row]).toEqual(v)
  })
  it('never writes trigger-owned or identity columns on update', () => {
    const upd = taskToUpdate(makeTask(), null)
    expect(upd).not.toHaveProperty('completed_at')
    expect(upd).not.toHaveProperty('created_by')
    expect(upd).not.toHaveProperty('workspace_id')
  })
  it('stamps workspace and creator on insert', () => {
    expect(taskToInsert(makeTask({ id: 'n' }), 'w', 's', 'u')).toMatchObject({ id: 'n', workspace_id: 'w', sprint_id: 's', created_by: 'u' })
  })
})

describe('other mappers', () => {
  it('derives escalation resolved from resolved_at', () => {
    const base = { id: 'e', workspace_id: 'w', task_id: null, task_title: 't', reason: 'r', recommendation: 'x',
      urgency: 'high', category: 'blocker', resolved_by: null, resolution: null, created_at: 'now' } as const
    expect(escalationFromRow({ ...base, resolved_at: null }).resolved).toBe(false)
    expect(escalationFromRow({ ...base, resolved_at: 'then' }).resolved).toBe(true)
  })
  it('fills missing calibration rows with zeros', () => {
    expect(calibrationFromRows([{ workspace_id: 'w', decision: 'ACT', correct: 2, total: 3, updated_at: '' }])).toEqual({
      act: { correct: 2, total: 3 }, ask: { correct: 0, total: 0 }, escalate: { correct: 0, total: 0 },
    })
  })
  it('computes days remaining, never negative', () => {
    expect(daysRemaining('2026-11-10', Date.parse('2026-11-08T00:00:00Z'))).toBe(2)
    expect(daysRemaining('2026-11-01', Date.parse('2026-11-08T00:00:00Z'))).toBe(0)
  })
})

describe('diffById', () => {
  it('finds added and reference-changed items', () => {
    const a = { id: 'a' }, b = { id: 'b' }
    const b2 = { id: 'b' }, c = { id: 'c' }
    const d = diffById([a, b], [a, b2, c])
    expect(d.added).toEqual([c])
    expect(d.changed).toEqual([{ prev: b, next: b2 }])
  })
  it('ignores removals (deletes are explicit, never inferred)', () => {
    expect(diffById([{ id: 'a' }], [])).toEqual({ added: [], changed: [] })
  })
  it('fieldsChanged compares values deeply enough for arrays', () => {
    expect(fieldsChanged({ x: [1] }, { x: [1] }, ['x'])).toBe(false)
    expect(fieldsChanged({ x: [1] }, { x: [2] }, ['x'])).toBe(true)
  })
})
