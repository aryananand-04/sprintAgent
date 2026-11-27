// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import type { AgentDecision, AutonomyConfig, Task, TriageResult } from '../types'
import { DEFAULT_AUTONOMY_CONFIG } from '../logic/constants'
import { aiQueue, AiError } from '../lib/aiQueue'

/** How the AI and the rules saw a ticket. Logged with each decision for calibration. */
export interface TriageAudit {
  ai: AgentDecision
  rules: AgentDecision
  disagreed: boolean
  overruled: boolean
  suspicious: boolean
}

let disabled = false

/**
 * AI triage via the server (prompt, sanitising and rule guard live there). Queued and retried;
 * throws AiError so the store can fall back to the rule engine.
 */
export async function triageWithAI(task: Task, config: AutonomyConfig = DEFAULT_AUTONOMY_CONFIG): Promise<TriageResult & { audit: TriageAudit }> {
  if (disabled) throw new AiError('AI_DISABLED')
  return aiQueue(async () => {
    if (disabled) throw new AiError('AI_DISABLED')
    const res = await fetch('/api/ai/triage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task, config }),
    }).catch(() => { throw new AiError('NETWORK') })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      if (data.error === 'AI_DISABLED') disabled = true
      throw new AiError(data.error ?? `HTTP_${res.status}`, Number(res.headers.get('Retry-After') ?? 0) * 1000)
    }
    const { decision, score, reason, dimensions, ai, rules, disagreed, overruled, suspicious } = data
    return { decision, score, reason, dimensions, audit: { ai, rules, disagreed, overruled, suspicious } }
  })
}
