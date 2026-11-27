import { describe, it, expect } from 'vitest'
import { standupCost } from './standupCost'

describe('standupCost', () => {
  it('adds a context-switch tax and annualises over 26 sprints', () => {
    // 8 people × (15 + 10) min × 10 days = 2000 min ≈ 33.3 h
    const r = standupCost({ people: 8, minutes: 15, hourlyCost: 90, daysPerSprint: 10 })
    expect(r.personHoursPerSprint).toBe(33.3)
    expect(r.costPerSprint).toBe(3000)
    expect(r.costPerYear).toBe(78000)
    expect(r.engineerDaysPerYear).toBe(108)
    expect(r.verdict).toMatch(/part-time hire/)
  })
  it('never goes negative or divides by zero on silly input', () => {
    const r = standupCost({ people: 0, minutes: 0, hourlyCost: -5, daysPerSprint: 0 })
    expect(r.costPerSprint).toBe(0)
    expect(r.personHoursPerSprint).toBeGreaterThan(0)
  })
  it('is kind to small, fast teams', () => {
    expect(standupCost({ people: 3, minutes: 5, hourlyCost: 80, daysPerSprint: 5 }).verdict).toMatch(/reasonable/)
  })
})
