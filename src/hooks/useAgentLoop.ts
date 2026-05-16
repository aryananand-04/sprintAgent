import { useEffect } from 'react'
import { useSprintStore } from '../store/useSprintStore'
import Groq from 'groq-sdk'

const LOOP_MS                  = 60_000
const COOLDOWN_MS              = 20 * 60_000
const LS_KEY                   = 'agent-loop-checks'
// Static thresholds not exposed in UI (structural, not policy)
const REBALANCE_TARGET_MAX   = 75
const BLOCKER_RESOLUTION_MAX = 70
const VELOCITY_DAYS_REMAINING = 7

function getChecks(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? '{}') } catch { return {} }
}
function setCheck(key: string) {
  const checks = getChecks()
  checks[key] = Date.now()
  const now = Date.now()
  for (const k of Object.keys(checks)) {
    if (now - checks[k] > 2 * 60 * 60_000) delete checks[k]
  }
  localStorage.setItem(LS_KEY, JSON.stringify(checks))
}
function canFire(key: string): boolean {
  const checks = getChecks()
  return !checks[key] || Date.now() - checks[key] > COOLDOWN_MS
}

async function narrate(prompt: string, fallback: string): Promise<string> {
  try {
    const apiKey = import.meta.env.VITE_GROQ_API_KEY
    if (!apiKey || apiKey === 'paste_your_key_here') return fallback
    const client = new Groq({ apiKey, dangerouslyAllowBrowser: true })
    const res = await client.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      max_tokens: 80,
    })
    return res.choices[0].message.content?.trim() ?? fallback
  } catch {
    return fallback
  }
}

