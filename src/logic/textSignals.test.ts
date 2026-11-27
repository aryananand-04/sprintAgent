import { describe, it, expect } from 'vitest'
import { analyzeRequest } from './textSignals'
import { triageTask } from './triage'
import { makeTask } from '../test/factories'

const decide = (text: string) => triageTask(makeTask({ ...analyzeRequest(text).task, dependencies: [] })).decision

describe('analyzeRequest', () => {
  it('ACTs on a specific bug report', () => {
    expect(decide('iOS app crashes when applying promo code SAVE10 at checkout. Steps to reproduce: add item, apply code, tap pay. Expected: discount applied. Sentry CHK-4421.')).toBe('ACT')
  })
  it('ASKs about a vague stakeholder wish', () => {
    expect(decide('Can we make the checkout feel more premium before end of month?')).toBe('ASK')
  })
  it('ESCALATEs when an outside sign-off is required', () => {
    const a = analyzeRequest('Store session tokens differently; needs legal sign-off before we ship.')
    expect(a.task.externalBlockers).toContain('legal sign-off')
    expect(decide('Store session tokens differently; needs legal sign-off before we ship.')).toBe('ESCALATE')
  })
  it('ESCALATEs a two-word request (no requirements)', () => {
    expect(analyzeRequest('fix it').task.clarity).toBe(1)
    expect(decide('fix it')).toBe('ESCALATE')
  })
  it('explains every adjustment it makes', () => {
    const { signals } = analyzeRequest('Migrate billing database, affects 30% of users')
    expect(signals.map((s) => s.effect)).toEqual(expect.arrayContaining(['effort +2', 'risk +2', 'impact +1']))
  })
  it('keeps every dimension within 1–5', () => {
    const { task } = analyzeRequest('URGENT prod down! payments auth database crash migrate rewrite customers revenue 50% '.repeat(5))
    for (const v of [task.impact, task.effort, task.risk, task.clarity]) expect(v).toBeGreaterThanOrEqual(1)
    for (const v of [task.impact, task.effort, task.risk, task.clarity]) expect(v).toBeLessThanOrEqual(5)
  })
})

import { askQuestion } from './textSignals'

describe('askQuestion', () => {
  it('asks about the outside dependency first', () => {
    expect(askQuestion(analyzeRequest('Rotate keys; waiting on legal sign-off').task)).toMatch(/legal sign-off/)
  })
  it('asks for an example when the request is subjective', () => {
    expect(askQuestion(analyzeRequest('make it feel more premium').task)).toMatch(/Which screen/)
  })
  it('asks for done-ness when the request is just short', () => {
    expect(askQuestion(analyzeRequest('fix search').task)).toMatch(/done/)
  })
  it('stays quiet when nothing needs asking', () => {
    expect(askQuestion(analyzeRequest('Typo on pricing page: “recieve” should be “receive”. Steps: open /pricing, see FAQ 2.').task)).toBeNull()
  })
})
