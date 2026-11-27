// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
// Provenance: sprintagent-prov-7c1e94d2b85a
import { z } from 'zod'
import type { Task, TriageResult, AutonomyConfig } from '../types'
import { DEFAULT_AUTONOMY_CONFIG } from './constants'
import { chat } from '../lib/llm'

const Dim = z.number().int().min(1).max(5)
const TriageResultSchema = z.object({
  decision: z.enum(['ACT', 'ASK', 'ESCALATE']),
  score: z.number().int().min(0).max(100),
  reason: z.string().min(1).max(1_000),
  dimensions: z.object({ urgency: Dim, impact: Dim, effort: Dim, risk: Dim, clarity: Dim }),
})

function buildSystemPrompt(config: AutonomyConfig): string {
  return `You are a senior engineering PM agent operating an AI-native sprint management system.

Your role is to triage incoming tasks and determine the correct autonomy decision:

DECISION FRAMEWORK (PM-configured thresholds — respect these exactly):
- ACT: Clarity ≥ ${config.actMinClarity}/5, risk manageable (< 5), no external dependencies. Agent assigns autonomously.
- ASK: Clarity ≤ ${config.askMaxClarity}/5, or high effort with low clarity. Agent pauses and asks a specific question.
- ESCALATE: Clarity = 1/5, risk ≥ 5 AND effort ≥ 4, or external unresolvable dependencies.

SCORING FORMULA (produce integer 0–100):
urgency_val = {critical:5, high:4, medium:3, low:1}
score = round(clamp((urgency_val×2.5 + impact×2.0 - effort×1.2 - risk×1.0 + clarity×0.8)×5, 0, 100))

For ASK decisions: the "reason" field MUST include the specific blocking question the agent is asking, framed as something the PM can answer in one sentence.

Return ONLY valid JSON, no markdown:
{
  "decision": "ACT" | "ASK" | "ESCALATE",
  "score": <integer 0-100>,
  "reason": "<2-3 sentences. For ASK: include the specific question. Active voice.>",
  "dimensions": {
    "urgency": <1-5>,
    "impact": <1-5>,
    "effort": <1-5>,
    "risk": <1-5>,
    "clarity": <1-5>
  }
}`
}

function buildUserContent(task: Task): string {
  const urgencyMap = { critical: 5, high: 4, medium: 3, low: 1 }
  return `Triage this sprint task:

Title: ${task.title}
Description: ${task.description || '(none provided)'}
Type: ${task.type}
Source: ${task.source}
Urgency: ${task.urgency} (${urgencyMap[task.urgency]}/5)
Impact: ${task.impact}/5
Effort: ${task.effort}/5
Risk: ${task.risk}/5
Clarity: ${task.clarity}/5
Depends on tasks: ${task.dependencies.length > 0 ? task.dependencies.join(', ') : 'none'}
External blockers: ${task.externalBlockers.length > 0 ? task.externalBlockers.join(', ') : 'none'}
Tags: ${task.tags?.join(', ') || 'none'}
Story Points: ${task.storyPoints ?? 'unestimated'}

Return only the JSON.`
}

/** Extracts and strictly validates the first JSON object in an LLM response. Throws on any mismatch. */
export function parseResult(text: string): TriageResult {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('NO_JSON')
  return TriageResultSchema.parse(JSON.parse(match[0]))
}

/** Server-proxied AI triage. Throws on any failure; the store falls back to the rule engine. */
export async function triageWithAI(task: Task, config: AutonomyConfig = DEFAULT_AUTONOMY_CONFIG): Promise<TriageResult> {
  const text = await chat({
    messages: [
      { role: 'system', content: buildSystemPrompt(config) },
      { role: 'user', content: buildUserContent(task) },
    ],
    temperature: 0.3,
    maxTokens: 400,
  })
  return parseResult(text)
}
