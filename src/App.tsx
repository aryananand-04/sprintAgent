import { Sidebar } from './components/Sidebar'
import { GuidedOverlay } from './components/GuidedOverlay'
import { TourGuide } from './components/TourGuide'
import { CategoryTour } from './components/CategoryTour'
import { AgentFeedIsland } from './components/AgentFeedIsland'
import { TriagePanel } from './components/TriagePanel'
import { DemoScenarios } from './components/DemoScenarios'
import { CommandPalette } from './components/CommandPalette'
import { Dashboard } from './pages/Dashboard'
import { useSprintStore } from './store/useSprintStore'
import { useCommandPaletteStore } from './store/commandPaletteStore'
import { Search, AlertTriangle, Zap, Settings2, HelpCircle, Menu } from 'lucide-react'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ThemeToggle } from './components/ui/theme-toggle'
import { AgentSettings } from './components/AgentSettings'
import { SmartHelp } from './components/SmartHelp'
import { useAgentBootstrap } from './hooks/useAgentBootstrap'
import { useAgentLoop } from './hooks/useAgentLoop'
import { useScheduledStandup } from './hooks/useScheduledStandup'

const VIEW_LABELS: Record<string, string> = {
  sprint:      'Sprint Board',
  intake:      'Intake',
  triage:      'Triage Queue',
  escalations: 'Escalations',
  briefings:   'Briefings',
  review:      'Sprint Review',
  autonomy:    'Autonomy Framework',
  timeline:    'Agent Timeline',
  rationale:   'Product Rationale',
}

