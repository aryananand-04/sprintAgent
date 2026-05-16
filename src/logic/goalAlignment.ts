import Groq from 'groq-sdk'
import type { Task } from '../types'

/**
 * Scores how much a task contributes to the sprint goal.
 * Returns 1-10. Tasks scoring ≤3 are flagged as misaligned (scope creep risk).
 */
export async function scoreGoalAlignment(
  task: Task,
  sprintGoal: string,
  apiKey: string,
): Promise<number> {
  if (!apiKey || apiKey === 'paste_your_key_here') return 5

  const client = new Groq({ apiKey, dangerouslyAllowBrowser: true })

  const res = await client.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    messages: [{
      role: 'user',
      content: `Sprint goal: "${sprintGoal}"
Task: "${task.title}" — ${task.description}

Score 1-10: how directly does this task contribute to achieving the sprint goal?
10 = core to the goal. 1 = unrelated. Be honest about misalignment.
Return ONLY a single integer. No explanation.`,
    }],
    temperature: 0.1,
    max_tokens: 5,
  })

  const raw = res.choices[0].message.content?.trim() ?? ''
  const score = parseInt(raw, 10)
  return isNaN(score) ? 5 : Math.min(10, Math.max(1, score))
}

/** Score multiple tasks in sequence, updating each as it completes. */
export async function scoreAllGoalAlignment(
  tasks: Task[],
  sprintGoal: string,
  apiKey: string,
  onScored: (taskId: string, score: number) => void,
): Promise<void> {
  for (const task of tasks) {
    if (task.goalAlignment !== undefined) continue  // already scored
    try {
      const score = await scoreGoalAlignment(task, sprintGoal, apiKey)
      onScored(task.id, score)
      await new Promise(r => setTimeout(r, 300))  // gentle rate limiting
    } catch {
      // skip on error
    }
  }
}
