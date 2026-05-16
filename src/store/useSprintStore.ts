import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  Task, TeamMember, Sprint, FeedEvent, EscalationItem,
  TaskStatus, AgentDecision, UrgencyLevel,
  AutonomyConfig, SprintArchive, BurndownSnapshot,
  CalibrationData, AgentActionSnapshot,
} from '../types'
import { INITIAL_TASKS } from '../data/tasks'
import { TEAM } from '../data/team'
import { SPRINT, INITIAL_ESCALATIONS, INITIAL_FEED, INITIAL_SPRINT_HISTORY, INITIAL_BURNDOWN } from '../data/sprint'
import { triageTask } from '../logic/triage'
import { triageWithAI } from '../logic/triageAI'
import { findBestAssignee } from '../logic/assign'
import { resolveAdHoc } from '../logic/adHoc'
import { LOAD_ELIGIBILITY_THRESHOLD, LOAD_MAX, LOAD_BASELINE } from '../logic/constants'
import { computeSprintRisk } from '../logic/scoring'
import { scoreGoalAlignment } from '../logic/goalAlignment'

type View = 'sprint' | 'intake' | 'triage' | 'escalations' | 'briefings' | 'autonomy' | 'timeline' | 'review' | 'rationale' | 'planner'

const DEFAULT_AUTONOMY: AutonomyConfig = {
  actMinClarity:   3,
  askMaxClarity:   2,
  escalateIfCriticalUnassignedHours: 1,
  neverAutoAssignTypes: [],
  capacityBreachThreshold: 90,
  blockedHoursThreshold:   2,
  escNudgeHours:           4,
  velocityDeficitPts:      6,
}

interface SprintStore {
  tasks: Task[]
  team: TeamMember[]
  sprint: Sprint
  feed: FeedEvent[]
  escalations: EscalationItem[]
  activeView: View
  selectedTaskId: string | null
  isTriagePanelOpen: boolean
  isPolicyPanelOpen: boolean
  isDemoOpen: boolean
  triagingTaskId: string | null
  triageError: string | null
  isBootstrapping: boolean

  slackWebhookUrl: string
  outboundWebhookUrl: string          // fires on ALL agent decisions
  autonomyConfig: AutonomyConfig
  sprintHistory: SprintArchive[]
  burndownSnapshots: BurndownSnapshot[]
  calibration: CalibrationData
  actionHistory: AgentActionSnapshot[]
  sprintNarrative: string // undo stack (last 10)

  setView: (view: View) => void
  selectTask: (id: string | null) => void
  setTriagePanelOpen: (open: boolean) => void
  setPolicyPanelOpen: (open: boolean) => void
  setDemoOpen: (open: boolean) => void

  triageTaskById: (taskId: string) => Promise<void>
  assignTaskById: (taskId: string, memberId?: string) => void
  updateTaskStatus: (taskId: string, status: TaskStatus) => void
  addAdHocTask: (title: string, description: string, urgency?: UrgencyLevel) => void
  addTaskToColumn: (title: string, status: TaskStatus, assigneeId?: string) => void
  addComment: (taskId: string, text: string, author?: string) => void
  createEscalation: (taskId: string, reason: string, recommendation: string, urgency: EscalationItem['urgency'], category: EscalationItem['category']) => void
  resolveEscalation: (escalationId: string) => void
  addFeedEvent: (event: Omit<FeedEvent, 'id' | 'timestamp'>) => void
  importTasks: (tasks: Task[]) => void
  bulkAssign: (taskIds: string[]) => void
  setGoalAlignment: (taskId: string, score: number) => void
  setAcceptanceCriteria: (taskId: string, criteria: string[], approved: boolean) => void
  undoLastAgentAction: () => void
  exportToCSV: () => void

  setSprintNarrative: (text: string) => void
  setSlackWebhookUrl: (url: string) => void
  setOutboundWebhookUrl: (url: string) => void
  setAutonomyConfig: (config: Partial<AutonomyConfig>) => void
  archiveSprint: () => void
  openArchivedSprint: (id: string) => void
  startNewSprint: (config: { name: string; goal: string; startDate: string; endDate: string; committedPoints: number }) => void
  recordBurndownSnapshot: () => void

  triggerScenario: (scenarioId: string) => void
}

let feedCounter = 100

function newFeedId() {
  return `feed-${++feedCounter}`
}

function now() {
  return new Date().toISOString()
}

// Adjusts team load deltas when tasks are reassigned or change status.
// Uses the member's actual story point assignments relative to their capacity.
// Seeded loads represent mid-sprint reality (including meetings, code review, overhead) —
// we add/subtract the task's proportional share rather than recomputing from scratch.

