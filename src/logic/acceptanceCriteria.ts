// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
// Provenance: sprintagent-prov-7c1e94d2b85a
import { z } from 'zod'
import type { Task } from '../types'
import { prompt as ask } from '../lib/llm'

const CriteriaSchema = z.array(z.string().min(1).max(500)).min(1).max(8)

/**
 * When the agent issues an ASK decision (low clarity), propose concrete
 * acceptance criteria the PM can approve or edit.
 * Approved criteria bump the task's clarity, making it ACT-eligible.
 */
export async function generateAcceptanceCriteria(
  task: Task,
  blockingQuestion: string,
): Promise<string[]> {
  let text: string
  try {
    text = await ask(`Task: "${task.title}"
Description: ${task.description}
Blocking question: ${blockingQuestion}

Generate 3-4 specific, testable acceptance criteria that would make this task clear enough to execute.
Each criterion should be: concrete, binary (pass/fail), and answerable without ambiguity.
Format: "Given [context], when [action], then [outcome]" OR simple bullet statement.

Return ONLY a JSON array of strings. No markdown.
["criterion 1", "criterion 2", "criterion 3"]`,
      { temperature: 0.3, maxTokens: 300 },
    )
  } catch {
    return []
  }
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) return []

  try {
    return CriteriaSchema.parse(JSON.parse(match[0]))
  } catch {
    return []
  }
}
