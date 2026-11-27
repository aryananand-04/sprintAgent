import type { Task } from '../types'
import { prompt as ask } from '../lib/llm'

/**
 * Scores how much a task contributes to the sprint goal.
 * Returns 1-10. Tasks scoring ≤3 are flagged as misaligned (scope creep risk).
 */
export async function scoreGoalAlignment(
  task: Task,
  sprintGoal: string,
): Promise<number> {
  const raw = await ask(
    `Sprint goal: "${sprintGoal}"
Task: "${task.title}" — ${task.description}

Score 1-10: how directly does this task contribute to achieving the sprint goal?
10 = core to the goal. 1 = unrelated. Be honest about misalignment.
Return ONLY a single integer. No explanation.`,
    { temperature: 0.1, maxTokens: 5 },
  )
  const score = parseInt(raw, 10)
  return isNaN(score) ? 5 : Math.min(10, Math.max(1, score))
}

/** Score multiple tasks in sequence, updating each as it completes. */
export async function scoreAllGoalAlignment(
  tasks: Task[],
  sprintGoal: string,
  onScored: (taskId: string, score: number) => void,
): Promise<void> {
  for (const task of tasks) {
    if (task.goalAlignment !== undefined) continue  // already scored
    try {
      const score = await scoreGoalAlignment(task, sprintGoal)
      onScored(task.id, score)
      await new Promise(r => setTimeout(r, 300))  // gentle rate limiting
    } catch {
      // skip on error
    }
  }
}
