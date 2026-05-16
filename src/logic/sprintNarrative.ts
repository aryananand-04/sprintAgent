import Groq from 'groq-sdk'
import type { Task, TeamMember, Sprint, EscalationItem } from '../types'

/**
 * Generates a single, sharp sentence summarizing sprint health.
 * E.g. "At current velocity 3 tasks won't ship — promo edge cases and auth redesign are the critical path."
 * Displayed below the sprint goal on the board header.
 */
export async function generateSprintNarrative(
  sprint: Sprint,
  tasks: Task[],
  team: TeamMember[],
  escalations: EscalationItem[],
  apiKey: string,
): Promise<string> {
  const blocked  = tasks.filter(t => t.status === 'blocked')
  const backlog  = tasks.filter(t => t.status === 'backlog' || t.status === 'triaged')
  const inFlight = tasks.filter(t => t.status === 'in-progress' || t.status === 'assigned')
  const done     = tasks.filter(t => t.status === 'done')
  const openEsc  = escalations.filter(e => !e.resolved)
  const pct      = Math.round((sprint.completedPoints / sprint.committedPoints) * 100)
  const sprintLength = Math.max(1, Math.ceil((new Date(sprint.endDate).getTime() - new Date(sprint.startDate).getTime()) / 86_400_000))
  const daysElapsed = Math.max(1, Math.ceil((Date.now() - new Date(sprint.startDate).getTime()) / 86_400_000))
  const expectedPct = Math.round((Math.min(daysElapsed, sprintLength) / sprintLength) * 100)
  const deficit     = expectedPct - pct

  const blockedTitles = blocked.map(t => t.title.split(':')[0]).slice(0, 2).join(', ')
  const escTitles     = openEsc.map(e => e.taskTitle.split(':')[0]).slice(0, 2).join(', ')

  const prompt = `Sprint agent. Write ONE sharp sentence (max 18 words) summarizing the sprint health risk right now. Be specific, not generic.

Data:
- Sprint: ${sprint.name}, goal: "${sprint.goal}"
- ${pct}% done vs ${expectedPct}% expected at this point (${deficit > 0 ? deficit + '% behind' : 'on pace'})
- ${inFlight.length} in-flight, ${blocked.length} blocked (${blockedTitles || 'none'}), ${backlog.length} queued, ${done.length} done
- ${openEsc.length} open escalations (${escTitles || 'none'})
- ${sprint.daysRemaining} days remaining

Write the sentence from the agent's perspective. Be concrete about what's at risk and what the critical path is. Don't start with "I". Don't use filler words. No period at the end.`

  try {
    const client = new Groq({ apiKey, dangerouslyAllowBrowser: true })
    const res = await client.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 60,
    })
    return res.choices[0].message.content?.trim() ?? ''
  } catch {
    // Deterministic fallback
    if (deficit > 10) {
      return `${Math.round(deficit / 10)} tasks at risk of not shipping — ${blockedTitles || 'velocity below target'} is the critical blocker`
    }
    return `Sprint ${sprint.health === 'green' ? 'on pace' : 'at risk'} — ${openEsc.length > 0 ? `${openEsc.length} escalation${openEsc.length > 1 ? 's' : ''} blocking autonomous progress` : `${inFlight.length} tasks in flight, ${sprint.daysRemaining} days to close`}`
  }
}
