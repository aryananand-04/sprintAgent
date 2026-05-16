import { motion, AnimatePresence } from 'framer-motion'
import { Zap, X, AlertCircle, PaintbrushIcon, Users, MessageCircle, Package, Check } from 'lucide-react'
import { useState } from 'react'
import { useSprintStore } from '../store/useSprintStore'

const SCENARIOS: { id: string; icon: React.ElementType; label: string; description: string; isUrgent?: boolean }[] = [
  { id: 'urgent-bug',    icon: AlertCircle,    label: 'Urgent Bug',        description: 'CRITICAL: Checkout 500 errors in production', isUrgent: true },
  { id: 'blocked-design',icon: PaintbrushIcon, label: 'Design Blocked',     description: 'Checkout UI waiting on sign-off' },
  { id: 'overloaded',    icon: Users,          label: 'Engineer Overloaded',description: 'Dev Mehta hits 98% capacity' },
  { id: 'vague-request', icon: MessageCircle,  label: 'Vague Request',      description: '"Make checkout feel more premium"' },
  { id: 'scope-creep',   icon: Package,        label: 'Scope Creep',        description: '"Quick" loyalty points: 8+ days' },
]

export function DemoScenarios() {
  const { isDemoOpen, setDemoOpen, triggerScenario, setView } = useSprintStore()
  const [firing, setFiring] = useState<string | null>(null)
  // Track scenarios fired this session — cooldown prevents re-trigger
  const [fired, setFired] = useState<Set<string>>(new Set())

  const handle = (id: string) => {
    if (firing || fired.has(id)) return
    setFiring(id)
    triggerScenario(id)
    if (['urgent-bug', 'vague-request', 'scope-creep'].includes(id)) setView('intake')
    else if (id === 'overloaded') setView('escalations')
    else setView('sprint')
    setTimeout(() => {
      setFired(prev => new Set([...prev, id]))
      setFiring(null)
      setDemoOpen(false)
    }, 1000)
  }

  return (
    <>
      <button
        onClick={() => setDemoOpen(true)}
        style={{
          position: 'fixed', bottom: 20, right: 20, zIndex: 30,
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '7px 13px', borderRadius: 5,
          background: 'var(--act)', color: '#fff',
          fontSize: 12, fontWeight: 700,
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 2px 8px rgba(12,102,228,0.28)',
          cursor: 'pointer', fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.01em',
          transition: 'background 0.12s, box-shadow 0.12s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = '#0052CC' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'var(--act)' }}
      >
        <Zap size={11} /> Simulate
        {fired.size > 0 && (
          <span style={{ fontSize: 9, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', background: 'rgba(255,255,255,0.20)', borderRadius: 3, padding: '0 4px', marginLeft: 2 }}>
            {fired.size}/{SCENARIOS.length}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isDemoOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setDemoOpen(false)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(9,9,11,0.22)', zIndex: 40, backdropFilter: 'blur(2px)' }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 6 }}
              transition={{ type: 'spring', damping: 26, stiffness: 340 }}
              style={{
                position: 'fixed', bottom: 58, right: 20, zIndex: 50,
                width: 300, borderRadius: 8,
                background: 'var(--card)', border: '1px solid var(--b2)',
                boxShadow: '0 8px 24px rgba(9,9,11,0.18)', overflow: 'hidden',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', borderBottom: '1px solid var(--b1)' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--t1)', letterSpacing: '-0.01em', marginBottom: 1 }}>
                    <Zap size={11} style={{ color: 'var(--act)' }} /> Simulate Event
                  </div>
                  <p style={{ fontSize: 10, color: 'var(--t3)' }}>Inject a real-world sprint event</p>
                </div>
                <button onClick={() => setDemoOpen(false)} style={{ color: 'var(--t3)', cursor: 'pointer', border: 'none', background: 'transparent', padding: 4, borderRadius: 4, transition: 'color 0.1s' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--t2)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--t3)')}
                ><X size={13} /></button>
              </div>

              <div style={{ padding: '5px', display: 'flex', flexDirection: 'column', gap: 1 }}>
                {SCENARIOS.map(sc => {
                  const Icon = sc.icon
                  const isFiring = firing === sc.id
                  const isDone = fired.has(sc.id)

                  return (
                    <motion.button
                      key={sc.id}
                      onClick={() => handle(sc.id)}
                      disabled={!!firing || isDone}
                      whileHover={!firing && !isDone ? { x: 2 } : {}}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 9px', borderRadius: 5,
                        background: isFiring ? 'var(--s2)' : isDone ? 'rgba(33,110,78,0.04)' : 'transparent',
                        border: `1px solid ${isFiring ? 'var(--b2)' : isDone ? 'rgba(33,110,78,0.18)' : 'transparent'}`,
                        cursor: isDone ? 'default' : firing ? 'not-allowed' : 'pointer',
                        opacity: firing && !isFiring ? 0.3 : 1, textAlign: 'left',
                        transition: 'all 0.1s', width: '100%',
                      }}
                      onMouseEnter={e => { if (!firing && !isDone) { e.currentTarget.style.background = 'var(--s2)'; e.currentTarget.style.borderColor = 'var(--b1)' } }}
                      onMouseLeave={e => { if (!isFiring && !isDone) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent' } }}
                    >
                      <div style={{ width: 24, height: 24, borderRadius: 5, background: isDone ? 'rgba(33,110,78,0.10)' : 'var(--s2)', border: `1px solid ${isDone ? 'rgba(33,110,78,0.22)' : 'var(--b1)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {isFiring ? (
                          <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}>
                            <Zap size={11} style={{ color: 'var(--act)' }} />
                          </motion.div>
                        ) : isDone ? (
                          <Check size={11} style={{ color: 'var(--ok)' }} />
                        ) : (
                          <Icon size={11} style={{ color: 'var(--t2)' }} />
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: isDone ? 'var(--t3)' : 'var(--t1)', letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 1 }}>
                          {sc.label}
                          {sc.isUrgent && !isFiring && !isDone && (
                            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--crit)', display: 'inline-block', animation: 'pulseDot 1.5s ease-in-out infinite' }} />
                          )}
                        </div>
                        <div style={{ fontSize: 10, color: isDone ? 'var(--ok)' : 'var(--t3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {isDone ? 'Triggered — check board and feed' : sc.description}
                        </div>
                      </div>
                      {isFiring && <span style={{ fontSize: 10, color: 'var(--act)', flexShrink: 0, fontWeight: 600 }}>Running…</span>}
                    </motion.button>
                  )
                })}
              </div>

              <div style={{ padding: '8px 14px 10px', borderTop: '1px solid var(--b1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <p style={{ fontSize: 10, color: 'var(--t3)' }}>Agent responds autonomously to each event</p>
                {fired.size > 0 && (
                  <span style={{ fontSize: 10, color: 'var(--ok)', fontWeight: 600 }}>{fired.size}/{SCENARIOS.length} run</span>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
