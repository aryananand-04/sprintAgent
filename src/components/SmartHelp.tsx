import { motion } from 'framer-motion'
import { X, Zap, AlertTriangle, Users, Shield, Flag, FileText, BarChart2, Monitor, BookOpen, Sparkles, ArrowRight } from 'lucide-react'
import { useSprintStore } from '../store/useSprintStore'
import { useTour } from '../hooks/useTour'
import { useCategoryTour, type CategoryStep } from '../hooks/useCategoryTour'

interface Category {
  id: string
  icon: React.ElementType
  color: string
  label: string
  steps: CategoryStep[]
}

const CATEGORIES: Category[] = [
  {
    id: 'core', icon: Zap, color: 'var(--act)', label: 'Core Agent Loop',
    steps: [
      { title: 'Intake',          liveIn: 'Intake page',   view: 'intake',  tourStep: 4,                    side: 'bottom', desc: 'Submit tasks via text form, GitHub import, or ad-hoc requests. No urgency picker, no assignee dropdown — just describe it. The agent handles the rest.' },
      { title: 'AI Triage',       liveIn: 'Triage Queue',  view: 'triage',  tourStep: 5,                    side: 'bottom', desc: 'Groq LLM scores every task and returns ACT / ASK / ESCALATE with a first-person reason. Configurable thresholds affect what the AI decides.' },
      { title: 'Auto-assignment', liveIn: 'Triage Queue',  view: 'triage',  tourStep: 5,                    side: 'bottom', desc: 'After ACT, the agent picks the best engineer by skill match + current load. Assignment confidence is shown as a percentage gauge on every card.' },
      { title: 'Bulk assign',     liveIn: 'Triage Queue',  view: 'triage',  featureId: 'bulk-assign-btn',   side: 'left',   desc: 'One click assigns every unassigned ACT task in a single pass — lowest load first, best skill match. Works across all 15 engineers simultaneously.' },
      { title: 'Status updates',  liveIn: 'Sprint Board',  view: 'sprint',  tourStep: 2,                    side: 'bottom', desc: 'Drag tasks across columns: backlog → triaged → assigned → in-progress → blocked → done. Loads, health, burndown, and feed all update on every move.' },
    ],
  },
  {
    id: 'autonomy', icon: Shield, color: '#d97706', label: 'Agent Autonomy',
    steps: [
      { title: 'Continuous agent loop',   liveIn: 'Agent Feed Island',  tourStep: 3,                              side: 'top',    desc: 'Runs every 60s: rebalances capacity, resolves blockers, monitors velocity, nudges stale escalations. Visible in the live feed at the bottom.' },
      { title: 'Self-tuning',             liveIn: 'Team Report',        view: 'utilization', featureId: 'calibration-section', side: 'top',    desc: 'Agent tracks ACT accuracy. Below 60% over 5 decisions it raises its clarity floor. Above 90% over 10 decisions it lowers it — and posts why to the feed.' },
      { title: 'Configurable thresholds', liveIn: 'Autonomy page',      view: 'autonomy',    featureId: 'autonomy-header',     side: 'right',  desc: 'PM tunes: ACT clarity, ASK clarity, escalation timer, capacity breach %, blocked hours, nudge hours, velocity deficit. All wired into the AI prompt.' },
      { title: 'Never auto-assign types', liveIn: 'Autonomy page',      view: 'autonomy',    featureId: 'autonomy-header',     side: 'right',  desc: 'Block specific task types (spike, design, urgent) from autonomous assignment. Agent always asks first, even if clarity is high.' },
      { title: 'Manual rebalance',        liveIn: 'Agent Settings',     view: 'autonomy',    featureId: 'autonomy-header',     side: 'right',  desc: 'Force-trigger capacity rebalancing on demand. Engineers above the load threshold have their lowest-priority task moved to a teammate with headroom.' },
    ],
  },
  {
    id: 'escalation', icon: AlertTriangle, color: 'var(--crit)', label: 'Escalation System',
    steps: [
      { title: 'Escalation cards',       liveIn: 'Escalations page',  view: 'escalations', tourStep: 6, side: 'bottom', desc: 'Every ESCALATE decision creates a real card with reason + agent recommendation. Not just a feed event — it\'s a structured decision queue for the PM.' },
      { title: 'Mark resolved',          liveIn: 'Escalations page',  view: 'escalations', tourStep: 6, side: 'bottom', desc: 'Resolving moves the task out of the ESCALATE bucket in triage queue and flips decision to ACT. Agent can then assign it autonomously.' },
      { title: 'Escalation aging nudge', liveIn: 'Escalations page',  view: 'escalations', tourStep: 6, side: 'bottom', desc: 'Agent reminds PM of unresolved escalations after a configurable number of hours. Fires to the feed and to Slack if configured.' },
      { title: 'Slack webhook',          liveIn: 'Escalations page',  view: 'escalations', tourStep: 6, side: 'bottom', desc: 'Escalations fire to a Slack channel in real time. Configure the webhook URL in Agent Settings. Includes task title, reason, and recommendation.' },
    ],
  },
  {
    id: 'sprint', icon: Flag, color: 'var(--t2)', label: 'Sprint Management',
    steps: [
      { title: 'Sprint board',            liveIn: 'Sprint Board',   view: 'sprint',  tourStep: 1,                    side: 'bottom', desc: 'Full kanban with drag-and-drop, inline task creation, and assignee picker with live load gauges on every team member chip.' },
      { title: 'Sprint health',           liveIn: 'Sprint Board',   view: 'sprint',  featureId: 'sprint-health',     side: 'left',   desc: 'Live green / yellow / red badge computed from completion %, blocked task count, and open escalation count. Updates on every action.' },
      { title: 'Burndown chart',          liveIn: 'Sprint Review',  view: 'review',  featureId: 'burndown-section',  side: 'right',  desc: 'Real data from actual task completions — not static. Updates every time a task is marked done, regardless of which view is active.' },
      { title: 'Velocity chart',          liveIn: 'Sprint Review',  view: 'review',  featureId: 'velocity-section',  side: 'right',  desc: 'Rolling 3-sprint average, recomputed when a sprint is archived. Pre-seeded with Sprint 20–22 history so it\'s meaningful from the first session.' },
      { title: 'Archive sprint',          liveIn: 'Sprint Review',  view: 'review',  featureId: 'archive-btn',       side: 'top',    desc: 'Saves a full snapshot: all tasks, escalations, burndown data, and sprint metadata. Fully restorable at any point — nothing is lost.' },
      { title: 'New sprint modal',        liveIn: 'Sprint Review',  view: 'review',  featureId: 'archive-btn',       side: 'top',    desc: 'Start fresh with name, goal, dates, and committed points. Unfinished tasks carry to backlog. Agent re-bootstraps and triages automatically.' },
      { title: 'Restore archived sprint', liveIn: 'Sprint Review',  view: 'review',  featureId: 'sprint-history',    side: 'top',    desc: 'Open any previously archived sprint with full task list, escalations, and burndown intact — not just a summary. Works from Sprint 22 onwards.' },
      { title: 'Sprint history',          liveIn: 'Sprint Review',  view: 'review',  featureId: 'sprint-history',    side: 'top',    desc: 'All past sprints with delivery %, velocity, task counts, and escalations. Expandable cards — click to see full stats and restore if snapshot exists.' },
    ],
  },
  {
    id: 'task', icon: FileText, color: 'var(--act)', label: 'Task Detail',
    steps: [
      { title: 'Triage panel',                  liveIn: 'Triage Queue (click any task)', view: 'triage',  tourStep: 5, side: 'bottom', desc: 'Full scoring breakdown — urgency, impact, effort, risk, clarity — plus AI reasoning, best assignee with confidence %, and dependency risks.' },
      { title: 'Acceptance criteria generator', liveIn: 'Triage Panel (ASK tasks)',      view: 'triage',  tourStep: 5, side: 'bottom', desc: 'AI proposes 3–4 testable criteria for ASK tasks. PM approves and agent re-triages immediately with updated clarity.' },
      { title: 'Goal alignment score',          liveIn: 'Triage Queue',                  view: 'triage',  tourStep: 5, side: 'bottom', desc: 'AI rates 1–10 how well each task serves the sprint goal. Low scores (≤ 4) get flagged with an orange badge in the triage queue.' },
      { title: 'Assignment confidence gauge',   liveIn: 'Task cards + Triage Queue',     view: 'triage',  tourStep: 5, side: 'bottom', desc: 'Shows best-fit engineer with % confidence based on skill match, current load, and dependency ownership.' },
      { title: 'Comments',                      liveIn: 'Sprint Board (task cards)',      view: 'sprint',  tourStep: 1, side: 'bottom', desc: 'Add comments to any task directly from the sprint board card. Comments toggle in-card so context stays close to the work.' },
      { title: 'Undo last agent action',        liveIn: 'Agent Feed Island (header)',     tourStep: 3,     side: 'top',  desc: 'Revert any agent assignment or decision from the ↩ button in the feed island header. Restores previous task and team state instantly.' },
    ],
  },
  {
    id: 'team', icon: Users, color: 'var(--ok)', label: 'Team & Load',
    steps: [
      { title: '15 engineers',            liveIn: 'Sidebar + Team Report', view: 'utilization', featureId: 'team-report-header', side: 'bottom', desc: 'Each engineer has skills, capacity, and live load. The agent uses skill tags and load % for every single assignment decision.' },
      { title: 'Live load gauge',         liveIn: 'Sidebar, Board, Triage', view: 'utilization', featureId: 'team-report-header', side: 'bottom', desc: 'Consistent circular gauge across sidebar, kanban cards, triage queue, and assignee picker. Same data, same formula, everywhere.' },
      { title: 'Load color thresholds',   liveIn: 'Every load gauge',       view: 'utilization', featureId: 'team-report-header', side: 'bottom', desc: 'Single shared green / yellow / red thresholds across every panel in the app. One constant — no inconsistency.' },
      { title: 'Team utilization report', liveIn: 'Team Report page',       view: 'utilization', featureId: 'calibration-section', side: 'top',   desc: 'Per-engineer breakdown: tasks done, active, blocked, pts shipped, avg assignment confidence, and agent calibration accuracy.' },
    ],
  },
  {
    id: 'briefings', icon: BarChart2, color: 'var(--act)', label: 'Briefings & Reporting',
    steps: [
      { title: 'Three briefings',      liveIn: 'Briefings page',      view: 'briefings', featureId: 'briefings-header',  side: 'bottom', desc: 'Team / PM / Manager — each AI-generated from live sprint data, framed differently for each audience. Click Generate to refresh.' },
      { title: 'Sprint narrative',     liveIn: 'Sprint Board header', view: 'sprint',    tourStep: 1,                    side: 'bottom', desc: 'One-sentence health summary below the sprint goal, generated by Groq on every load. Updates whenever you open the board.' },
      { title: 'Sprint retrospective', liveIn: 'Sprint Review',       view: 'review',    featureId: 'velocity-section',  side: 'right',  desc: 'Auto-generated what went well / didn\'t / try next — derived from real sprint data, not templates. Appears in Sprint Review.' },
      { title: 'Export to CSV',        liveIn: 'Sprint Review',       view: 'review',    featureId: 'archive-btn',       side: 'top',    desc: 'Download all sprint task data — every field, every status. From the Sprint Review page, bottom action bar.' },
    ],
  },
  {
    id: 'ux', icon: Monitor, color: 'var(--t2)', label: 'UX / Interface',
    steps: [
      { title: 'Agent Feed Island',      liveIn: 'Bottom of every page',   tourStep: 3, side: 'top',    desc: 'Live event stream — every autonomous decision logged in real time with first-person reasoning. Filterable by ACT / ASK / ESCALATE.' },
      { title: 'Triage queue',           liveIn: 'Triage Queue page',     view: 'triage',  tourStep: 5, side: 'bottom', desc: 'All tasks grouped by decision with mini load gauges and best-assignee suggestions. Bulk assign button for all unassigned ACT tasks.' },
      { title: 'Kanban assignee picker', liveIn: 'Sprint Board (+ button)',view: 'sprint',  tourStep: 1, side: 'bottom', desc: 'Click + in any kanban column. Team member chips show live load gauges and %, sorted by load ascending — lowest first as natural suggestion.' },
      { title: 'Dark / light mode',      liveIn: 'Header (right side)',   view: 'sprint',  tourStep: 1, side: 'bottom', desc: 'Full theme toggle. Persists across sessions via localStorage.' },
      { title: 'Demo scenarios',         liveIn: 'Sprint Board',          view: 'sprint',  tourStep: 2, side: 'bottom', desc: 'Trigger real agent behaviors: urgent bug, team overload, vague request, slow sprint. All produce real state changes and feed events.' },
      { title: 'Command palette',        liveIn: 'Header (⌘K)',           view: 'sprint',  tourStep: 1, side: 'bottom', desc: '⌘K search across views, tasks, and actions. Keyboard-first navigation for power users.' },
      { title: 'GitHub import',          liveIn: 'Intake page',           view: 'intake',  tourStep: 4, side: 'bottom', desc: 'Pull issues directly into backlog from any repo. Auto-triaged on import — agent scores and assigns without any extra steps.' },
    ],
  },
]

