import { AnimatePresence, motion } from 'framer-motion'
import { useSprintStore } from '../store/useSprintStore'
import { SprintBoard }    from '../components/SprintBoard'
import { IntakeInbox }    from '../components/IntakeInbox'
import { TriageQueue }    from '../components/TriageQueue'
import { EscalationPanel } from '../components/EscalationDrawer'
import { BriefingPanel }  from '../components/BriefingPanel'
import { PolicyPanel }    from '../components/PolicyPanel'
import { AgentTimeline }  from '../components/AgentTimeline'
import { SprintReview }   from '../components/SprintReview'
import { RationalePanel } from '../components/RationalePanel'
import { SprintPlanner }    from '../components/SprintPlanner'
import { TeamUtilization }  from '../components/TeamUtilization'

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
