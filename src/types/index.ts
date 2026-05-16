export type TaskStatus =
  | 'backlog'
  | 'triaged'
  | 'assigned'
  | 'in-progress'
  | 'blocked'
  | 'done'

export type AgentDecision = 'ACT' | 'ASK' | 'ESCALATE'

export type TaskType =
  | 'bug'
  | 'feature'
  | 'spike'
  | 'design'
  | 'urgent'
  | 'ad-hoc'
  | 'chore'

export type UrgencyLevel = 'critical' | 'high' | 'medium' | 'low'

export type AdHocResolution = 'absorb' | 'swap' | 'escalate'

export interface Task {
  id: string
  title: string
  description: string
  type: TaskType
  status: TaskStatus
  urgency: UrgencyLevel
  impact: number // 1–5
  effort: number // 1–5
  risk: number // 1–5
  clarity: number // 1–5
  assigneeId?: string
  dependencies: string[]
  source: string // "Slack", "PM", "Stakeholder", "GitHub", "Ad-hoc"
  confidence?: number // 0–100
  decision?: AgentDecision
  decisionReason?: string
  triageScore?: number
  storyPoints?: number
  tags?: string[]
  isAdHoc?: boolean
  isNew?: boolean
  isAITriaged?: boolean
  createdAt: string
  adHocResolution?: AdHocResolution
  adHocSwappedTaskId?: string
  comments?: TaskComment[]
  goalAlignment?: number        // 1-10: how much this task serves the sprint goal
  acceptanceCriteria?: string[] // AI-proposed, PM-approved criteria for ASK tasks
}

export interface TaskComment {
  id: string
  text: string
  author: string
  timestamp: string
}

export interface AutonomyConfig {
  actMinClarity:   number    // default 3 — task must meet this clarity to ACT
  askMaxClarity:   number    // default 2 — task at or below this gets ASK
  escalateIfCriticalUnassignedHours: number   // default 1
  neverAutoAssignTypes: TaskType[]
  capacityBreachThreshold: number   // default 90 — % load above which agent rebalances
  blockedHoursThreshold: number     // default 2  — hours blocked before agent acts
  escNudgeHours: number             // default 4  — hours before escalation nudge fires
  velocityDeficitPts: number        // default 6  — pts behind pace to trigger alert
}

export interface SprintArchive {
  id: string
  name: string
  goal: string
  startDate?: string
  completedPoints: number
  committedPoints: number
  velocity: number
  health: 'green' | 'yellow' | 'red'
  endDate: string
  taskCount: number
  doneCount: number
  escalationCount: number
  // Full state snapshot — present when archived via the app, absent for seed history
  snapshot?: {
    tasks: Task[]
    escalations: EscalationItem[]
    burndownSnapshots: Array<{ date: string; completed: number; expected: number }>
    sprint: Sprint
  }
}

export interface BurndownSnapshot {
  date: string
  completed: number
  expected: number
}

export interface CalibrationData {
  act:      { correct: number; total: number }
  ask:      { correct: number; total: number }
  escalate: { correct: number; total: number }
}

export interface AgentActionSnapshot {
  id: string
  type: 'assign' | 'triage' | 'rebalance'
  taskId: string
  taskTitle: string
  previousTaskState: Partial<Task>
  previousTeamLoads: Record<string, number>
  timestamp: string
  description: string
}

export interface TeamMember {
  id: string
  name: string
  initials: string
  role: string
  skills: string[]
  currentLoad: number // 0–100 percent
  capacity: number // available story points
  color: string // tailwind bg class for avatar
}

export interface Sprint {
  id: string
  name: string
  goal: string
  startDate: string
  endDate: string
  totalPoints: number
  completedPoints: number
  committedPoints: number
  health: 'green' | 'yellow' | 'red'
  daysRemaining: number
  velocity: number
}

export interface FeedEvent {
  id: string
  timestamp: string
  type: 'assign' | 'escalate' | 'triage' | 'status' | 'risk' | 'adHoc' | 'resolve' | 'intake'
  message: string
  taskId?: string
  memberId?: string
  decision?: AgentDecision
}

export interface EscalationItem {
  id: string
  taskId: string
  taskTitle: string
  reason: string
  recommendation: string
  urgency: UrgencyLevel
  category: 'missing-criteria' | 'scope-conflict' | 'blocker' | 'capacity' | 'ambiguous' | 'stakeholder'
  createdAt: string
  resolved: boolean
}

export interface BriefingView {
  type: 'team' | 'pm' | 'manager'
  label: string
  summary: string
  items: BriefingItem[]
}

export interface BriefingItem {
  icon: string
  label: string
  value: string
  severity?: 'ok' | 'warn' | 'critical'
}

export interface ScenarioTrigger {
  id: string
  label: string
  description: string
  icon: string
  color: string
}

export interface AutonomyRule {
  id: string
  category: 'ACT' | 'ASK' | 'ESCALATE'
  condition: string
  rationale: string
  examples: string[]
}

export interface TriageResult {
  decision: AgentDecision
  score: number
  reason: string
  dimensions: {
    urgency: number
    impact: number
    effort: number
    risk: number
    clarity: number
  }
}
