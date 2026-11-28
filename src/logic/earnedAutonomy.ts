// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
// Provenance: sprintagent-prov-7c1e94d2b85a
// Earned Autonomy: the agent's right to act is a licence per task type and action, earned from
// evidence (its predictions vs what people actually did) and revoked by it. Pure: no IO.
import type { TaskType } from '../types'

/** L0 Observe · L1 Suggest · L2 Act with an undo window · L3 Act. */
export type Level = 0 | 1 | 2 | 3
export const LEVEL_NAMES: Record<Level, string> = { 0: 'Observe', 1: 'Suggest', 2: 'Act with undo', 3: 'Act' }

/** Things the agent can do on its own. Each declares how reversible it is and what it touches. */
export const ACTIONS = {
  assign: { label: 'Assign work', reversible: true, blastRadius: 'one task, one person' },
  rebalance: { label: 'Move work between people', reversible: true, blastRadius: 'one task, two people' },
} as const
export type LicensedAction = keyof typeof ACTIONS

export const TASK_TYPES: TaskType[] = ['bug', 'feature', 'spike', 'design', 'urgent', 'ad-hoc', 'chore']

/** New workspaces start here: the agent suggests, people decide. Shadow mode is the onboarding. */
export const DEFAULT_LEVEL: Level = 1

/** Evidence needed to hold each level. `minLower` is the Wilson lower bound on agreement. */
export const PROMOTION: Record<2 | 3, { minN: number; minLower: number }> = {
  2: { minN: 20, minLower: 0.8 },
  3: { minN: 50, minLower: 0.9 },
}
/** Demotion looks at recent evidence only, so drift shows up quickly. */
export const RECENT_WINDOW = 20
export const RECENT_MIN = 10
/** Irreversible actions never go past L2 (there's no undo to fall back on). */
export const IRREVERSIBLE_MAX: Level = 2

/**
 * Wilson score interval for a proportion (95% by default). With little evidence the interval is wide,
 * so a lucky 3/3 doesn't look like 100%.
 */
export function wilson(successes: number, n: number, z = 1.96): { lower: number; upper: number } {
  if (n <= 0) return { lower: 0, upper: 1 }
  const p = successes / n
  const z2 = z * z
  const centre = p + z2 / (2 * n)
  const margin = z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))
  const denom = 1 + z2 / n
  return { lower: Math.max(0, (centre - margin) / denom), upper: Math.min(1, (centre + margin) / denom) }
}

/** One resolved prediction: did the people agree with what the agent would have done (or did)? */
export interface Outcome { agree: boolean; at: string }

export interface LicenseInput {
  action: LicensedAction
  earned: Level
  /** The admin's ceiling. Admins can lower autonomy at any time; they can't grant more than was earned. */
  cap: Level
  /** Resolved outcomes, any order. */
  outcomes: Outcome[]
}

export interface LicenseEvaluation {
  earned: Level
  effective: Level
  n: number
  agree: number
  lower: number
  recent: { n: number; agree: number; upper: number }
  change: 'promoted' | 'demoted' | null
  /** Plain-language reason for the current earned level. */
  reason: string
  /** What it would take to reach the next level, or null at the top. */
  next: { level: Level; needN: number; needLower: number; moreDecisions: number } | null
}

const pct = (x: number) => `${Math.round(x * 100)}%`
const maxFor = (action: LicensedAction): Level => (ACTIONS[action].reversible ? 3 : IRREVERSIBLE_MAX)

/**
 * Re-evaluates one licence from its evidence. Moves at most one level per evaluation, promotes only
 * when the whole record clears the bar for the next level, and demotes when recent agreement can't
 * plausibly reach the bar for the current one (Wilson upper bound below it).
 */
export function evaluateLicense(input: LicenseInput): LicenseEvaluation {
  const sorted = [...input.outcomes].sort((a, b) => a.at.localeCompare(b.at))
  const n = sorted.length
  const agree = sorted.filter((o) => o.agree).length
  const { lower } = wilson(agree, n)
  const recentSlice = sorted.slice(-RECENT_WINDOW)
  const recentAgree = recentSlice.filter((o) => o.agree).length
  const recent = { n: recentSlice.length, agree: recentAgree, upper: wilson(recentAgree, recentSlice.length).upper }

  let earned = Math.min(input.earned, maxFor(input.action)) as Level
  let change: LicenseEvaluation['change'] = null
  let reason: string

  const bar = earned >= 2 ? PROMOTION[earned as 2 | 3] : null
  if (bar && recent.n >= RECENT_MIN && recent.upper < bar.minLower) {
    earned = (earned - 1) as Level
    change = 'demoted'
    reason = `Recent agreement ${recentAgree}/${recent.n} can't support ${LEVEL_NAMES[(earned + 1) as Level]} (needs ${pct(bar.minLower)}).`
  } else {
    const up = (earned + 1) as Level
    const nextBar = up === 2 || up === 3 ? PROMOTION[up] : null
    if (nextBar && up <= maxFor(input.action) && earned >= 1 && n >= nextBar.minN && lower >= nextBar.minLower) {
      earned = up
      change = 'promoted'
      reason = `Agreed with people ${agree}/${n} times; at 95% confidence that's at least ${pct(lower)}.`
    } else {
      reason = n ? `Agreed ${agree}/${n} times (at least ${pct(lower)} at 95% confidence).` : 'No evidence yet: the agent is still watching.'
    }
  }

  const effective = Math.min(earned, input.cap) as Level
  const nextLevel = (earned + 1) as Level
  const nextBar = nextLevel === 2 || nextLevel === 3 ? PROMOTION[nextLevel] : null
  const next = nextBar && nextLevel <= maxFor(input.action)
    ? { level: nextLevel, needN: nextBar.minN, needLower: nextBar.minLower, moreDecisions: decisionsNeeded(agree, n, nextBar) }
    : null
  return { earned, effective, n, agree, lower, recent, change, reason, next }
}

/**
 * How many more decisions (if every one agreed) until the bar is met. A useful, honest progress
 * number for the licence card: it never promises the bar can be met by count alone if it can't.
 */
export function decisionsNeeded(agree: number, n: number, bar: { minN: number; minLower: number }): number {
  for (let k = 0; k <= 1_000; k++) {
    if (n + k >= bar.minN && wilson(agree + k, n + k).lower >= bar.minLower) return k
  }
  return Infinity
}

/** The level that applies to one (type, action), defaulting to Suggest for anything not yet tracked. */
export function levelFor(licenses: Array<{ taskType: TaskType; action: LicensedAction; effective: Level }>, taskType: TaskType, action: LicensedAction): Level {
  return licenses.find((l) => l.taskType === taskType && l.action === action)?.effective ?? DEFAULT_LEVEL
}

/** Acting levels. Below this the agent only predicts (and, at L1, shows its suggestion). */
export const mayAct = (level: Level) => level >= 2
/** How long people have to undo an L2 action before it counts as accepted. */
export const UNDO_WINDOW_HOURS = 4