function computeLoadsFromTasks(tasks: Task[], team: TeamMember[]): TeamMember[] {
  return team.map(m => {
    const activePts = tasks
      .filter(t => t.assigneeId === m.id && ['in-progress', 'assigned', 'blocked'].includes(t.status))
      .reduce((sum, t) => sum + (t.storyPoints ?? 2), 0)
    return { ...m, currentLoad: Math.min(LOAD_MAX, LOAD_BASELINE + Math.round((activePts / Math.max(m.capacity, 1)) * 45)) }
  })
}

// Recomputes sprint health from live state and patches it in one set() call.
// Call this after any change to tasks, escalations, or sprint points.
function refreshSprintHealth(get: () => SprintStore, set: (s: Partial<SprintStore>) => void) {
  const { tasks, escalations, sprint } = get()
  const daysRemaining = Math.max(0, Math.ceil((new Date(sprint.endDate).getTime() - Date.now()) / 86_400_000))
  const completedPct = sprint.committedPoints > 0 ? sprint.completedPoints / sprint.committedPoints : 0
  const openEsc = escalations.filter(e => !e.resolved).length
  const blockedCount = tasks.filter(t => t.status === 'blocked').length
  const health = computeSprintRisk(completedPct, openEsc, blockedCount, daysRemaining, sprint.committedPoints, sprint.completedPoints)
  if (health !== sprint.health || daysRemaining !== sprint.daysRemaining) {
    set({ sprint: { ...sprint, health, daysRemaining } })
  }
}

