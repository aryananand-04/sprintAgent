// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
// Provenance: sprintagent-prov-7c1e94d2b85a
import { describe, it, expect } from 'vitest'
import { issueToTask, nextPageUrl, isPullRequest, parseIssueUrl, askComment, isHumanAnswer, retriageWithAnswer, type GhIssue, type GhComment } from './github'

const issue = (over: Partial<GhIssue> = {}): GhIssue => ({
  number: 42, title: 'Login fails on Safari', body: 'Steps to reproduce: open /login in Safari 17, click Sign in. Expected: redirect. Actual: nothing.',
  html_url: 'https://github.com/o/r/issues/42', state: 'open', labels: [], created_at: '2026-11-01T00:00:00Z', ...over,
})

describe('nextPageUrl', () => {
  it('finds rel="next"', () => {
    expect(nextPageUrl('<https://api.github.com/x?page=2>; rel="next", <https://api.github.com/x?page=9>; rel="last"')).toBe('https://api.github.com/x?page=2')
  })
  it('returns null on the last page', () => {
    expect(nextPageUrl('<https://api.github.com/x?page=1>; rel="prev"')).toBeNull()
    expect(nextPageUrl(null)).toBeNull()
  })
})

describe('issueToTask', () => {
  it('maps and triages a clear bug', () => {
    const t = issueToTask(issue(), 'o/r', 'id-1')
    expect(t).toMatchObject({ id: 'id-1', title: '#42: Login fails on Safari', type: 'bug', status: 'backlog', externalRef: 'https://github.com/o/r/issues/42', source: 'GitHub / o/r' })
    expect(t.decision).toBeDefined()
  })
  it('lets repo labels decide type and urgency', () => {
    const t = issueToTask(issue({ title: 'Make it nicer', body: '', labels: [{ name: 'enhancement' }, 'P0'] }), 'o/r', 'x')
    expect(t).toMatchObject({ type: 'feature', urgency: 'critical' })
  })
  it('a vague one-liner is not ACT', () => {
    expect(issueToTask(issue({ title: 'fix it', body: null }), 'o/r', 'x').decision).not.toBe('ACT')
  })
  it('closed issues arrive done', () => {
    expect(issueToTask(issue({ state: 'closed' }), 'o/r', 'x').status).toBe('done')
  })
  it('recognises pull requests', () => {
    expect(isPullRequest(issue({ pull_request: {} }))).toBe(true)
    expect(isPullRequest(issue())).toBe(false)
  })
})

describe('parseIssueUrl', () => {
  it('parses issue URLs and rejects others', () => {
    expect(parseIssueUrl('https://github.com/o.rg/re-po/issues/12')).toEqual({ owner: 'o.rg', repo: 're-po', number: 12 })
    expect(parseIssueUrl('https://github.com/o/r/pull/12')).toBeNull()
    expect(parseIssueUrl('https://evil.com/o/r/issues/1')).toBeNull()
    expect(parseIssueUrl(undefined)).toBeNull()
  })
})

describe('askComment', () => {
  it('includes the question and an attribution line', () => {
    expect(askComment('What does done look like?')).toMatch(/^What does done look like\?\n\n<sub>Asked by Sprint Agent/)
  })
})

describe('isHumanAnswer', () => {
  const c = (over: Partial<GhComment> = {}): GhComment => ({ id: 1, body: 'Expected: the export finishes under 5s.', user: { login: 'mei', type: 'User' }, ...over })
  it('accepts a person', () => expect(isHumanAnswer(c())).toBe(true))
  it('ignores bots, apps, empty bodies and our own question', () => {
    expect(isHumanAnswer(c({ user: { login: 'ci[bot]', type: 'Bot' } }))).toBe(false)
    expect(isHumanAnswer(c({ performed_via_github_app: { id: 1 } }))).toBe(false)
    expect(isHumanAnswer(c({ body: '   ' }))).toBe(false)
    expect(isHumanAnswer(c({ user: null }))).toBe(false)
    expect(isHumanAnswer(c({ body: askComment('What does done look like?') }))).toBe(false)
  })
})

describe('retriageWithAnswer', () => {
  const vague = issueToTask(issue({ title: 'Make it nicer', body: 'the settings page feels off', labels: ['enhancement'] }), 'o/r', 'x')
  it('a concrete answer lifts clarity and can clear the ASK', () => {
    expect(vague.decision).toBe('ASK')
    const r = retriageWithAnswer(vague, 'Done when the chart labels no longer overlap at 1280px. Expected: 12px gap, see screenshot in #41.')
    expect(r).not.toBeNull()
    expect(r!.clarity).toBeGreaterThan(vague.clarity)
    expect(r!.decision).not.toBe('ASK')
    expect(r!.reason).toBeTruthy()
  })
  it('an unhelpful reply never lowers clarity and changes nothing', () => {
    expect(retriageWithAnswer(vague, 'idk')).toBeNull()
  })
})
