// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { describe, it, expect } from 'vitest'
import { triageIssues, summarize } from './triageIssues'

const issue = (n: number, title: string, body = '', extra = {}) => ({ number: n, title, body, html_url: `https://github.com/o/r/issues/${n}`, labels: [], ...extra })

describe('triageIssues', () => {
  it('skips pull requests and sorts by score', () => {
    const out = triageIssues([
      issue(1, 'make it nicer'),
      issue(2, 'Crash on login when password has emoji', 'Steps to reproduce: 1. type 🙂 2. submit. Expected: login. Actual: 500. Affects users.'),
      issue(3, 'PR', '', { pull_request: {} }),
    ])
    expect(out.map((i) => i.number)).toEqual([2, 1])
    expect(out[0].decision).toBe('ACT')
    expect(out[1].question).toBeTruthy()
  })
  it('accepts labels given as strings or objects', () => {
    expect(() => triageIssues([issue(4, 'bug', '', { labels: ['bug', { name: 'p0' }] })])).not.toThrow()
  })
  it('summarises an empty backlog honestly', () => {
    expect(summarize([])).toMatch(/Zero open issues/)
  })
})