export const useSprintStore = create<SprintStore>()(
  persist(
    (set, get) => ({
  tasks: INITIAL_TASKS,
  team: computeLoadsFromTasks(INITIAL_TASKS, TEAM),
  sprint: SPRINT,
  slackWebhookUrl: '',
  outboundWebhookUrl: '',
  autonomyConfig: DEFAULT_AUTONOMY,
  sprintHistory: INITIAL_SPRINT_HISTORY,
  burndownSnapshots: INITIAL_BURNDOWN,
  calibration: { act: { correct: 0, total: 0 }, ask: { correct: 0, total: 0 }, escalate: { correct: 0, total: 0 } },
  actionHistory: [],
  sprintNarrative: '',
  feed: INITIAL_FEED,
  escalations: INITIAL_ESCALATIONS,
  activeView: 'sprint',
  selectedTaskId: null,
  isTriagePanelOpen: false,
  isPolicyPanelOpen: false,
  isDemoOpen: false,
  triagingTaskId: null,
  triageError: null,
  isBootstrapping: false,

  setView: (view) => set({ activeView: view }),
  selectTask: (id) => set({ selectedTaskId: id }),
  setTriagePanelOpen: (open) => set({ isTriagePanelOpen: open }),
  setPolicyPanelOpen: (open) => set({ isPolicyPanelOpen: open }),
  setDemoOpen: (open) => set({ isDemoOpen: open }),

  addFeedEvent: (event) => {
    const full: FeedEvent = { ...event, id: newFeedId(), timestamp: now() }
    set((s) => {
      const next = [full, ...s.feed]
      return { feed: next.slice(0, 100) }
    })
  },

  triageTaskById: async (taskId) => {
    const { tasks, addFeedEvent, autonomyConfig } = get()
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return

    set({ triagingTaskId: taskId, triageError: null })

    let result
    let isAITriaged = false

    try {
      result = await triageWithAI(task, autonomyConfig)
      isAITriaged = true
    } catch (err) {
      result = triageTask(task, autonomyConfig)
      const msg = err instanceof Error ? err.message : String(err)
      if (msg !== 'NO_API_KEY') {
        set({ triageError: 'AI unavailable — using offline analysis' })
      }
    }

    const effectiveDecision = result.decision

    const bestAssignee = findBestAssignee(task, get().team, get().tasks)
    set((s) => ({
      triagingTaskId: null,
      tasks: s.tasks.map((t) =>
        t.id === taskId
          ? {
              ...t,
              decision: effectiveDecision,
              decisionReason: result.reason,
              triageScore: result.score,
              isAITriaged,
              confidence: bestAssignee?.confidence ?? t.confidence,
              status: t.status === 'backlog' ? 'triaged' : t.status,
            }
          : t,
      ),
    }))

    addFeedEvent({
      type: 'triage',
      message: `${isAITriaged ? '[AI] ' : ''}Triaged "${task.title}" → ${effectiveDecision}. Score: ${result.score}. ${result.reason.slice(0, 80)}...`,
      taskId,
      decision: effectiveDecision,
    })

    // Score goal alignment if not yet scored — runs in background, no blocking
    const freshTask = get().tasks.find(t => t.id === taskId)
    if (freshTask && freshTask.goalAlignment === undefined) {
      const apiKey = import.meta.env.VITE_GROQ_API_KEY
      if (apiKey && apiKey !== 'paste_your_key_here') {
        scoreGoalAlignment(freshTask, get().sprint.goal, apiKey).then(score => {
          get().setGoalAlignment(taskId, score)
        }).catch(() => {})
      }
    }

    // Track total triage decisions for calibration (correct completions tracked at done-time)
    if (effectiveDecision === 'ACT') {
      set(s => ({ calibration: { ...s.calibration, act: { ...s.calibration.act, total: s.calibration.act.total + 1 } } }))
    } else if (effectiveDecision === 'ASK') {
      set(s => ({ calibration: { ...s.calibration, ask: { ...s.calibration.ask, total: s.calibration.ask.total + 1 } } }))
    } else if (effectiveDecision === 'ESCALATE') {
      set(s => ({ calibration: { ...s.calibration, escalate: { ...s.calibration.escalate, total: s.calibration.escalate.total + 1 } } }))
    }

    if (effectiveDecision === 'ESCALATE') {
      const category = task.clarity <= 1 ? 'missing-criteria' : task.risk >= 5 ? 'blocker' : 'ambiguous'
      get().createEscalation(
        taskId,
        result.reason,
        'Review triage analysis and provide clarification or approval to unblock this task.',
        task.urgency,
        category,
      )
    }
  },

  assignTaskById: (taskId, forceMemberId) => {
    const { tasks, team, addFeedEvent } = get()
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return

    let assigneeId: string | undefined
    let confidence = 80
    let rationale = ''

    if (forceMemberId) {
      const member = team.find((m) => m.id === forceMemberId)
      assigneeId = forceMemberId
      confidence = 70
      rationale = `Manually assigned to ${member?.name ?? forceMemberId}.`
    } else {
      const result = findBestAssignee(task, team, tasks)
      if (!result) return
      assigneeId = result.memberId
      confidence = result.confidence
      rationale = result.rationale
    }

    const previousAssigneeId = task.assigneeId

    // Snapshot for undo
    const snapshot: AgentActionSnapshot = {
      id: `action-${Date.now()}`,
      type: 'assign',
      taskId,
      taskTitle: task.title,
      previousTaskState: { assigneeId: task.assigneeId, status: task.status },
      previousTeamLoads: Object.fromEntries(get().team.map(m => [m.id, m.currentLoad])),
      timestamp: now(),
      description: `Assigned "${task.title}" to ${assigneeId}`,
    }

    // Feed first — so island shows event in the same render as the task update
    addFeedEvent({ type: 'assign', message: rationale, taskId, memberId: assigneeId, decision: 'ACT' })

    set((s) => {
      const updatedTasks = s.tasks.map((t) =>
        t.id === taskId
          ? { ...t, assigneeId, confidence, decisionReason: rationale, status: (t.status === 'triaged' || t.status === 'backlog') ? 'assigned' : t.status }
          : t,
      )
      return { tasks: updatedTasks, team: computeLoadsFromTasks(updatedTasks, s.team) }
    })

    // Store snapshot for undo (keep last 10)
    set(s => ({ actionHistory: [snapshot, ...s.actionHistory].slice(0, 10) }))

    // Outbound webhook — fires on every agent decision
    const { outboundWebhookUrl } = get()
    if (outboundWebhookUrl) {
      fetch(outboundWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: 'ACT', type: 'assign', taskId, taskTitle: task.title, assigneeId, rationale, timestamp: now() }),
      }).catch(() => {
        get().addFeedEvent({ type: 'risk', message: `Outbound webhook failed — check the URL in Agent Settings.`, decision: 'ASK' })
      })
    }
  },

  updateTaskStatus: (taskId, status) => {
    const { tasks, addFeedEvent } = get()
    const task = tasks.find(t => t.id === taskId)
    if (!task) return

    // Dependency enforcement: block in-progress if dependencies aren't done
    if (status === 'in-progress' && task.dependencies.length > 0) {
      const blockers = task.dependencies.filter(depId => {
        const dep = tasks.find(t => t.id === depId)
        return dep && dep.status !== 'done'
      })
      if (blockers.length > 0) {
        const blockerTitles = blockers.map(id => tasks.find(t => t.id === id)?.title ?? id)
        addFeedEvent({
          type: 'escalate',
          message: `Cannot start "${task.title}" — ${blockers.length} dependency${blockers.length > 1 ? 'ies' : ''} not yet done: ${blockerTitles.join(', ')}. Resolve blockers first.`,
          taskId,
          decision: 'ESCALATE',
        })
        return  // block the status change
      }
    }

    set(s => {
      const updatedTasks = s.tasks.map(t => t.id === taskId ? { ...t, status } : t)
      return { tasks: updatedTasks, team: computeLoadsFromTasks(updatedTasks, s.team) }
    })

    if (status === 'done') {
      set(s => ({ sprint: { ...s.sprint, completedPoints: s.sprint.completedPoints + (task.storyPoints ?? 2) } }))
      addFeedEvent({ type: 'status', message: `"${task.title}" complete. +${task.storyPoints ?? 2} pts.`, taskId, decision: 'ACT' })
      if (task.decision === 'ACT') {
        set(s => ({ calibration: { ...s.calibration, act: { ...s.calibration.act, correct: s.calibration.act.correct + 1 } } }))

        // Self-tuning: adjust actMinClarity based on ACT accuracy
        const { calibration, autonomyConfig, addFeedEvent: afe } = get()
        const { act } = calibration
        if (act.total >= 5) {
          const accuracy = act.correct / act.total
          const current = autonomyConfig.actMinClarity
          if (accuracy < 0.6 && current < 5) {
            get().setAutonomyConfig({ actMinClarity: current + 1 })
            afe({ type: 'status', message: `Agent self-tuned: ACT accuracy ${Math.round(accuracy * 100)}% over ${act.total} decisions — raising clarity threshold to ${current + 1}/5 to reduce false positives.`, decision: 'ASK' })
          } else if (accuracy >= 0.9 && act.total >= 10 && current > 2) {
            get().setAutonomyConfig({ actMinClarity: current - 1 })
            afe({ type: 'status', message: `Agent self-tuned: ACT accuracy ${Math.round(accuracy * 100)}% over ${act.total} decisions — lowering clarity threshold to ${current - 1}/5 for more autonomy.`, decision: 'ACT' })
          }
        }
      }
      get().recordBurndownSnapshot()
    }

    refreshSprintHealth(get, s => set(s as Partial<SprintStore>))
  },

  addAdHocTask: (title, description, urgency = 'medium') => {
    const { sprint, team, tasks, addFeedEvent } = get()

    const newTask: Task = {
      id: `adhoc-${Date.now()}`,
      title,
      description,
      type: 'ad-hoc',
      status: 'backlog',
      urgency,
      impact: urgency === 'critical' ? 5 : urgency === 'high' ? 4 : 3,
      effort: 2,
      risk: 2,
      clarity: 3,
      dependencies: [],
      source: 'Ad-hoc / Intake',
      isAdHoc: true,
      isNew: true,
      storyPoints: 2,
      createdAt: now(),
    }

    const decision = resolveAdHoc(newTask, sprint, team, tasks, get().autonomyConfig)
    const triageResult = triageTask({ ...newTask, decision: decision.resolution === 'escalate' ? 'ESCALATE' : 'ACT' }, get().autonomyConfig)

    const finalTask: Task = {
      ...newTask,
      decision: triageResult.decision,
      decisionReason: decision.rationale,
      triageScore: triageResult.score,
      adHocResolution: decision.resolution,
      adHocSwappedTaskId: decision.swapCandidateId,
    }

    set((s) => ({ tasks: [finalTask, ...s.tasks] }))

    if (decision.resolution === 'swap' && decision.swapCandidateId) {
      set((s) => ({
        tasks: s.tasks.map((t) =>
          t.id === decision.swapCandidateId
            ? { ...t, status: 'backlog', urgency: 'low' as const }
            : t,
        ),
      }))
      addFeedEvent({
        type: 'adHoc',
        message: `Swapped "${decision.swapCandidateTitle}" to backlog to make room for "${title}". Sprint capacity preserved.`,
        taskId: decision.swapCandidateId,
        decision: 'ACT',
      })
    }

    addFeedEvent({
      type: 'adHoc',
      message: `New request: "${title}". Agent triaging now…`,
      taskId: finalTask.id,
    })

    // Agent auto-triages with AI immediately — no button click needed
    setTimeout(() => {
      get().triageTaskById(finalTask.id).then(() => {
        const updated = useSprintStore.getState().tasks.find(t => t.id === finalTask.id)
        // If ACT and unassigned, auto-assign — agent acts end-to-end
        if (updated?.decision === 'ACT' && !updated.assigneeId) {
          setTimeout(() => get().assignTaskById(finalTask.id), 800)
        }
      })
    }, 400)
  },

  addTaskToColumn: (title, status, assigneeId) => {
    const { team, tasks, addFeedEvent } = get()
    const member = assigneeId ? team.find(m => m.id === assigneeId) : undefined

    const newTask: Task = {
      id: `task-manual-${Date.now()}`,
      title,
      description: '',
      type: 'chore',
      status,
      urgency: 'medium',
      /* No description = genuinely unknown. Set conservative defaults so
         the deterministic triage doesn't fake confidence on empty tasks.
         clarity:1 → will produce ASK/ESCALATE until AI triages it properly. */
      impact: 2, effort: 3, risk: 3, clarity: 1,
      assigneeId,
      dependencies: [],
      source: 'Manual / Board',
      storyPoints: 2,
      createdAt: now(),
      isNew: true,
    }

    set(s => {
      const updatedTasks = [newTask, ...s.tasks]
      return { tasks: updatedTasks, team: computeLoadsFromTasks(updatedTasks, s.team) }
    })

    addFeedEvent({
      type: 'intake',
      message: `"${title}" added to ${status}. Agent analyzing…`,
      taskId: newTask.id,
    })

    // Auto-triage every manually added task — agent owns this, not the PM
    setTimeout(() => {
      get().triageTaskById(newTask.id).then(() => {
        const updated = useSprintStore.getState().tasks.find(t => t.id === newTask.id)
        if (updated?.decision === 'ACT' && !updated.assigneeId) {
          setTimeout(() => get().assignTaskById(newTask.id), 600)
        }
      })
    }, 300)
  },

  addComment: (taskId, text, author = 'PM') => {
    const comment = {
      id: `comment-${Date.now()}`,
      text,
      author,
      timestamp: now(),
    }
    set(s => ({
      tasks: s.tasks.map(t =>
        t.id === taskId
          ? { ...t, comments: [...(t.comments ?? []), comment] }
          : t,
      ),
    }))
  },

  setGoalAlignment: (taskId, score) =>
    set(s => ({ tasks: s.tasks.map(t => t.id === taskId ? { ...t, goalAlignment: score } : t) })),

  setAcceptanceCriteria: (taskId, criteria, approved) => {
    const title = get().tasks.find(t => t.id === taskId)?.title ?? taskId
    set(s => ({
      tasks: s.tasks.map(t => t.id === taskId
        ? {
            ...t,
            acceptanceCriteria: criteria,
            clarity: approved ? Math.max(t.clarity, 3) : t.clarity,
            decision: approved ? undefined : t.decision,
            decisionReason: approved ? undefined : t.decisionReason,
            isAITriaged: approved ? false : t.isAITriaged,
          }
        : t
      ),
    }))
    if (approved) {
      get().addFeedEvent({
        type: 'triage',
        message: `PM approved acceptance criteria for "${title}". Clarity updated — re-triaging now.`,
        taskId, decision: 'ACT',
      })
      // Trigger real re-triage so decision and reason are immediately refreshed
      get().triageTaskById(taskId)
    }
  },

  undoLastAgentAction: () => {
    const { actionHistory, addFeedEvent } = get()
    const last = actionHistory[0]
    if (!last) return

    set(s => ({
      actionHistory: s.actionHistory.slice(1),
      tasks: s.tasks.map(t => t.id === last.taskId ? { ...t, ...last.previousTaskState } : t),
      team: s.team.map(m => ({
        ...m,
        currentLoad: last.previousTeamLoads[m.id] ?? m.currentLoad,
      })),
    }))

    addFeedEvent({
      type: 'status',
      message: `Undid: "${last.description}". Task "${last.taskTitle}" reverted to previous state.`,
      taskId: last.taskId,
    })
  },

  exportToCSV: () => {
    const { tasks, team } = get()
    const headers = ['ID', 'Title', 'Type', 'Status', 'Urgency', 'Assignee', 'Story Points', 'Decision', 'Score', 'Goal Alignment', 'Description']
    const rows = tasks.map(t => {
      const assignee = team.find(m => m.id === t.assigneeId)?.name ?? ''
      return [
        t.id, `"${t.title.replace(/"/g, '""')}"`, t.type, t.status, t.urgency,
        assignee, t.storyPoints ?? '', t.decision ?? '', t.triageScore ?? '',
        t.goalAlignment ?? '', `"${(t.description ?? '').replace(/"/g, '""')}"`,
      ].join(',')
    })
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sprint-${get().sprint.name.replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  },

  setSprintNarrative: (text) => set({ sprintNarrative: text }),
  setSlackWebhookUrl: (url) => set({ slackWebhookUrl: url }),
  setOutboundWebhookUrl: (url) => set({ outboundWebhookUrl: url }),

  setAutonomyConfig: (config) =>
    set(s => ({ autonomyConfig: { ...s.autonomyConfig, ...config } })),

  importTasks: (newTasks) => {
    set(s => {
      const updatedTasks = [...newTasks, ...s.tasks]
      const addedPts = newTasks.reduce((sum, t) => sum + (t.storyPoints ?? 2), 0)
      return {
        tasks: updatedTasks,
        team: computeLoadsFromTasks(updatedTasks, s.team),
        sprint: {
          ...s.sprint,
          committedPoints: s.sprint.committedPoints + addedPts,
          totalPoints:     s.sprint.totalPoints     + addedPts,
        },
      }
    })
    get().addFeedEvent({
      type: 'intake',
      message: `Imported ${newTasks.length} tasks into backlog. Triage is running in the background.`,
    })
  },

  // Assigns many tasks in one pass — computes all assignments upfront using a virtual
  // load tracker so no intermediate state spikes kill the assignment queue.
  // Tasks that would push a member past 90% are escalated rather than silently dropped.
  bulkAssign: (taskIds) => {
    const { tasks, team, addFeedEvent } = get()

    // Virtual load starts at current real loads
    const vLoad: Record<string, number> = Object.fromEntries(
      team.map(m => [m.id, m.currentLoad])
    )

    const taskMap = new Map(tasks.map(t => [t.id, { ...t }]))
    let assigned = 0, skipped = 0, escalated = 0

    for (const taskId of taskIds) {
      const task = taskMap.get(taskId)
      if (!task || task.assigneeId) { skipped++; continue }

      const eligible = team
        .filter(m => vLoad[m.id] < LOAD_ELIGIBILITY_THRESHOLD)
        .sort((a, b) => {
          const tokens = [task.type, ...(task.tags ?? [])]
          const aSkill = a.skills.some(s => tokens.some(tok => tok?.includes(s) || s.includes(tok ?? '')))
          const bSkill = b.skills.some(s => tokens.some(tok => tok?.includes(s) || s.includes(tok ?? '')))
          if (aSkill !== bSkill) return aSkill ? -1 : 1
          return vLoad[a.id] - vLoad[b.id]
        })

      if (eligible.length > 0) {
        const member = eligible[0]
        const pts = task.storyPoints ?? 2
        taskMap.set(taskId, {
          ...task,
          assigneeId: member.id,
          status: (task.status === 'backlog' || task.status === 'triaged') ? 'assigned' : task.status,
          decisionReason: `Bulk assigned to ${member.name} — ${Math.round(vLoad[member.id])}% load, best skill fit.`,
        })
        vLoad[member.id] = Math.min(LOAD_MAX, vLoad[member.id] + Math.round((pts / Math.max(member.capacity, 1)) * 45))
        assigned++
      } else {
        // All engineers at 90%+ — agent escalates rather than overloading the team
        taskMap.set(taskId, {
          ...task,
          decision: 'ESCALATE' as const,
          isAITriaged: false,
          decisionReason: `All engineers at ${LOAD_ELIGIBILITY_THRESHOLD}%+ capacity. Sprint overloaded — PM must decide: defer, descope, or add capacity.`,
        })
        escalated++
      }
    }

    const finalTasks = tasks.map(t => taskMap.get(t.id) ?? t)

    const newTeam = computeLoadsFromTasks(finalTasks, team)

    set({ tasks: finalTasks, team: newTeam })

    const parts: string[] = []
    if (assigned  > 0) parts.push(`${assigned} assigned`)
    if (escalated > 0) parts.push(`${escalated} escalated (team at capacity)`)
    addFeedEvent({
      type: 'assign',
      message: `Bulk assignment: ${parts.join(', ')}. ${escalated > 0 ? 'Open Escalations to review overloaded tasks.' : 'Sprint board updated.'}`,
      decision: 'ACT',
    })
  },

  archiveSprint: () => {
    const { tasks, sprint, escalations, burndownSnapshots, sprintHistory, addFeedEvent } = get()
    if (sprintHistory[0]?.name === sprint.name) return
    const recentVelocities = [sprint.completedPoints, ...sprintHistory.slice(0, 2).map(h => h.completedPoints)]
    const newVelocity = Math.round(recentVelocities.reduce((a, b) => a + b, 0) / recentVelocities.length)
    const archive: SprintArchive = {
      id: `archive-${Date.now()}`,
      name: sprint.name,
      goal: sprint.goal,
      startDate: sprint.startDate,
      completedPoints: sprint.completedPoints,
      committedPoints: sprint.committedPoints,
      velocity: newVelocity,
      health: sprint.health,
      endDate: new Date().toISOString(),
      taskCount: tasks.length,
      doneCount: tasks.filter(t => t.status === 'done').length,
      escalationCount: escalations.length,
      snapshot: { tasks: [...tasks], escalations: [...escalations], burndownSnapshots: [...burndownSnapshots], sprint: { ...sprint } },
    }
    set(s => ({
      sprintHistory: [archive, ...s.sprintHistory],
      sprint: { ...s.sprint, velocity: newVelocity },
    }))
    addFeedEvent({ type: 'status', message: `Sprint "${sprint.name}" archived. Velocity: ${sprint.completedPoints}/${sprint.committedPoints} pts. Rolling avg: ${newVelocity}pt.` })
  },

  openArchivedSprint: (id) => {
    const { sprintHistory, sprint, tasks, escalations, burndownSnapshots, addFeedEvent } = get()
    const archived = sprintHistory.find(s => s.id === id)
    if (!archived?.snapshot) return

    // Inline-save current sprint only if not already in history (avoids calling archiveSprint recursively)
    const currentAlreadySaved = sprintHistory.some(h => h.name === sprint.name)
    if (!currentAlreadySaved) {
      const recentVelocities = [sprint.completedPoints, ...sprintHistory.slice(0, 2).map(h => h.completedPoints)]
      const v = Math.round(recentVelocities.reduce((a, b) => a + b, 0) / recentVelocities.length)
      const entry: SprintArchive = {
        id: `archive-${Date.now()}`,
        name: sprint.name, goal: sprint.goal, startDate: sprint.startDate,
        completedPoints: sprint.completedPoints, committedPoints: sprint.committedPoints,
        velocity: v, health: sprint.health,
        endDate: new Date().toISOString(),
        taskCount: tasks.length,
        doneCount: tasks.filter(t => t.status === 'done').length,
        escalationCount: escalations.length,
        snapshot: { tasks: [...tasks], escalations: [...escalations], burndownSnapshots: [...burndownSnapshots], sprint: { ...sprint } },
      }
      set(s => ({ sprintHistory: [entry, ...s.sprintHistory] }))
    }

    const { tasks: archivedTasks, escalations: archivedEsc, burndownSnapshots: archivedBurndown, sprint: archivedSprint } = archived.snapshot
    set(s => ({
      sprint: { ...archivedSprint, daysRemaining: Math.max(0, Math.ceil((new Date(archivedSprint.endDate).getTime() - Date.now()) / 86_400_000)) },
      tasks: [...archivedTasks],
      escalations: [...archivedEsc],
      burndownSnapshots: [...archivedBurndown],
      team: computeLoadsFromTasks(archivedTasks, s.team),
      feed: [],
      actionHistory: [],
    }))
    addFeedEvent({ type: 'status', message: `Opened archived sprint: "${archived.name}". All task and escalation data restored.` })
  },

  startNewSprint: ({ name, goal, startDate, endDate, committedPoints }) => {
    // Archive current sprint with full snapshot before clearing state
    get().archiveSprint()
    const { sprint, tasks, addFeedEvent } = get()
    const newSprint: Sprint = {
      id: `sprint-${Date.now()}`,
      name, goal, startDate, endDate,
      totalPoints: committedPoints + 20,
      committedPoints,
      completedPoints: 0,
      health: 'green',
      daysRemaining: Math.max(0, Math.ceil((new Date(endDate).getTime() - Date.now()) / 86_400_000)),
      velocity: sprint.velocity,
    }
    // Carry unfinished tasks to backlog, drop done tasks
    const carriedTasks = tasks
      .filter(t => t.status !== 'done')
      .map(t => ({ ...t, status: 'backlog' as const, assigneeId: undefined, decision: undefined, isAITriaged: false }))
    set(s => ({
      sprint: newSprint,
      tasks: carriedTasks,
      team: computeLoadsFromTasks(carriedTasks, s.team),
      escalations: [],
      burndownSnapshots: [],
      feed: [],
      actionHistory: [],
    }))
    get().addFeedEvent({ type: 'status', message: `${name} started. Goal: "${goal}". Agent is ready — add tasks to begin sprint.` })
  },

  recordBurndownSnapshot: () => {
    const { sprint } = get()
    const today = new Date().toISOString().slice(0, 10)
    const sprintLength = Math.max(1, Math.ceil(
      (new Date(sprint.endDate).getTime() - new Date(sprint.startDate).getTime()) / 86_400_000
    ))
    const daysElapsed = Math.max(1, Math.ceil(
      (Date.now() - new Date(sprint.startDate).getTime()) / 86_400_000
    ))
    const snapshot: BurndownSnapshot = {
      date: today,
      completed: sprint.completedPoints,
      expected: Math.round((sprint.committedPoints / sprintLength) * Math.min(daysElapsed, sprintLength)),
    }
    set(s => {
      const without = s.burndownSnapshots.filter(b => b.date !== today)
      return { burndownSnapshots: [...without, snapshot].slice(-sprintLength) }
    })
  },

  createEscalation: (taskId, reason, recommendation, urgency, category) => {
    const alreadyOpen = get().escalations.some((e) => e.taskId === taskId && !e.resolved)
    if (alreadyOpen) return

    const task = get().tasks.find((t) => t.id === taskId)
    const esc: EscalationItem = {
      id: `esc-auto-${taskId}-${Date.now()}`,
      taskId,
      taskTitle: task?.title ?? taskId,
      reason,
      recommendation,
      urgency,
      category,
      createdAt: now(),
      resolved: false,
    }

    set((s) => ({
      escalations: [esc, ...s.escalations],
      tasks: s.tasks.map((t) =>
        t.id === taskId ? { ...t, decision: 'ESCALATE' as const, isAITriaged: false } : t,
      ),
    }))

    get().addFeedEvent({ type: 'escalate', message: reason, taskId, decision: 'ESCALATE' })

    const { slackWebhookUrl } = get()
    if (slackWebhookUrl) {
      import('../logic/slack').then(({ postSlackEscalation }) => {
        postSlackEscalation({ webhookUrl: slackWebhookUrl, taskTitle: esc.taskTitle, reason, recommendation, urgency, appUrl: window.location.href })
      })
    }
    refreshSprintHealth(get, s => set(s as Partial<SprintStore>))
  },

  resolveEscalation: (escalationId) => {
    const esc = get().escalations.find((e) => e.id === escalationId)
    if (!esc) return

    set((s) => ({
      escalations: s.escalations.map((e) =>
        e.id === escalationId ? { ...e, resolved: true } : e,
      ),
      tasks: s.tasks.map((t) =>
        t.id === esc.taskId ? { ...t, decision: 'ACT' as const, isAITriaged: false } : t,
      ),
    }))

    get().addFeedEvent({
      type: 'resolve',
      message: `Escalation resolved: "${esc.taskTitle}". Human judgment applied, agent can proceed.`,
      taskId: esc.taskId,
      decision: 'ACT',
    })
    refreshSprintHealth(get, s => set(s as Partial<SprintStore>))
  },

  triggerScenario: (scenarioId) => {
    const { addAdHocTask, triageTaskById, updateTaskStatus, addFeedEvent } = get()

    switch (scenarioId) {
      case 'urgent-bug': {
        addAdHocTask(
          'CRITICAL: Checkout broken — 500 errors on payment submit',
          'Production alert: 23% of checkout attempts returning 500. Started 8 minutes ago. Affects all payment methods. Sentry: PROD-9981.',
          'critical',
        )
        break
      }

      case 'blocked-design': {
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === 'task-3'
              ? { ...t, status: 'blocked', decisionReason: 'Design sign-off from Priya pending since yesterday. Cannot ship without final approval.' }
              : t,
          ),
        }))
        addFeedEvent({
          type: 'escalate',
          message: 'Blocked: "Checkout order summary" waiting on Priya\'s design sign-off. Sprint goal risk increasing. Recommending PM to unblock by 3 PM.',
          taskId: 'task-3',
          decision: 'ESCALATE',
        })
        break
      }

      case 'overloaded': {
        const mostLoaded = get().team.reduce((a, b) => a.currentLoad >= b.currentLoad ? a : b)
        set((s) => ({
          team: s.team.map((m) =>
            m.id === mostLoaded.id
              ? { ...m, currentLoad: LOAD_MAX, capacity: 1 }
              : m,
          ),
        }))
        addFeedEvent({
          type: 'risk',
          message: `ALERT: ${mostLoaded.name} at ${LOAD_MAX}% load. Cannot accept new assignments. Tasks in backlog need reassignment. Sprint goal at risk.`,
          memberId: mostLoaded.id,
          decision: 'ESCALATE',
        })
        break
      }

      case 'vague-request': {
        addAdHocTask(
          'Stakeholder request: "Make checkout feel more premium"',
          'VP Marketing via Slack: "Our checkout looks dated compared to competitors. Can we make it feel more premium before end of month?" No spec, no designs, no acceptance criteria.',
          'high',
        )
        break
      }

      case 'scope-creep': {
        addAdHocTask(
          '"Quick change": Add loyalty points redemption to checkout',
          'PM forwarded from CEO: "Small ask — can we add loyalty points in checkout this sprint? Should be quick." Touches payment flow, user accounts, rewards API. Estimated: 8+ days.',
          'high',
        )
        break
      }

      default:
        break
    }
  },
}),
    {
      name: 'sprint-agent-v17',
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.team = computeLoadsFromTasks(state.tasks, state.team)
          state.sprint = {
            ...state.sprint,
            daysRemaining: Math.max(0, Math.ceil((new Date(state.sprint.endDate).getTime() - Date.now()) / 86_400_000)),
          }
        }
      },
      partialize: (state) => ({
        tasks: state.tasks,
        team: state.team,
        sprint: state.sprint,
        feed: state.feed,
        escalations: state.escalations,
        activeView: state.activeView,
        slackWebhookUrl: state.slackWebhookUrl,
        outboundWebhookUrl: state.outboundWebhookUrl,
        autonomyConfig: state.autonomyConfig,
        sprintHistory: state.sprintHistory,
        burndownSnapshots: state.burndownSnapshots,
        calibration: state.calibration,
        sprintNarrative: state.sprintNarrative,
      }),
    }
  )
)
