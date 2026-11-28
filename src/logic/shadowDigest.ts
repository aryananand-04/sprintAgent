// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
// Provenance: sprintagent-prov-7c1e94d2b85a
import type { TaskType } from '../types'
import { ACTIONS, LEVEL_NAMES, PROMOTION, decisionsNeeded, type Level, type LicensedAction } from './earnedAutonomy'
import { slackEscape } from './slack'

export interface DigestPrediction {
  taskType: TaskType
  action: LicensedAction
  agree: boolean
  taskTitle: string
  predictedName: string | null
  actualName: string | null
}

export interface DigestLicense { taskType: TaskType; action: LicensedAction; earned: Level; cap: Level; n: number; agree: number }

const pct = (a: number, n: number) => (n ? Math.round((a / n) * 100) : 0)

/**
 * The weekly "what I would've done": how often the agent agreed with people, per kind of work, where
 * it would have chosen differently, and how far each licence is from the next level. Null when the
 * week had no decisions to compare (no empty digests).
 */
export function shadowDigest(week: DigestPrediction[], licenses: DigestLicense[]): string | null {
  if (!week.length) return null
  const agree = week.filter((p) => p.agree).length
  const lines = [`*What I would've done this week*`, `Agreed with you ${agree} of ${week.length} times (${pct(agree, week.length)}%).`, '']

  const groups = new Map<string, DigestPrediction[]>()
  for (const p of week) groups.set(`${p.taskType}:${p.action}`, [...(groups.get(`${p.taskType}:${p.action}`) ?? []), p])
  for (const [key, ps] of [...groups].sort((a, b) => b[1].length - a[1].length)) {
    const [taskType, action] = key.split(':') as [TaskType, LicensedAction]
    const l = licenses.find((x) => x.taskType === taskType && x.action === action)
    const level = (l ? Math.min(l.earned, l.cap) : 1) as Level
    const a = ps.filter((p) => p.agree).length
    let status = `${LEVEL_NAMES[level]}.`
    const up = ((l?.earned ?? 1) + 1) as Level
    if (l && up <= 3) {
      const more = decisionsNeeded(l.agree, l.n, PROMOTION[up as 2 | 3])
      status += Number.isFinite(more) ? ` ${more} more agreeing decision${more === 1 ? '' : 's'} to ${LEVEL_NAMES[up]}.` : ` Needs a steadier record before ${LEVEL_NAMES[up]}.`
    }
    if (l && l.cap < l.earned) status += ` (Earned ${LEVEL_NAMES[l.earned]}, capped by an admin.)`
    lines.push(`• ${taskType} — ${ACTIONS[action].label.toLowerCase()}: ${a}/${ps.length}. ${status}`)
  }

  const differed = week.filter((p) => !p.agree && p.predictedName && p.actualName).slice(0, 3)
  if (differed.length) {
    lines.push('', '*Where we differed*')
    for (const p of differed) lines.push(`• “${slackEscape(p.taskTitle)}”: I'd have picked ${slackEscape(p.predictedName!)}; you picked ${slackEscape(p.actualName!)}.`)
  }
  lines.push('', '_Nothing here changed anything. Licences move on these numbers alone._')
  return lines.join('\n')
}
