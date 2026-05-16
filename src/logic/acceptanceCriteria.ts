import Groq from 'groq-sdk'
import type { Task } from '../types'

/**
 * When the agent issues an ASK decision (low clarity), propose concrete
 * acceptance criteria the PM can approve or edit.
 * Approved criteria bump the task's clarity, making it ACT-eligible.
 */
export async function generateAcceptanceCriteria(
  task: Task,
  blockingQuestion: string,
  apiKey: string,
): Promise<string[]> {
  if (!apiKey || apiKey === 'paste_your_key_here') return []

  const client = new Groq({ apiKey, dangerouslyAllowBrowser: true })

  const res = await client.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    messages: [{
      role: 'user',
      content: `Task: "${task.title}"
Description: ${task.description}
Blocking question: ${blockingQuestion}

Generate 3-4 specific, testable acceptance criteria that would make this task clear enough to execute.
Each criterion should be: concrete, binary (pass/fail), and answerable without ambiguity.
Format: "Given [context], when [action], then [outcome]" OR simple bullet statement.

Return ONLY a JSON array of strings. No markdown.
["criterion 1", "criterion 2", "criterion 3"]`,
    }],
    temperature: 0.3,
    max_tokens: 300,
  })

  const text = res.choices[0].message.content?.trim() ?? ''
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) return []

  try {
    return JSON.parse(match[0]) as string[]
  } catch {
    return []
  }
}
