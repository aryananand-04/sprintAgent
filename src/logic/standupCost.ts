export interface StandupInput {
  people: number        // attendees
  minutes: number       // per standup, including the "one more thing"
  hourlyCost: number    // loaded cost per person-hour
  daysPerSprint: number
}

export interface StandupCost {
  personHoursPerSprint: number
  costPerSprint: number
  costPerYear: number
  engineerDaysPerYear: number
  verdict: string
}

const SPRINTS_PER_YEAR = 26

/** What a recurring standup costs. Includes a ~10 min context-switch tax per person per meeting. */
export function standupCost({ people, minutes, hourlyCost, daysPerSprint }: StandupInput): StandupCost {
  const p = Math.max(1, Math.round(people))
  const m = Math.max(1, minutes)
  const switchTax = 10
  const personHoursPerSprint = (p * (m + switchTax) * Math.max(1, daysPerSprint)) / 60
  const costPerSprint = personHoursPerSprint * Math.max(0, hourlyCost)
  const engineerDaysPerYear = (personHoursPerSprint * SPRINTS_PER_YEAR) / 8

  const verdict =
    engineerDaysPerYear < 20 ? 'That’s reasonable. Carry on.'
    : engineerDaysPerYear < 60 ? 'A few weeks a year of “no blockers”.'
    : engineerDaysPerYear < 150 ? 'About a part-time hire, whose job is attending standup.'
    : 'Roughly one full-time engineer, standing in a circle.'

  return {
    personHoursPerSprint: Math.round(personHoursPerSprint * 10) / 10,
    costPerSprint: Math.round(costPerSprint),
    costPerYear: Math.round(costPerSprint * SPRINTS_PER_YEAR),
    engineerDaysPerYear: Math.round(engineerDaysPerYear),
    verdict,
  }
}