export function SmartHelp({ onClose }: { onClose: () => void }) {
  const { tasks, escalations, sprint } = useSprintStore()
  const setView = useSprintStore(s => s.setView)
  const { start: startTour } = useTour()
  const { start: startCategoryTour } = useCategoryTour()

  const nav = (v: string) => setView(v as any)

  function launchCategory(cat: Category) {
    onClose()
    setTimeout(() => startCategoryTour(cat.label, cat.color, cat.steps, nav), 80)
  }

  // Context-aware suggestions
  const openEsc = escalations.filter(e => !e.resolved).length
  const unassignedACT = tasks.filter(t => t.decision === 'ACT' && !t.assigneeId && t.status !== 'done').length
  const unprocessed = tasks.filter(t => !t.isAITriaged && (t.status === 'backlog' || t.status === 'triaged')).length

  const suggestions: { label: string; desc: string; cat: Category }[] = []
  if (openEsc > 0)       suggestions.push({ label: 'Escalation System', desc: `${openEsc} open escalation${openEsc > 1 ? 's' : ''} need your attention`, cat: CATEGORIES[2] })
  if (unassignedACT > 0) suggestions.push({ label: 'Core Agent Loop',   desc: `${unassignedACT} unassigned ACT task${unassignedACT > 1 ? 's' : ''} ready to assign`, cat: CATEGORIES[0] })
  if (unprocessed > 0)   suggestions.push({ label: 'Core Agent Loop',   desc: `${unprocessed} task${unprocessed > 1 ? 's' : ''} haven't been triaged yet`, cat: CATEGORIES[0] })
  if (sprint.health !== 'green') suggestions.push({ label: 'Agent Autonomy', desc: 'Sprint health is not green — tune agent thresholds', cat: CATEGORIES[1] })
  if (suggestions.length === 0)  suggestions.push({ label: 'Core Agent Loop', desc: 'Start with the full agent loop walkthrough', cat: CATEGORIES[0] })
  const topSuggestions = suggestions.slice(0, 2)

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 9997 }}
      />
      <motion.div
        initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 16 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        style={{
          position: 'fixed', top: 52, right: 12, zIndex: 9998,
          width: Math.min(300, window.innerWidth - 16), maxHeight: 'calc(100vh - 72px)',
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 10, boxShadow: '0 8px 28px rgba(9,9,11,0.16)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <BookOpen size={13} style={{ color: 'var(--act)' }} strokeWidth={1.5} />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', letterSpacing: '-0.015em' }}>Help & Features</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', display: 'flex', padding: 3, borderRadius: 4 }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--foreground)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted-foreground)')}>
            <X size={13} strokeWidth={1.5} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 10px 14px' }}>

          {/* Suggested */}
          <div style={{ marginBottom: 10 }}>
            <div className="label" style={{ marginBottom: 5, paddingLeft: 2 }}>Suggested for you</div>
            {topSuggestions.map((s, i) => (
              <button key={i} onClick={() => launchCategory(s.cat)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 10px', borderRadius: 6, cursor: 'pointer', textAlign: 'left',
                  background: 'var(--act-bg)', border: '1px solid var(--act-bd)',
                  marginBottom: 3, transition: 'filter 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.04)')}
                onMouseLeave={e => (e.currentTarget.style.filter = 'none')}
              >
                <Sparkles size={11} style={{ color: 'var(--act)', flexShrink: 0 }} strokeWidth={1.5} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--act-t)' }}>{s.label}</div>
                  <div style={{ fontSize: 10, color: 'var(--muted-foreground)', marginTop: 1 }}>{s.desc}</div>
                </div>
                <ArrowRight size={10} style={{ color: 'var(--act)', flexShrink: 0 }} />
              </button>
            ))}
          </div>

          {/* Full guided tour */}
          <button
            onClick={() => { onClose(); setTimeout(() => startTour(nav), 80) }}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 10px', borderRadius: 6, cursor: 'pointer', textAlign: 'left',
              background: 'transparent', border: '1px solid transparent',
              marginBottom: 8, transition: 'background 0.1s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--muted)'; e.currentTarget.style.borderColor = 'var(--border)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent' }}
          >
            <Zap size={11} style={{ color: 'var(--act)', flexShrink: 0 }} strokeWidth={1.5} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--t1)' }}>Full guided tour</div>
              <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 1 }}>6-step end-to-end walkthrough of the agent loop</div>
            </div>
            <ArrowRight size={10} style={{ color: 'var(--t3)', flexShrink: 0 }} />
          </button>

          <div style={{ height: 1, background: 'var(--border)', margin: '2px 0 8px' }} />

          {/* All categories */}
          <div className="label" style={{ marginBottom: 6, paddingLeft: 2 }}>Browse by feature area</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {CATEGORIES.map(cat => {
              const Icon = cat.icon
              return (
                <button key={cat.id} onClick={() => launchCategory(cat)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 9,
                    padding: '8px 10px', borderRadius: 6, cursor: 'pointer', textAlign: 'left',
                    background: 'transparent', border: '1px solid transparent',
                    transition: 'background 0.1s, border-color 0.1s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--muted)'; e.currentTarget.style.borderColor = 'var(--border)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent' }}
                >
                  <Icon size={12} style={{ color: cat.color, flexShrink: 0 }} strokeWidth={1.5} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--t1)' }}>{cat.label}</div>
                  </div>
                  <span style={{ fontSize: 9, color: 'var(--t3)', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>
                    {cat.steps.length}
                  </span>
                  <ArrowRight size={9} style={{ color: 'var(--t3)', flexShrink: 0 }} />
                </button>
              )
            })}
          </div>
        </div>
      </motion.div>
    </>
  )
}
