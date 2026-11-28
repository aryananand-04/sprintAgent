// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { useEffect } from 'react'
import { useSprintStore } from '../store/useSprintStore'
import { scoreGoalAlignment } from '../services/goalAlignment'
import { generateSprintNarrative } from '../services/sprintNarrative'

const SESSION_KEY    = 'sprint-agent-bootstrapped'
const BURNDOWN_KEY   = 'sprint-agent-burndown-date'

/**
 * Once per browser session (sessionStorage, so Strict Mode's double-invoke is harmless), for PM+ only:
 * burndown snapshot, sprint narrative and goal-alignment scores. Triage happens on the server.
 */
export function useAgentBootstrap(enabled = true) {
  useEffect(() => {
    if (!enabled) return
    if (sessionStorage.getItem(SESSION_KEY)) return
    sessionStorage.setItem(SESSION_KEY, '1')

    const { recordBurndownSnapshot, setSprintNarrative, setGoalAlignment } = useSprintStore.getState()

    // ── 1. Daily burndown snapshot ────────────────────────────────────────
    const todayKey = new Date().toISOString().slice(0, 10)
    if (localStorage.getItem(BURNDOWN_KEY) !== todayKey) {
      recordBurndownSnapshot()
      localStorage.setItem(BURNDOWN_KEY, todayKey)
    }

    // ── 2. Sprint narrative — always runs regardless of backlog state ──────
    setTimeout(async () => {
      const { tasks: t, sprint: s, escalations: es } = useSprintStore.getState()
      const narrative = await generateSprintNarrative(s, t, es)
      if (narrative) setSprintNarrative(narrative)
    }, 3_000)

    // ── 3. Goal alignment scoring — always runs ───────────────────────────
    setTimeout(async () => {
      const { tasks: allTasks, sprint: sprintState } = useSprintStore.getState()
      const unscored = allTasks.filter(t => t.goalAlignment === undefined)
      for (const t of unscored) {
        try {
          const score = await scoreGoalAlignment(t, sprintState.goal)
          setGoalAlignment(t.id, score)
          await new Promise(r => setTimeout(r, 400))
        } catch { break /* AI unavailable — stop the loop */ }
      }
    }, 8_000)
  }, [enabled])
}
