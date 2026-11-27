// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { useEffect } from 'react'
import { useSprintStore } from '../store/useSprintStore'
import { prompt as ask } from '../lib/llm'
import { COOLDOWN_MS, planAgentTick } from '../logic/agentLoop'

const LOOP_MS = 60_000
const LS_KEY = 'agent-loop-checks'

function getChecks(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? '{}') } catch { return {} }
}
function setCheck(key: string) {
  const checks = getChecks()
  const now = Date.now()
  checks[key] = now
  for (const k of Object.keys(checks)) if (now - checks[k] > 2 * 60 * 60_000) delete checks[k]
  localStorage.setItem(LS_KEY, JSON.stringify(checks))
}

async function narrate(prompt: string | undefined, fallback: string): Promise<string> {
  if (!prompt) return fallback
  try {
    return (await ask(prompt, { temperature: 0.4, maxTokens: 80 })) || fallback
  } catch {
    return fallback
  }
}

/** Runs only for roles that may act on the board (PM+); other roles just watch. Decisions come from logic/agentLoop. */
export function useAgentLoop(enabled = true) {
  useEffect(() => {
    if (!enabled) return
    const tick = async () => {
      const { tasks, team, sprint, escalations, autonomyConfig, addFeedEvent, assignTaskById, createEscalation } = useSprintStore.getState()
      const checks = getChecks()
      const now = Date.now()
      const actions = planAgentTick({
        tasks, team, sprint, escalations, config: autonomyConfig, now,
        canFire: (key) => !checks[key] || now - checks[key] > COOLDOWN_MS,
      })
      for (const a of actions) {
        setCheck(a.key)
        if (a.kind === 'reassign') {
          assignTaskById(a.taskId, a.toMemberId)
          addFeedEvent({ type: a.feedType, message: await narrate(a.prompt, a.message), taskId: a.feedTaskId, decision: 'ACT' })
        } else if (a.kind === 'escalate') {
          createEscalation(a.taskId, await narrate(a.prompt, a.reason), a.recommendation, a.urgency, a.category)
        } else {
          addFeedEvent({ type: a.type, message: await narrate(a.prompt, a.message), taskId: a.taskId, decision: a.decision })
        }
      }
    }

    const initial = setTimeout(tick, 10_000)
    const interval = setInterval(tick, LOOP_MS)
    return () => { clearTimeout(initial); clearInterval(interval) }
  }, [enabled])
}
