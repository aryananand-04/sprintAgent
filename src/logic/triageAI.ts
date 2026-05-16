import Groq from 'groq-sdk'
import type { Task, TriageResult, AutonomyConfig } from '../types'

/* Puter.js — CDN fallback, no API key needed */
declare const puter: {
  ai: {
    chat: (
      messages: Array<{ role: string; content: string }>,
      options?: { model?: string }
    ) => Promise<{ message: { content: string } }>
  }
}

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

const DEFAULT_CONFIG: AutonomyConfig = { actMinClarity: 3, askMaxClarity: 2, escalateIfCriticalUnassignedHours: 1, neverAutoAssignTypes: [], capacityBreachThreshold: 90, blockedHoursThreshold: 2, escNudgeHours: 4, velocityDeficitPts: 6 }

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
Dependencies: ${task.dependencies.length > 0 ? task.dependencies.join(', ') : 'none'}
Tags: ${task.tags?.join(', ') || 'none'}
Story Points: ${task.storyPoints ?? 'unestimated'}

Return only the JSON.`
}

function parseResult(text: string): TriageResult {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error(`No JSON in response: ${text.slice(0, 100)}`)
  const parsed = JSON.parse(match[0]) as TriageResult
  if (!['ACT', 'ASK', 'ESCALATE'].includes(parsed.decision)) {
    throw new Error(`Invalid decision: ${parsed.decision}`)
  }
  return parsed
}

/* ── Try 1: Groq (fast, free tier, reliable) ── */
async function tryGroq(task: Task, config: AutonomyConfig): Promise<TriageResult> {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY
  if (!apiKey || apiKey === 'paste_your_key_here') throw new Error('NO_GROQ_KEY')

  const client = new Groq({ apiKey, dangerouslyAllowBrowser: true })
  const response = await client.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    messages: [
      { role: 'system', content: buildSystemPrompt(config) },
      { role: 'user', content: buildUserContent(task) },
    ],
    temperature: 0.3,
    max_tokens: 400,
  })

  return parseResult(response.choices[0].message.content ?? '')
}

/* ── Try 2: Puter.js (CDN, no account needed) ── */
async function tryPuter(task: Task, config: AutonomyConfig): Promise<TriageResult> {
  if (typeof puter === 'undefined') throw new Error('NO_PUTER')

  const response = await puter.ai.chat(
    [
      { role: 'system', content: buildSystemPrompt(config) },
      { role: 'user', content: buildUserContent(task) },
    ],
    { model: 'gpt-4o-mini' }
  )

  return parseResult(response.message.content.trim())
}

/* ── Main export: tries Groq → Puter → throws ── */
export async function triageWithAI(task: Task, config: AutonomyConfig = DEFAULT_CONFIG): Promise<TriageResult> {
  // Try Groq first (more reliable when key is set)
  try {
    return await tryGroq(task, config)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg !== 'NO_GROQ_KEY') {
      console.warn('Groq triage failed, trying Puter.js:', msg)
    }
  }

  try {
    return await tryPuter(task, config)
  } catch {
    throw new Error('NO_API_KEY')  // store handles this as silent fallback
  }
}
