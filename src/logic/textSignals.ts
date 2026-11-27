// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
// Provenance: sprintagent-prov-7c1e94d2b85a
import type { Task, TaskType, UrgencyLevel } from '../types'

export interface Signal {
  label: string
  effect: string
}

export interface TextAnalysis {
  task: Pick<Task, 'title' | 'description' | 'type' | 'urgency' | 'impact' | 'effort' | 'risk' | 'clarity' | 'externalBlockers'>
  signals: Signal[]
}

const clamp = (n: number) => Math.max(1, Math.min(5, n))
const has = (re: RegExp, s: string) => re.test(s)

const URGENT = /\b(crash(es|ing)?|outage|down|prod(uction)? (is )?(down|broken)|urgent|asap|p0|sev ?1|hotfix|customers? can'?t)\b/i
const BUGGY = /\b(bug|broken|fails?|failing|error|regression|exception|500)\b/i
const LOW = /\b(nice to have|someday|minor|typo|cosmetic|when you get a chance)\b/i
const BIG = /\b(redesign|re-?architect|migrat(e|ion)|rewrite|rebuild|new (system|flow|service|platform)|integration|loyalty|overhaul)\b/i
const RISKY = /\b(payments?|billing|checkout|auth(entication)?|login|security|database|data loss|pii|gdpr|compliance|session tokens?)\b/i
const IMPACT = /\b(customers?|users?|revenue|conversion|churn|\d+ ?%)\b/i
const SPECIFIC = /(\d|[A-Z]{2,}-\d+|`|steps to reproduce|repro|expected|actual|stack ?trace|sentry)/i
const CRITERIA = /\b(when .{3,60} then|should|must|acceptance|given|so that|done when|definition of done)\b/i
const VAGUE = /\b(premium|better|nicer|improve|feel|modern|polish|make it pop|somehow|quick(ly)?|just|simple)\b/i
const BLOCKERS: Array<[RegExp, string]> = [
  [/\blegal\b|\bsign-?off\b/i, 'legal sign-off'],
  [/\bvendor\b|\bthird[- ]party\b/i, 'vendor dependency'],
  [/\bdesign approval\b|\bwaiting on design\b/i, 'design approval'],
  [/\banother team\b|\bplatform team\b|\bother team\b/i, 'another team'],
  [/\bprocurement\b|\bcontract\b/i, 'procurement'],
]

function typeOf(t: string): TaskType {
  if (BUGGY.test(t) || URGENT.test(t)) return 'bug'
  if (/\b(investigate|research|spike|evaluate|explore|compare)\b/i.test(t)) return 'spike'
  if (/\b(design|figma|ui|ux|look|premium|visual)\b/i.test(t)) return 'design'
  if (/\b(upgrade|bump|clean ?up|refactor|chore|dependency)\b/i.test(t)) return 'chore'
  return 'feature'
}

/**
 * Deterministic, explainable estimate of triage dimensions from free text.
 * Used by the landing-page demo and as a fallback when a request arrives with no structure.
 */
export function analyzeRequest(raw: string): TextAnalysis {
  const text = raw.trim().replace(/\s+/g, ' ')
  const words = text ? text.split(' ').length : 0
  const signals: Signal[] = []
  const note = (label: string, effect: string) => signals.push({ label, effect })

  let urgency: UrgencyLevel = 'medium'
  if (has(URGENT, text)) { urgency = 'critical'; note('Production-impact language', 'urgency → critical') }
  else if (has(BUGGY, text)) { urgency = 'high'; note('Something is broken', 'urgency → high') }
  else if (has(LOW, text)) { urgency = 'low'; note('Marked as minor', 'urgency → low') }

  let effort = 2
  if (has(BIG, text)) { effort += 2; note('Large-scope work', 'effort +2') }
  if (words > 60) { effort += 1; note('Long, multi-part request', 'effort +1') }

  let risk = 2
  if (has(RISKY, text)) { risk += 2; note('Touches money, auth or data', 'risk +2') }
  if (urgency === 'critical') risk += 1

  let impact = 3
  if (has(IMPACT, text)) { impact += 1; note('Affects users or revenue', 'impact +1') }
  if (urgency === 'critical') impact += 1

  let clarity = 3
  if (has(CRITERIA, text)) { clarity += 1; note('States expected behaviour', 'clarity +1') }
  if (has(SPECIFIC, text)) { clarity += 1; note('Concrete details (ids, numbers, repro)', 'clarity +1') }
  if (has(VAGUE, text)) { clarity -= 1; note('Subjective wording', 'clarity −1') }
  if (words < 8) { clarity -= 1; note('Very short', 'clarity −1') }
  if (words < 4) clarity -= 1

  const externalBlockers = BLOCKERS.filter(([re]) => re.test(text)).map(([, label]) => label)
  for (const b of externalBlockers) note(`Outside dependency: ${b}`, 'needs a human')

  return {
    task: {
      title: text.slice(0, 120) || 'Untitled request',
      description: text,
      type: typeOf(text),
      urgency,
      impact: clamp(impact),
      effort: clamp(effort),
      risk: clamp(risk),
      clarity: clamp(clarity),
      externalBlockers,
    },
    signals,
  }
}

/**
 * The one question the agent asks when it can't act. Targets the weakest dimension, in plain words.
 */
export function askQuestion(task: TextAnalysis['task']): string | null {
  if (task.externalBlockers.length) return `Who owns the ${task.externalBlockers[0]}, and is there a date?`
  if (task.clarity <= 2) {
    if (/\b(premium|better|nicer|modern|polish|feel|pop)\b/i.test(task.description)) {
      return 'Which screen bothers you most, and what would “better” look like there? One example is plenty.'
    }
    return 'What does “done” look like for this? One sentence is fine.'
  }
  if (task.effort >= 4) return 'Can we ship a smaller first slice this sprint? What is the must-have part?'
  if (task.risk >= 4) return 'What is the rollback plan if this misbehaves in production?'
  return null
}
