// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
// Provenance: sprintagent-prov-7c1e94d2b85a
import { describe, it, expect } from 'vitest'
import { adfToText, jiraIssueToTask, jiraLabelUpdate, jiraType, jiraUrgency, parseJiraRef, stripHtml, textToAdf, type JiraIssue } from './jira'

const adf = { type: 'doc', content: [
  { type: 'paragraph', content: [{ type: 'text', text: 'Steps: export 10k rows.' }, { type: 'hardBreak' }, { type: 'text', text: 'Expected: CSV in 5s.' }] },
  { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Actual: 504' }] }] }] },
  { type: 'paragraph', content: [{ type: 'mention', attrs: { text: '@Mei' } }] },
] }
const issue = (over: Partial<JiraIssue['fields']> = {}): JiraIssue => ({
  id: '10001', key: 'PAY-12',
  fields: { summary: 'Export times out', description: adf, labels: ['backend'], priority: { name: 'High' }, status: { statusCategory: { key: 'new' } }, issuetype: { name: 'Bug' }, created: '2026-11-01T00:00:00.000+0000', project: { key: 'PAY' }, ...over },
})

describe('ADF', () => {
  it('reads text, breaks, lists and mentions', () => {
    expect(adfToText(adf)).toBe('Steps: export 10k rows.\nExpected: CSV in 5s.\nActual: 504\n@Mei')
    expect(adfToText('wiki *text*')).toBe('wiki *text*')
    expect(adfToText(null)).toBe('')
  })
  it('writes paragraphs and hard breaks', () => {
    const doc = textToAdf('one\ntwo\n\nthree')
    expect(doc.content).toHaveLength(2)
    expect(adfToText(doc)).toBe('one\ntwo\nthree')
  })
})

describe('jiraIssueToTask', () => {
  it('maps fields and triages', () => {
    const t = jiraIssueToTask(issue(), 'https://acme.atlassian.net', 'id-1')
    expect(t).toMatchObject({ id: 'id-1', title: 'PAY-12: Export times out', type: 'bug', urgency: 'high', status: 'backlog', source: 'Jira / PAY', externalRef: 'https://acme.atlassian.net/browse/PAY-12' })
    expect(t.description).toContain('Expected: CSV in 5s.')
    expect(t.decision).toBeDefined()
  })
  it('done status category is done', () => {
    expect(jiraIssueToTask(issue({ status: { statusCategory: { key: 'done' } } }), 'https://acme.atlassian.net', 'x').status).toBe('done')
  })
  it('priority and type names', () => {
    expect([jiraUrgency('Highest'), jiraUrgency('Blocker'), jiraUrgency('Medium'), jiraUrgency('Lowest'), jiraUrgency('P9'), jiraUrgency(undefined)]).toEqual(['critical', 'critical', 'medium', 'low', null, null])
    expect([jiraType('Story'), jiraType('Task'), jiraType('Spike'), jiraType(undefined)]).toEqual(['feature', null, 'spike', null])
  })
})

describe('refs and labels', () => {
  it('parses our stored issue URLs only', () => {
    expect(parseJiraRef('https://acme.atlassian.net/browse/PAY-12')).toEqual({ site: 'https://acme.atlassian.net', key: 'PAY-12' })
    expect(parseJiraRef('https://evil.example/browse/PAY-12')).toBeNull()
    expect(parseJiraRef(null)).toBeNull()
  })
  it('leaves exactly one decision label', () => {
    expect(jiraLabelUpdate('ASK')).toEqual([{ remove: 'sprint-agent-ACT' }, { add: 'sprint-agent-ASK' }, { remove: 'sprint-agent-ESCALATE' }])
  })
  it('strips HTML footers for Jira', () => expect(stripHtml('Q?\n\n<sub>Asked by Sprint Agent</sub>')).toBe('Q?\n\nAsked by Sprint Agent'))
})