function Header({ settingsOpen, setSettingsOpen, onSidebarToggle }: { settingsOpen: boolean; setSettingsOpen: (v: boolean) => void; onSidebarToggle: () => void }) {
  const { sprint, escalations, activeView } = useSprintStore()
  const { setIsOpen } = useCommandPaletteStore()
  const [helpOpen, setHelpOpen] = useState(false)
  const openEsc = escalations.filter(e => !e.resolved).length
  const pct = Math.round((sprint.completedPoints / sprint.committedPoints) * 100)

  const isGreen  = sprint.health === 'green'
  const isYellow = sprint.health === 'yellow'
  const hc = isGreen
    ? { color: 'var(--ok)',   bg: 'rgba(33,110,78,0.08)',  bd: 'rgba(33,110,78,0.22)',  label: 'On Track' }
    : isYellow
    ? { color: 'var(--warn)', bg: 'rgba(151,68,0,0.09)',   bd: 'rgba(151,68,0,0.24)',   label: 'At Risk' }
    : { color: 'var(--crit)', bg: 'rgba(174,42,25,0.09)',  bd: 'rgba(174,42,25,0.24)',  label: 'In Jeopardy' }

  return (
    <header style={{
      height: 40, display: 'flex', alignItems: 'center',
      padding: '0 14px', gap: 12, flexShrink: 0,
      background: 'var(--card)',
      borderBottom: '1px solid var(--b1)',
      boxShadow: '0 1px 3px rgba(9,9,11,0.07)',
      /* Align with dark sidebar: extra separation at the layout boundary */
    }}>
      {/* Hamburger — visible on compact only */}
      <button
        className="sidebar-toggle-btn"
        onClick={onSidebarToggle}
        style={{
          width: 28, height: 28, borderRadius: 6, flexShrink: 0,
          background: 'transparent', border: '1px solid var(--b2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: 'var(--t2)', transition: 'background 0.1s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--muted)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <Menu size={14} strokeWidth={1.5} />
      </button>

      {/* Left — breadcrumb */}
      <div className="header-view-label" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, flexShrink: 0 }}>
        <span style={{ color: 'var(--t3)', fontWeight: 500 }}>Sprint Agent</span>
        <span style={{ color: 'var(--b3)', fontSize: 11 }}>›</span>
        <span style={{ color: 'var(--t1)', fontWeight: 700, fontSize: 13, letterSpacing: '-0.01em' }}>
          {VIEW_LABELS[activeView]}
        </span>
      </div>

      {/* Center — hidden on mobile */}
      <div className="header-stats" style={{
        position: 'absolute', left: '50%', transform: 'translateX(-50%)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        {/* #1 — sprint name larger */}
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)', letterSpacing: '-0.018em', whiteSpace: 'nowrap' }}>
          {sprint.name}
        </span>

        <div className="section-rule" style={{ height: 14 }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 80, height: 2, background: 'var(--s4)', borderRadius: 2, overflow: 'hidden' }}>
            <motion.div
              style={{ height: '100%', borderRadius: 2, background: hc.color }}
              initial={{ width: 0 }} animate={{ width: `${pct}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
          <span style={{
            fontSize: 11, color: 'var(--t2)', fontWeight: 600,
            fontFamily: 'JetBrains Mono, monospace', fontVariantNumeric: 'tabular-nums',
          }}>{pct}%</span>
        </div>

        <div className="section-rule" style={{ height: 14 }} />

        {/* #8 — health: pill shape for non-green states */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5,
          fontSize: 11, fontWeight: 700, color: hc.color,
          padding: isGreen ? undefined : '3px 8px',
          borderRadius: isGreen ? undefined : 'var(--r-ui)',
          background: isGreen ? 'transparent' : hc.bg,
          border: isGreen ? 'none' : `1px solid ${hc.bd}`,
          transition: 'all 0.2s',
        }}>
          <div style={{
            width: 5, height: 5, borderRadius: '50%', background: 'currentColor', flexShrink: 0,
            animation: !isGreen ? 'pulseDot 1.8s ease-in-out infinite' : 'none',
          }} />
          {hc.label}
        </div>

        <div className="section-rule" style={{ height: 14 }} />

        <span style={{ fontSize: 11, color: 'var(--t3)', fontFamily: 'JetBrains Mono, monospace' }}>
          {sprint.daysRemaining}d left
        </span>
      </div>

      {/* Right */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
        <AnimatePresence>
          {openEsc > 0 && (
            <motion.div
              initial={{ opacity: 0, x: 8, scale: 0.92 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 8, scale: 0.92 }}
              transition={{ type: 'spring', stiffness: 300, damping: 24 }}
              style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px',
                borderRadius: 'var(--r-ui)',
                background: 'rgba(174,42,25,0.09)', border: '1px solid rgba(174,42,25,0.26)',
                fontSize: 11, color: 'var(--esc-t)', fontWeight: 700, cursor: 'default',
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              {/* #11 — strokeWidth 1.5 */}
              <AlertTriangle size={10} strokeWidth={1.5} />
              <span>{openEsc}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--t3)' }}>
          <div className="live-dot" />
          <Zap size={9} style={{ color: 'var(--act)' }} strokeWidth={2} />
          <span style={{ fontWeight: 500 }}>Agent active</span>
        </div>

        {/* Help */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setHelpOpen(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 28, height: 28, borderRadius: '50%',
              background: helpOpen ? 'var(--act-bg)' : 'var(--muted)',
              border: `1px solid ${helpOpen ? 'var(--act-bd)' : 'var(--border)'}`,
              color: helpOpen ? 'var(--act)' : 'var(--muted-foreground)', cursor: 'pointer',
              transition: 'all 0.1s',
            }}
            onMouseEnter={e => { if (!helpOpen) { e.currentTarget.style.color = 'var(--foreground)'; e.currentTarget.style.background = 'var(--s3)' } }}
            onMouseLeave={e => { if (!helpOpen) { e.currentTarget.style.color = 'var(--muted-foreground)'; e.currentTarget.style.background = 'var(--muted)' } }}
            title="Help & Tutorials"
          >
            <HelpCircle size={13} strokeWidth={1.5} />
          </button>
          <AnimatePresence>
            {helpOpen && <SmartHelp onClose={() => setHelpOpen(false)} />}
          </AnimatePresence>
        </div>

        {/* Settings */}
        <button
          onClick={() => setSettingsOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 28, height: 28, borderRadius: '50%',
            background: 'var(--muted)', border: '1px solid var(--border)',
            color: 'var(--muted-foreground)', cursor: 'pointer',
            transition: 'color 0.1s, background 0.1s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--foreground)'; e.currentTarget.style.background = 'var(--s3)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted-foreground)'; e.currentTarget.style.background = 'var(--muted)' }}
          title="Agent settings"
        >
          <Settings2 size={13} strokeWidth={1.5} />
        </button>

        {/* Theme toggle — curtain sweep animation */}
        <ThemeToggle variant="icon" buttonSize={28} duration={480} />

        <AnimatePresence>
          {settingsOpen && <AgentSettings onClose={() => setSettingsOpen(false)} />}
        </AnimatePresence>

        <button
          className="header-search-btn"
          onClick={() => setIsOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '4px 9px',
            borderRadius: 'var(--r-ui)', background: 'var(--s2)', border: '1px solid var(--b2)',
            color: 'var(--t3)', fontSize: 11, cursor: 'pointer',
            transition: 'border-color 0.1s, color 0.1s', fontFamily: 'Outfit, sans-serif',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--b3)'; e.currentTarget.style.color = 'var(--t2)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--b2)'; e.currentTarget.style.color = 'var(--t3)' }}
        >
          {/* #11 — strokeWidth 1.5 */}
          <Search size={10} strokeWidth={1.5} />
          <span>Search</span>
          <kbd style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: 9, padding: '1px 4px',
            background: 'var(--card)', border: '1px solid var(--b2)', borderRadius: 3,
            color: 'var(--t3)', lineHeight: 1.5,
          }}>⌘K</kbd>
        </button>
      </div>
    </header>
  )
}

export default function App() {
  useAgentBootstrap()
  useAgentLoop()
  useScheduledStandup()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', background: 'var(--bg)', color: 'var(--t1)' }}>
      {/* Backdrop for sidebar drawer on compact screens */}
      {sidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        <Header
          settingsOpen={settingsOpen}
          setSettingsOpen={setSettingsOpen}
          onSidebarToggle={() => setSidebarOpen(v => !v)}
        />
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <Dashboard />
        </div>
      </div>
      <TriagePanel />
      <DemoScenarios />
      <AgentFeedIsland hideIsland={settingsOpen} />
      <CommandPalette />
      <GuidedOverlay />
      <TourGuide />
      <CategoryTour />
    </div>
  )
}
