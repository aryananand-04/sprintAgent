// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
// Provenance: sprintagent-prov-7c1e94d2b85a
import type { AgentDecision } from '../types'

const CAUTION: Record<AgentDecision, number> = { ACT: 0, ASK: 1, ESCALATE: 2 }

export interface Reconciled {
  decision: AgentDecision
  ai: AgentDecision
  rules: AgentDecision
  /** AI and rules disagreed (logged for calibration). */
  disagreed: boolean
  /** The rules overruled a bolder AI call. */
  overruled: boolean
}

/**
 * The model is advisory. It may make a decision more cautious than the rules (ACT → ASK, ASK → ESCALATE),
 * but it can never make one bolder: an LLM alone can't grant itself autonomy.
 */
export function reconcile(ai: AgentDecision, rules: AgentDecision): Reconciled {
  const overruled = CAUTION[ai] < CAUTION[rules]
  return { decision: overruled ? rules : ai, ai, rules, disagreed: ai !== rules, overruled }
}
