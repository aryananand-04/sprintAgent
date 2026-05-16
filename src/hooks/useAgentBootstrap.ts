import { useEffect } from 'react'
import { useSprintStore } from '../store/useSprintStore'
import { scoreGoalAlignment } from '../logic/goalAlignment'
import { generateSprintNarrative } from '../logic/sprintNarrative'

const SESSION_KEY    = 'sprint-agent-bootstrapped'
const BURNDOWN_KEY   = 'sprint-agent-burndown-date'

/**
 * Runs ONCE per browser session (not per React render).
 * Uses sessionStorage so Strict Mode double-invoke is harmless.
 */
export function useAgentBootstrap() {
  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY)) return
    sessionStorage.setItem(SESSION_KEY, '1')

    useSprintStore.setState({ isBootstrapping: true })

    const {
      tasks, triageTaskById, assignTaskById, addFeedEvent,
      recordBurndownSnapshot, setSprintNarrative, setGoalAlignment,
    } = useSprintStore.getState()

    // ── 1. Daily burndown snapshot ────────────────────────────────────────
    const todayKey = new Date().toISOString().slice(0, 10)
    if (localStorage.getItem(BURNDOWN_KEY) !== todayKey) {
      recordBurndownSnapshot()
      localStorage.setItem(BURNDOWN_KEY, todayKey)
    }

    // ── 2. Sprint narrative — always runs regardless of backlog state ──────
    setTimeout(async () => {
      const apiKey = import.meta.env.VITE_GROQ_API_KEY
      if (!apiKey || apiKey === 'paste_your_key_here') return
      const { tasks: t, sprint: s, team: tm, escalations: es } = useSprintStore.getState()
      const narrative = await generateSprintNarrative(s, t, tm, es, apiKey)
      if (narrative) setSprintNarrative(narrative)
    }, 3_000)

    // ── 3. Goal alignment scoring — always runs ───────────────────────────
    setTimeout(async () => {
      const apiKey = import.meta.env.VITE_GROQ_API_KEY
      if (!apiKey || apiKey === 'paste_your_key_here') return
      const { tasks: allTasks, sprint: sprintState } = useSprintStore.getState()
      const unscored = allTasks.filter(t => t.goalAlignment === undefined)
      for (const t of unscored) {
        try {
          const score = await scoreGoalAlignment(t, sprintState.goal, apiKey)
          setGoalAlignment(t.id, score)
          await new Promise(r => setTimeout(r, 400))
        } catch { /* skip */ }
      }
    }, 8_000)

    // ── 4. Triage unprocessed backlog tasks ───────────────────────────────
    const unprocessed = tasks.filter(
      t => (t.status === 'backlog' || t.status === 'triaged') && !t.isAITriaged
    )

    if (unprocessed.length === 0) {
      useSprintStore.setState({ isBootstrapping: false })
      return
    }

    addFeedEvent({
      type: 'status',
      message: `Agent online. Processing ${unprocessed.length} unanalyzed task${unprocessed.length > 1 ? 's' : ''}.`,
    })

    unprocessed.forEach((task, i) => {
      setTimeout(async () => {
        addFeedEvent({ type: 'triage', message: `Analyzing: "${task.title.slice(0, 60)}"`, taskId: task.id })
        await triageTaskById(task.id)
        const updated = useSprintStore.getState().tasks.find(t => t.id === task.id)
        if (updated?.decision === 'ACT' && !updated.assigneeId) {
          setTimeout(() => assignTaskById(task.id), 600)
        }
      }, i * 3000)
    })

    // Fix #4: post a summary after all triages complete
    setTimeout(() => {
      const state = useSprintStore.getState()
      const results = unprocessed.map(t => state.tasks.find(tt => tt.id === t.id)?.decision)
      const actN = results.filter(d => d === 'ACT').length
      const askN = results.filter(d => d === 'ASK').length
      const escN = results.filter(d => d === 'ESCALATE').length
      const parts: string[] = []
      if (actN > 0) parts.push(`${actN} ACT — assigned autonomously`)
      if (askN > 0) parts.push(`${askN} ASK — awaiting clarification`)
      if (escN > 0) parts.push(`${escN} ESCALATE — needs your review`)
      state.addFeedEvent({
        type: 'status',
        message: `Bootstrap complete. Processed ${unprocessed.length} task${unprocessed.length > 1 ? 's' : ''}: ${parts.join(', ')}.`,
      })
      useSprintStore.setState({ isBootstrapping: false })
    }, unprocessed.length * 3000 + 1500)
  }, [])
}
