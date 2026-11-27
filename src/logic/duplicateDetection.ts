import { z } from 'zod'
import type { Task } from '../types'
import { prompt as ask } from '../lib/llm'

const DupSchema = z.object({
  isDuplicate: z.boolean(),
  taskId: z.string().nullable(),
  similarity: z.number().min(0).max(100),
  reason: z.string().max(500),
})

export interface DuplicateResult {
  isDuplicate: boolean
  similarTaskId: string | null
  similarTaskTitle: string | null
  similarity: number   // 0-100
  reason: string
}

/**
 * Checks if an incoming request is semantically similar to an existing task.
 * Uses the LLM to compare meaning, not just keywords.
 */
export async function checkForDuplicate(
  incomingText: string,
  existingTasks: Task[],
): Promise<DuplicateResult> {
  const none: DuplicateResult = { isDuplicate: false, similarTaskId: null, similarTaskTitle: null, similarity: 0, reason: '' }

  if (existingTasks.length === 0) return none

  const candidates = existingTasks
    .filter(t => t.status !== 'done')
    .map(t => `[${t.id}] ${t.title}: ${t.description}`)
    .slice(0, 30)  // don't send too many tokens
    .join('\n')

  try {
    const text = await ask(`New request: "${incomingText}"

Existing tasks:
${candidates}

Is the new request semantically equivalent to any existing task (same problem, same outcome)?
Ignore minor wording differences — focus on whether they describe the same work.

Return ONLY valid JSON:
{"isDuplicate": true/false, "taskId": "task-id or null", "similarity": 0-100, "reason": "1 sentence"}`,
      { temperature: 0.1, maxTokens: 100 },
    )
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return none

    const parsed = DupSchema.parse(JSON.parse(match[0]))
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
