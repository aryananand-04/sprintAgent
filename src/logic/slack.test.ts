// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
// Provenance: sprintagent-prov-7c1e94d2b85a
import { describe, it, expect } from 'vitest'
import { ANSWER_ACTION, ANSWER_BLOCK, ANSWER_INPUT, ANSWER_VIEW, RESOLVE_ACTION, answerModal, answerOutcome, withAnswerButtons, ephemeral, escalationMessage, intakeReply, resolvedMessage, slackEscape, slackToPlain } from './slack'

const e = { taskTitle: 'Refunds', reason: '<!channel> & co', recommendation: '', urgency: 'high' as const, escalationId: '00000000-0000-4000-8000-000000000001' }
const actions = (m: { blocks: unknown[] }) => m.blocks.find((b) => (b as { type: string }).type === 'actions') as { elements: Array<{ action_id: string; value?: string; url?: string }> } | undefined

describe('slackEscape', () => {
  it('neutralises mentions and links', () => expect(slackEscape('<!here> <http://x|y> &')).toBe('&lt;!here&gt; &lt;http://x|y&gt; &amp;'))
})

describe('escalationMessage', () => {
  it('plain: escaped text and a link, no buttons', () => {
    const m = escalationMessage(e, { appUrl: 'https://app.example/app' })
    const s = JSON.stringify(m)
    expect(s).toContain('&lt;!channel&gt; &amp; co')
    expect(s).toContain('<https://app.example/app|Open in Sprint Agent>')
    expect(actions(m)).toBeUndefined()
  })
  it('interactive: a Resolve button carrying the escalation id, plus Open', () => {
    const a = actions(escalationMessage(e, { appUrl: 'https://app.example/app', interactive: true }))!
    expect(a.elements.map((x) => x.action_id)).toEqual([RESOLVE_ACTION, 'esc_open'])
    expect(a.elements[0].value).toBe(e.escalationId)
  })
  it('interactive without an id stays plain', () => {
    expect(actions(escalationMessage({ ...e, escalationId: undefined }, { interactive: true }))).toBeUndefined()
  })
})

describe('replies', () => {
  it('resolved replaces the original and names who decided', () => {
    const r = resolvedMessage('A <b>', 'U123')
    expect(r.replace_original).toBe(true)
    expect(r.text).toBe('Resolved by <@U123>: A &lt;b&gt;. The agent may proceed.')
  })
  it('ephemeral is only for the clicker', () => expect(ephemeral('x')).toMatchObject({ response_type: 'ephemeral', replace_original: false }))
})

describe('slackToPlain', () => {
  it('cleans Slack markup', () => {
    expect(slackToPlain('<@U0BOT> checkout fails, see <https://x.io/1|PAY-12> &amp; <https://y.io> &lt;3')).toBe('checkout fails, see PAY-12 & https://y.io <3')
    expect(slackToPlain('<!here>   ')).toBe('')
  })
})

describe('intakeReply', () => {
  it('says what happened, one line each', () => {
    expect(intakeReply({ title: 'A', decision: 'ACT', assigneeName: 'Mei' })).toBe('Added “A”. Clear enough to start, so it’s with Mei.')
    expect(intakeReply({ title: 'A', decision: 'ACT' })).toMatch(/Nobody has room right now/)
    expect(intakeReply({ title: 'A', decision: 'ASK', question: 'Which page?' })).toBe('Added “A”. One question before anyone starts: Which page?')
    expect(intakeReply({ title: 'A', decision: 'ESCALATE' })).toMatch(/escalated/)
    expect(intakeReply({ title: '<b>', decision: null })).toBe('Added “&lt;b&gt;” to the backlog. It’ll be triaged on the next pass.')
  })
})

describe('answering ASK from Slack', () => {
  it('buttons carry the task id, five at most, labels capped', () => {
    const m = withAnswerButtons('hi', Array.from({ length: 7 }, (_, i) => ({ taskId: `t${i}`, label: `Answer: ${'x'.repeat(100)}` })))
    const a = m.blocks![1] as { elements: Array<{ action_id: string; value: string; text: { text: string } }> }
    expect(a.elements).toHaveLength(5)
    expect(a.elements[0]).toMatchObject({ action_id: ANSWER_ACTION, value: 't0' })
    expect(a.elements[0].text.text.length).toBe(75)
    expect(withAnswerButtons('plain', [])).toEqual({ text: 'plain' })
  })
  it('the modal shows the question and carries the ticket id', () => {
    const v = answerModal({ taskId: 'task-9', title: 'Make <it> nicer', question: 'Which page?' })
    expect(v).toMatchObject({ callback_id: ANSWER_VIEW, private_metadata: 'task-9' })
    expect(JSON.stringify(v.blocks[0])).toContain('Make &lt;it&gt; nicer')
    expect(v.blocks[1]).toMatchObject({ block_id: ANSWER_BLOCK, element: { action_id: ANSWER_INPUT } })
  })
  it('the outcome says what changed', () => {
    expect(answerOutcome({ title: 'A', decision: 'ACT' })).toBe('Thanks. “A” is clear enough to start now.')
    expect(answerOutcome({ title: 'A', decision: 'ESCALATE' })).toMatch(/PM’s decision/)
    expect(answerOutcome({ title: 'A', decision: 'ASK', question: 'Which page?' })).toMatch(/still needs a little more before anyone starts: Which page\?$/)
  })
})
