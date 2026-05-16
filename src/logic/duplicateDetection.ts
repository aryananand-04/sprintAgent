import Groq from 'groq-sdk'
import type { Task } from '../types'

export interface DuplicateResult {
  isDuplicate: boolean
  similarTaskId: string | null
  similarTaskTitle: string | null
  similarity: number   // 0-100
  reason: string
}

/**
 * Checks if an incoming request is semantically similar to an existing task.
 * Uses Groq to compare meaning, not just keywords.
 */
export async function checkForDuplicate(
  incomingText: string,
  existingTasks: Task[],
  apiKey: string,
): Promise<DuplicateResult> {
  const none: DuplicateResult = { isDuplicate: false, similarTaskId: null, similarTaskTitle: null, similarity: 0, reason: '' }

  if (!apiKey || apiKey === 'paste_your_key_here' || existingTasks.length === 0) return none

  const candidates = existingTasks
    .filter(t => t.status !== 'done')
    .map(t => `[${t.id}] ${t.title}: ${t.description}`)
    .slice(0, 30)  // don't send too many tokens
    .join('\n')

  const client = new Groq({ apiKey, dangerouslyAllowBrowser: true })

  try {
    const res = await client.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [{
        role: 'user',
        content: `New request: "${incomingText}"

Existing tasks:
${candidates}

Is the new request semantically equivalent to any existing task (same problem, same outcome)?
Ignore minor wording differences — focus on whether they describe the same work.

Return ONLY valid JSON:
{"isDuplicate": true/false, "taskId": "task-id or null", "similarity": 0-100, "reason": "1 sentence"}`,
      }],
      temperature: 0.1,
      max_tokens: 100,
    })

    const text = res.choices[0].message.content?.trim() ?? ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return none

    const parsed = JSON.parse(match[0]) as { isDuplicate: boolean; taskId: string | null; similarity: number; reason: string }
    const similar = existingTasks.find(t => t.id === parsed.taskId)

    return {
      isDuplicate: parsed.isDuplicate && parsed.similarity >= 70,
      similarTaskId: parsed.taskId,
      similarTaskTitle: similar?.title ?? null,
      similarity: parsed.similarity,
      reason: parsed.reason,
    }
  } catch {
    return none
  }
}
