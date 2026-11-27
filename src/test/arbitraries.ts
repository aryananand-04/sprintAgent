// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import fc from 'fast-check'
import type { Task, AutonomyConfig } from '../types'

const score = fc.integer({ min: 1, max: 5 })
export const taskType = fc.constantFrom('bug', 'feature', 'spike', 'design', 'urgent', 'ad-hoc', 'chore') as fc.Arbitrary<Task['type']>

/** Any well-formed task the app can produce. */
export const arbTask: fc.Arbitrary<Task> = fc.record({
  id: fc.uuid(),
  title: fc.string({ minLength: 1, maxLength: 80 }),
  description: fc.string({ maxLength: 300 }),
  type: taskType,
  status: fc.constantFrom('backlog', 'triaged', 'assigned', 'in-progress', 'blocked', 'done'),
  urgency: fc.constantFrom('critical', 'high', 'medium', 'low'),
  impact: score, effort: score, risk: score, clarity: score,
  dependencies: fc.array(fc.uuid(), { maxLength: 3 }),
  externalBlockers: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 2 }),
  source: fc.constantFrom('Slack', 'PM', 'Stakeholder', 'GitHub', 'Ad-hoc'),
  tags: fc.array(fc.string({ minLength: 1, maxLength: 12 }), { maxLength: 4 }),
  storyPoints: fc.integer({ min: 1, max: 13 }),
  createdAt: fc.constant('2026-11-01T00:00:00.000Z'),
}) as fc.Arbitrary<Task>

/** Configs a PM can save: ASK ceiling below ACT floor. */
export const arbConfig = (base: AutonomyConfig): fc.Arbitrary<AutonomyConfig> =>
  fc.record({ ask: fc.integer({ min: 1, max: 3 }), gap: fc.integer({ min: 1, max: 2 }), never: fc.subarray(['spike', 'design', 'urgent'] as Task['type'][]) })
    .map(({ ask, gap, never }) => ({ ...base, askMaxClarity: ask, actMinClarity: Math.min(5, ask + gap), neverAutoAssignTypes: never }))
