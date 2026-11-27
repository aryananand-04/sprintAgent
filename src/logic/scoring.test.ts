import { describe, it, expect } from 'vitest'
import { computeTriageScore, computeAssignmentConfidence, computeSprintRisk, computeTicketQuality } from './scoring'
import { makeTask } from '../test/factories'

describe('computeTriageScore', () => {
  it('applies the weighted formula', () => {
    // (4*2.5 + 4*2 - 2*1.2 - 2*1 + 4*0.8) * 5 = 84
    expect(computeTriageScore(makeTask())).toBe(84)
  })
  it('clamps to 100', () => {
    expect(computeTriageScore(makeTask({ urgency: 'critical', impact: 5, effort: 1, risk: 1, clarity: 5 }))).toBe(100)
  })
  it('clamps to 0', () => {
    expect(computeTriageScore(makeTask({ urgency: 'low', impact: 1, effort: 5, risk: 5, clarity: 1 }))).toBe(0)
  })
})

describe('computeAssignmentConfidence', () => {
  const task = makeTask()
  it('rewards skill match and low load', () => {
    expect(computeAssignmentConfidence(task, ['frontend', 'react'], 50, false)).toBe(68)
  })
  it('steps down with load', () => {
    expect(computeAssignmentConfidence(task, ['frontend'], 70, false)).toBe(58)
    expect(computeAssignmentConfidence(task, ['frontend'], 85, false)).toBe(48)
  })
  it('penalises dependency conflicts', () => {
    expect(computeAssignmentConfidence(task, ['frontend'], 50, true)).toBe(48)
  })
  it('caps at 99', () => {
    expect(computeAssignmentConfidence(makeTask({ clarity: 5 }), ['bug', 'frontend', 'pm'], 10, false)).toBe(99)
  })
})

describe('computeSprintRisk', () => {
  it('is green when on pace', () => expect(computeSprintRisk(0.8, 0, 0, 5, 50, 40)).toBe('green'))
  it('is red with 3+ blocked', () => expect(computeSprintRisk(0.8, 0, 3, 5, 50, 40)).toBe('red'))
  it('is yellow when under 45% done', () => expect(computeSprintRisk(0.4, 0, 0, 5, 50, 40)).toBe('yellow'))
  it('is red with work left and no days', () => expect(computeSprintRisk(0.8, 0, 0, 0, 50, 40)).toBe('red'))
})

describe('computeTicketQuality', () => {
  it('stays within 0–100', () => {
    const q = computeTicketQuality(makeTask({ clarity: 5, description: 'x'.repeat(100) }))
    expect(q).toBe(100)
  })
})
