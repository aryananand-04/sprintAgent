// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
// Provenance: sprintagent-prov-7c1e94d2b85a
import { describe, it, expect } from 'vitest'
import { isLinearClosed, linearIdentifier, linearIssueToTask, linearRef, type LinearIssue } from './linear'

const issue = (over: Partial<LinearIssue> = {}): LinearIssue => ({
  id: 'lin-1', identifier: 'ENG-12', title: 'Export times out', description: 'Steps: export 10k rows. Expected: CSV in 5s. Actual: 504.',
  url: 'https://linear.app/acme/issue/ENG-12/export-times-out', priority: 0, createdAt: '2026-11-01T00:00:00Z',
  state: { type: 'unstarted' }, team: { key: 'ENG' }, labels: { nodes: [{ name: 'Bug' }] }, ...over,
})

describe('linearIssueToTask', () => {
  it('maps and triages', () => {
    const t = linearIssueToTask(issue(), 'id-1')
    expect(t).toMatchObject({ id: 'id-1', title: 'ENG-12: Export times out', type: 'bug', status: 'backlog', source: 'Linear / ENG', externalRef: 'https://linear.app/acme/issue/ENG-12', tags: ['Bug'] })
    expect(t.decision).toBeDefined()
  })
  it('Linear priority wins; "no priority" falls back to text', () => {
    expect(linearIssueToTask(issue({ priority: 1 }), 'x').urgency).toBe('critical')
    expect(linearIssueToTask(issue({ priority: 4 }), 'x').urgency).toBe('low')
    expect(linearIssueToTask(issue({ priority: 0, title: 'Minor typo', description: '', labels: [] }), 'x').urgency).toBe('low')
  })
  it('webhook label arrays and missing team work too', () => {
    expect(linearIssueToTask(issue({ labels: [{ name: 'design' }], team: null }), 'x')).toMatchObject({ type: 'design', source: 'Linear / ENG' })
  })
  it('completed and canceled are done', () => {
    expect(isLinearClosed({ state: { type: 'completed' } })).toBe(true)
    expect(isLinearClosed({ state: { type: 'canceled' } })).toBe(true)
    expect(isLinearClosed({ state: { type: 'started' } })).toBe(false)
    expect(linearIssueToTask(issue({ state: { type: 'completed' } }), 'x').status).toBe('done')
  })
  it('stores a slug-free reference, so renaming an issue doesn’t orphan its task', () => {
    expect(linearRef('https://linear.app/acme/issue/ENG-12/export-times-out')).toBe('https://linear.app/acme/issue/ENG-12')
    expect(linearRef('https://linear.app/acme/issue/ENG-12/renamed-later')).toBe('https://linear.app/acme/issue/ENG-12')
    expect(linearRef('https://github.com/o/r/issues/1')).toBeNull()
    expect(linearRef(null)).toBeNull()
    expect(linearIdentifier('https://linear.app/acme/issue/ENG-12')).toBe('ENG-12')
  })
})