export function useAgentLoop() {
  useEffect(() => {
    const tick = async () => {
      const { tasks, team, sprint, escalations, autonomyConfig, addFeedEvent, assignTaskById, createEscalation } =
        useSprintStore.getState()
      const now = Date.now()

      // ── 1. Capacity breach ──────────────────────────────────────────────
      for (const member of team.filter(m => m.currentLoad > autonomyConfig.capacityBreachThreshold)) {
        const key = `cap-${member.id}`
        if (!canFire(key)) continue
        setCheck(key)

        const memberTasks = tasks.filter(
          t => t.assigneeId === member.id && t.status !== 'done' && t.status !== 'blocked'
        )
        const lowest = memberTasks.sort((a, b) => (a.storyPoints ?? 2) - (b.storyPoints ?? 2))[0]
        if (!lowest) continue

        const candidate = team
          .filter(m2 => m2.id !== member.id && m2.currentLoad < REBALANCE_TARGET_MAX)
          .sort((a, b) => a.currentLoad - b.currentLoad)[0]

        if (candidate) {
          const msg = await narrate(
            `Sprint agent, 1 sentence, first person: ${member.name} at ${member.currentLoad}% load. Reassigning "${lowest.title}" to ${candidate.name} (${candidate.currentLoad}% load) to rebalance.`,
            `Capacity rebalance: ${member.name} at ${member.currentLoad}%. Moving "${lowest.title}" to ${candidate.name}.`
          )
          assignTaskById(lowest.id, candidate.id)
          addFeedEvent({ type: 'risk', message: msg, taskId: lowest.id, decision: 'ACT' })
        } else {
          const overloadedTask = memberTasks[0]
          if (overloadedTask) {
            createEscalation(
              overloadedTask.id,
              `${member.name} at ${member.currentLoad}% load — no teammates available to absorb work. PM decision needed on scope or deferral.`,
              'Review team capacity and decide: defer a task, add a resource, or descope.',
              'high',
              'capacity',
            )
          } else {
            addFeedEvent({ type: 'escalate', message: `${member.name} at ${member.currentLoad}% — no tasks to reassign and no available teammates.`, decision: 'ESCALATE' })
          }
        }
      }

      // ── 2. Blocked task — resolve, not just alert ────────────────────────
      for (const task of tasks.filter(t => t.status === 'blocked')) {
        const hoursBlocked = (now - new Date(task.createdAt).getTime()) / 3_600_000
        if (hoursBlocked < autonomyConfig.blockedHoursThreshold) continue
        const key = `blocked-${task.id}`
        if (!canFire(key)) continue
        setCheck(key)

        // Try to resolve: check if any dependency task can be re-assigned to unblock
        let resolved = false
        if (task.dependencies.length > 0) {
          for (const depId of task.dependencies) {
            const dep = tasks.find(t2 => t2.id === depId)
            if (!dep || dep.status === 'done') continue

            // Dependency is not done — find if we can accelerate it
            const depAssignee = dep.assigneeId ? team.find(m => m.id === dep.assigneeId) : null
            const isOverloaded = depAssignee && depAssignee.currentLoad > 80

            if (isOverloaded || !dep.assigneeId) {
              // Find a candidate with headroom who has relevant skills
              const candidate = team
                .filter(m => m.id !== dep.assigneeId && m.currentLoad < BLOCKER_RESOLUTION_MAX)
                .sort((a, b) => {
                  // Prefer skill match
                  const aMatch = a.skills.some(s => dep.tags?.includes(s) || dep.type === 'bug' && a.skills.includes('backend'))
                  const bMatch = b.skills.some(s => dep.tags?.includes(s) || dep.type === 'bug' && b.skills.includes('backend'))
                  if (aMatch && !bMatch) return -1
                  if (bMatch && !aMatch) return 1
                  return a.currentLoad - b.currentLoad
                })[0]

              if (candidate) {
                assignTaskById(dep.id, candidate.id)
                const msg = await narrate(
                  `Sprint agent, 1 sentence: "${task.title}" is blocked because "${dep.title}" isn't done. I've reassigned the dependency to ${candidate.name} (${candidate.currentLoad}% load) to unblock it.`,
                  `Resolved blocker: reassigned "${dep.title}" to ${candidate.name} to unblock "${task.title}" — blocked ${Math.round(hoursBlocked)}h.`
                )
                addFeedEvent({ type: 'resolve', message: msg, taskId: task.id, decision: 'ACT' })
                resolved = true
                break
              }
            }
          }
        }

        // Could not auto-resolve — create real escalation
        if (!resolved) {
          const reason = await narrate(
            `Sprint agent, 1 sentence, urgent: "${task.title}" blocked ${Math.round(hoursBlocked)}h with no autonomous resolution path. State what specifically needs to happen.`,
            `"${task.title}" blocked ${Math.round(hoursBlocked)}h — no auto-resolution available. PM needs to: ${task.decisionReason?.slice(0, 80) ?? 'clarify the blocker and assign next action'}.`
          )
          createEscalation(
            task.id,
            reason,
            'Clarify the blocker and assign a next action so the agent can proceed.',
            task.urgency === 'critical' ? 'critical' : 'high',
            'blocker',
          )
        }
      }

      // ── 3. Velocity trend ───────────────────────────────────────────────
      if (canFire('velocity')) {
        const sprintLength = Math.max(1, Math.ceil((new Date(sprint.endDate).getTime() - new Date(sprint.startDate).getTime()) / 86_400_000))
        const daysElapsed = Math.max(1, Math.ceil((Date.now() - new Date(sprint.startDate).getTime()) / 86_400_000))
        const expected    = (sprint.committedPoints / sprintLength) * Math.min(daysElapsed, sprintLength)
        const deficit     = expected - sprint.completedPoints

        if (deficit > autonomyConfig.velocityDeficitPts && sprint.daysRemaining <= VELOCITY_DAYS_REMAINING) {
          setCheck('velocity')
          const msg = await narrate(
            `Sprint agent, 1 sentence: ${sprint.completedPoints}/${sprint.committedPoints} pts, ${sprint.daysRemaining} days left, ${Math.round(deficit)}-pt deficit. State risk and what I recommend dropping or accelerating.`,
            `Velocity alert: ${Math.round(deficit)} points behind pace with ${sprint.daysRemaining} days remaining — recommend de-scoping low-priority backlog items.`
          )
          addFeedEvent({ type: 'risk', message: msg, decision: 'ASK' })
        }
      }

      // ── 4. Critical unassigned — respects autonomyConfig threshold ────────
      for (const task of tasks.filter(t => t.urgency === 'critical' && !t.assigneeId && t.status !== 'done' && t.status !== 'blocked')) {
        const hoursUnassigned = (now - new Date(task.createdAt).getTime()) / 3_600_000
        if (hoursUnassigned < autonomyConfig.escalateIfCriticalUnassignedHours) continue
        const key = `critical-unassigned-${task.id}`
        if (!canFire(key)) continue
        setCheck(key)
        createEscalation(
          task.id,
          `Critical task unassigned for ${Math.round(hoursUnassigned)}h — exceeds the configured ${autonomyConfig.escalateIfCriticalUnassignedHours}h threshold. Sprint goal at risk.`,
          'Assign this task immediately or explicitly defer it to unblock the agent.',
          'critical',
          'missing-criteria',
        )
      }

      // ── 5. Escalation aging nudge ───────────────────────────────────────
      for (const esc of escalations.filter(e => !e.resolved)) {
        const ageH = (now - new Date(esc.createdAt).getTime()) / 3_600_000
        if (ageH < autonomyConfig.escNudgeHours) continue
        const key = `esc-nudge-${esc.id}`
        if (!canFire(key)) continue
        setCheck(key)
        addFeedEvent({
          type: 'escalate',
          message: `"${esc.taskTitle}" — ${Math.round(ageH)}h without a decision. I cannot proceed autonomously. Nudging PM for resolution.`,
          taskId: esc.taskId,
          decision: 'ESCALATE',
        })
      }
    }

    const initial  = setTimeout(tick, 10_000)
    const interval = setInterval(tick, LOOP_MS)
    return () => { clearTimeout(initial); clearInterval(interval) }
  }, [])
}
