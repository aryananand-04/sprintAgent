// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { AnimatePresence, motion } from 'framer-motion'
import { useSprintStore } from '../store/useSprintStore'
import dynamic from 'next/dynamic'
import { SprintBoard }    from '../components/SprintBoard'

// The board is the landing view; everything else loads when first opened.
function ViewLoading() {
  return <p role="status" className="p-6 text-sm text-mute">Fetching that view.</p>
}
const IntakeInbox = dynamic(() => import('../components/IntakeInbox').then((m) => m.IntakeInbox), { loading: ViewLoading })
const TriageQueue = dynamic(() => import('../components/TriageQueue').then((m) => m.TriageQueue), { loading: ViewLoading })
const EscalationPanel = dynamic(() => import('../components/EscalationDrawer').then((m) => m.EscalationPanel), { loading: ViewLoading })
const BriefingPanel = dynamic(() => import('../components/BriefingPanel').then((m) => m.BriefingPanel), { loading: ViewLoading })
const PolicyPanel = dynamic(() => import('../components/PolicyPanel').then((m) => m.PolicyPanel), { loading: ViewLoading })
const AgentTimeline = dynamic(() => import('../components/AgentTimeline').then((m) => m.AgentTimeline), { loading: ViewLoading })
const SprintReview = dynamic(() => import('../components/SprintReview').then((m) => m.SprintReview), { loading: ViewLoading })
const RationalePanel = dynamic(() => import('../components/RationalePanel').then((m) => m.RationalePanel), { loading: ViewLoading })
const SprintPlanner = dynamic(() => import('../components/SprintPlanner').then((m) => m.SprintPlanner), { loading: ViewLoading })
const TeamUtilization = dynamic(() => import('../components/TeamUtilization').then((m) => m.TeamUtilization), { loading: ViewLoading })

const VIEW_COMPONENTS: Record<string, React.ComponentType> = {
  sprint:      SprintBoard,
  intake:      IntakeInbox,
  triage:      TriageQueue,
  escalations: EscalationPanel,
  briefings:   BriefingPanel,
  autonomy:    PolicyPanel,
  timeline:    AgentTimeline,
  review:      SprintReview,
  rationale:   RationalePanel,
  planner:     SprintPlanner,
  utilization: TeamUtilization,
}

export function Dashboard() {
  const { activeView } = useSprintStore()
  const ViewComponent = VIEW_COMPONENTS[activeView] ?? SprintBoard

  return (
    <div className="flex-1 h-full overflow-hidden relative">
      <AnimatePresence mode="sync">
        <motion.div
          key={activeView}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          className="h-full overflow-hidden"
        >
          <ViewComponent />
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
