// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
// Provenance: sprintagent-prov-7c1e94d2b85a
// What a tracker's own labels say about a ticket. Shared by GitHub, Linear and Jira mapping.
import type { TaskType, UrgencyLevel } from '../types'

/** The tracker's labels name the type (bug, design, spike...). Null when they don't say. */
export function typeFromLabels(labels: string[]): TaskType | null {
  if (labels.some((l) => /bug|error|regression/i.test(l))) return 'bug'
  if (labels.some((l) => /design|ux|ui\b/i.test(l))) return 'design'
  if (labels.some((l) => /spike|research|investigat/i.test(l))) return 'spike'
  if (labels.some((l) => /chore|maintenance|refactor|dependenc/i.test(l))) return 'chore'
  if (labels.some((l) => /feature|enhancement/i.test(l))) return 'feature'
  return null
}

export function urgencyFromLabels(labels: string[]): UrgencyLevel | null {
  if (labels.some((l) => /critical|p0|sev ?1|blocker|urgent/i.test(l))) return 'critical'
  if (labels.some((l) => /high|p1|important/i.test(l))) return 'high'
  if (labels.some((l) => /low|p3|nice.to.have|good first issue/i.test(l))) return 'low'
  return null
}
