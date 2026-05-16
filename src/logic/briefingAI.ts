import Groq from 'groq-sdk'
import type { Task, TeamMember, Sprint, EscalationItem } from '../types'

declare const puter: {
  ai: {
    chat: (
      messages: string | Array<{ role: string; content: string }>,
      options?: { model?: string }
    ) => Promise<{ message: { content: string } }>
  }
}

export async function generateBriefingSummary(
  type: 'team' | 'pm' | 'manager',
  tasks: Task[],
  team: TeamMember[],
  sprint: Sprint,
  escalations: EscalationItem[],
): Promise<string> {
  const done = tasks.filter(t => t.status === 'done')
  const inProgress = tasks.filter(t => t.status === 'in-progress')
  const blocked = tasks.filter(t => t.status === 'blocked')
  const openEsc = escalations.filter(e => !e.resolved)
  const pct = Math.round((sprint.completedPoints / sprint.committedPoints) * 100)
  const overloaded = team.filter(m => m.currentLoad > 85)

  const context = `Sprint: ${sprint.name} | ${pct}% complete | ${sprint.daysRemaining} days left | ${done.length} done, ${inProgress.length} in-progress, ${blocked.length} blocked | ${openEsc.length} open escalations | ${overloaded.length > 0 ? `${overloaded.map(m => m.name).join(', ')} overloaded` : 'team load healthy'} | Goal: ${sprint.goal}`

  const prompts: Record<string, string> = {
    team:    `You are a sprint agent writing a brief 2-sentence operational status update for the engineering team. Data: ${context}. Focus on what's in-flight, what's blocked, and immediate actions. Be direct and concrete. No fluff.`,
    pm:      `You are a sprint agent writing a brief 2-sentence risk/trade-off summary for the PM. Data: ${context}. Focus on escalations, risks to sprint goal, and decisions needed. Be direct. No fluff.`,
    manager: `You are a sprint agent writing a brief 2-sentence delivery confidence summary for the engineering manager. Data: ${context}. Focus on delivery likelihood, team health, and milestone risk. Be direct. No fluff.`,
  }

  const prompt = prompts[type]

  // ── Try 1: Groq (primary — no sign-in, API key in env) ──
  try {
    const apiKey = import.meta.env.VITE_GROQ_API_KEY
    if (!apiKey || apiKey === 'paste_your_key_here') throw new Error('NO_GROQ_KEY')

    const client = new Groq({ apiKey, dangerouslyAllowBrowser: true })
    const res = await client.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      max_tokens: 120,
    })
    return res.choices[0].message.content?.trim() ?? ''
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg !== 'NO_GROQ_KEY') console.warn('Groq briefing failed, trying Puter:', msg)
  }

  // ── Try 2: Puter.js (fallback — CDN, requires Puter account) ──
  try {
    if (typeof puter === 'undefined') throw new Error('NO_PUTER')
    const res = await puter.ai.chat(prompt)
    return res.message.content.trim()
  } catch {
    return ''  // caller falls back to deterministic summary
  }
}
