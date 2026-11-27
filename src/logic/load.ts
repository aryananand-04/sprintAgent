// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
// Provenance: sprintagent-prov-7c1e94d2b85a
import type { Task, TeamMember } from '../types'
import { LOAD_MAX, LOAD_BASELINE } from './constants'

/** Each person's load %: baseline overhead plus active points against their capacity. */
export function computeLoadsFromTasks(tasks: Task[], team: TeamMember[]): TeamMember[] {
  return team.map((m) => {
    const activePts = tasks
      .filter((t) => t.assigneeId === m.id && ['in-progress', 'assigned', 'blocked'].includes(t.status))
      .reduce((sum, t) => sum + (t.storyPoints ?? 2), 0)
    return { ...m, currentLoad: Math.min(LOAD_MAX, LOAD_BASELINE + Math.round((activePts / Math.max(m.capacity, 1)) * 45)) }
  })
}
