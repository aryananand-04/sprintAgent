// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { useState } from 'react'
import { motion } from 'framer-motion'
import { X, Settings, RefreshCw } from 'lucide-react'
import { IntegrationsSettings } from './IntegrationsSettings'
import { useSprintStore } from '../../store/useSprintStore'
import type { TaskType } from '../../types'
import { useCan } from '../auth/SessionProvider'

export function AgentSettings({ onClose }: { onClose: () => void }) {
  const { autonomyConfig, setAutonomyConfig } = useSprintStore()
  const canEditPolicy = useCan('policy:edit')
  const canManageTasks = useCan('task:manage')
  const [rebalancing, setRebalancing] = useState(false)
  const [rebalanceResult, setRebalanceResult] = useState('')

  // Fix #11: manual capacity rebalance trigger
  const handleRebalance = () => {
    const { tasks, team, assignTaskById, addFeedEvent } = useSprintStore.getState()
    setRebalancing(true)
    let moved = 0
    for (const member of team.filter(m => m.currentLoad > 80)) {
      const memberTasks = tasks.filter(t => t.assigneeId === member.id && ['in-progress', 'assigned'].includes(t.status))
      const lowest = memberTasks.sort((a, b) => (a.storyPoints ?? 2) - (b.storyPoints ?? 2))[0]
      if (!lowest) continue
      const candidate = team.filter(m2 => m2.id !== member.id && m2.currentLoad < 70).sort((a, b) => a.currentLoad - b.currentLoad)[0]
      if (candidate) { assignTaskById(lowest.id, candidate.id); moved++ }
    }
    const msg = moved === 0
      ? 'Team load is already balanced — no reassignments needed.'
      : `Rebalanced: moved ${moved} task${moved > 1 ? 's' : ''} from overloaded engineers.`
    addFeedEvent({ type: 'status', message: `Manual rebalance: ${msg}` })
    setRebalanceResult(msg)
    setTimeout(() => { setRebalancing(false); setRebalanceResult('') }, 3000)
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(20, 19, 17,0.40)', zIndex: 9998, backdropFilter: 'blur(3px)' }}
      />
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 9999, display: 'flex', alignItems: 'flex-start',
        justifyContent: 'center', padding: '48px 16px 16px',
        pointerEvents: 'none',
      }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: -4 }}
        transition={{ type: 'spring', stiffness: 300, damping: 26 }}
        style={{
          width: '100%', maxWidth: 440,
          maxHeight: 'calc(100vh - 80px)',
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 10, boxShadow: '0 8px 24px rgba(20, 19, 17,0.18)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          pointerEvents: 'auto',
        }}
      >
        {/* Header — sticky, never scrolls away */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Settings size={14} style={{ color: 'var(--act)' }} strokeWidth={1.5} />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', letterSpacing: '-0.015em' }}>Agent Settings</span>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', display: 'flex', padding: 4, borderRadius: 4, transition: 'color 0.1s' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--foreground)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted-foreground)')}
          >
            <X size={14} strokeWidth={1.5} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '18px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {!canEditPolicy && (
            <p role="note" className="rounded-lg border border-border bg-muted px-3 py-2 text-[11px] text-muted-foreground">
              Read-only — only workspace admins can change autonomy policy and integrations.
            </p>
          )}
          <fieldset disabled={!canEditPolicy} style={{ display: 'contents' }}>
          <IntegrationsSettings canEdit={canEditPolicy} />

          {/* Autonomy thresholds */}
          <div>
            <div className="label" style={{ marginBottom: 12 }}>Autonomy Thresholds</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 11, color: 'var(--foreground)', fontWeight: 500 }}>ACT minimum clarity</span>
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono), monospace', fontWeight: 700, color: 'var(--act)' }}>
                    {autonomyConfig.actMinClarity}/5
                  </span>
                </div>
                <input type="range" min={1} max={5} value={autonomyConfig.actMinClarity}
                  onChange={e => setAutonomyConfig({ actMinClarity: Number(e.target.value) })}
                  style={{ width: '100%', accentColor: 'var(--act)' }}
                />
                <p style={{ fontSize: 10, color: 'var(--muted-foreground)', marginTop: 3 }}>
                  Tasks must meet this clarity score for the agent to ACT autonomously
                </p>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 11, color: 'var(--foreground)', fontWeight: 500 }}>ASK maximum clarity</span>
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono), monospace', fontWeight: 700, color: 'var(--warn)' }}>
                    {autonomyConfig.askMaxClarity}/5
                  </span>
                </div>
                <input type="range" min={1} max={4} value={autonomyConfig.askMaxClarity}
                  onChange={e => setAutonomyConfig({ askMaxClarity: Number(e.target.value) })}
                  style={{ width: '100%', accentColor: 'var(--ask-t)' }}
                />
                <p style={{ fontSize: 10, color: 'var(--muted-foreground)', marginTop: 3 }}>
                  Tasks at or below this clarity get ASK decision — agent pauses and asks you
                </p>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 11, color: 'var(--foreground)', fontWeight: 500 }}>Escalate critical after</span>
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono), monospace', fontWeight: 700, color: 'var(--crit)' }}>
                    {autonomyConfig.escalateIfCriticalUnassignedHours}h
                  </span>
                </div>
                <input type="range" min={1} max={8} value={autonomyConfig.escalateIfCriticalUnassignedHours}
                  onChange={e => setAutonomyConfig({ escalateIfCriticalUnassignedHours: Number(e.target.value) })}
                  style={{ width: '100%', accentColor: 'var(--esc)' }}
                />
                <p style={{ fontSize: 10, color: 'var(--muted-foreground)', marginTop: 3 }}>
                  If a CRITICAL task is unassigned this long, agent auto-escalates
                </p>
              </div>
            </div>
          </div>

          {/* Agent loop behavior */}
          <div>
            <div className="label" style={{ marginBottom: 12 }}>Agent Loop Behavior</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { key: 'capacityBreachThreshold' as const, label: 'Rebalance above load', color: 'var(--warn)', suffix: '%', min: 70, max: 99, description: 'Agent rebalances team when any member exceeds this load' },
                { key: 'blockedHoursThreshold' as const, label: 'Act on blocked after', color: 'var(--crit)', suffix: 'h', min: 1, max: 12, description: 'Hours a task stays blocked before agent tries to unblock it' },
                { key: 'escNudgeHours' as const, label: 'Nudge unresolved escalation after', color: 'var(--crit)', suffix: 'h', min: 1, max: 24, description: 'Hours before agent reminds PM of an unresolved escalation' },
                { key: 'velocityDeficitPts' as const, label: 'Velocity alert deficit', color: 'var(--warn)', suffix: 'pt', min: 2, max: 20, description: 'Points behind pace before agent posts a velocity risk alert' },
              ].map(({ key, label, color, suffix, min, max, description }) => (
                <div key={key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 11, color: 'var(--foreground)', fontWeight: 500 }}>{label}</span>
                    <span style={{ fontSize: 11, fontFamily: 'var(--font-mono), monospace', fontWeight: 700, color }}>{autonomyConfig[key]}{suffix}</span>
                  </div>
                  <input type="range" min={min} max={max} value={autonomyConfig[key]}
                    onChange={e => setAutonomyConfig({ [key]: Number(e.target.value) })}
                    style={{ width: '100%', accentColor: color }} />
                  <p style={{ fontSize: 10, color: 'var(--muted-foreground)', marginTop: 3 }}>{description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Never auto-assign task types */}
          <div>
            <div className="label" style={{ marginBottom: 6 }}>Never Auto-Assign Types</div>
            <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 10, lineHeight: 1.6 }}>
              Task types the agent will always ASK before assigning — even if clarity is high.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {(['bug', 'feature', 'spike', 'design', 'urgent', 'chore'] as TaskType[]).map(type => {
                const active = autonomyConfig.neverAutoAssignTypes.includes(type)
                return (
                  <button
                    key={type}
                    onClick={() => {
                      const next = active
                        ? autonomyConfig.neverAutoAssignTypes.filter(t => t !== type)
                        : [...autonomyConfig.neverAutoAssignTypes, type]
                      setAutonomyConfig({ neverAutoAssignTypes: next })
                    }}
                    style={{
                      padding: '4px 10px', borderRadius: 4, cursor: 'pointer',
                      fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-sans), sans-serif',
                      background: active ? 'var(--act-bg)' : 'var(--muted)',
                      border: `1px solid ${active ? 'var(--act-bd)' : 'var(--border)'}`,
                      color: active ? 'var(--act-t)' : 'var(--muted-foreground)',
                      transition: 'all 0.12s',
                    }}
                  >
                    {type}
                  </button>
                )
              })}
            </div>
          </div>

          </fieldset>

          {/* Fix #11: manual rebalance */}
          <fieldset disabled={!canManageTasks} style={{ display: 'contents' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
              <RefreshCw size={13} style={{ color: 'var(--act)' }} strokeWidth={1.5} />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--foreground)' }}>Manual Rebalance</span>
            </div>
            <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 10, lineHeight: 1.6 }}>
              Immediately run the capacity rebalancing check. Engineers above 80% load will have their lowest-priority task reassigned to someone with headroom.
            </p>
            <button
              onClick={handleRebalance}
              disabled={rebalancing}
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', gap: 6, opacity: rebalancing ? 0.7 : 1 }}
            >
              <RefreshCw size={11} style={{ animation: rebalancing ? 'spin 0.8s linear infinite' : 'none' }} />
              {rebalancing ? 'Rebalancing…' : 'Rebalance team now'}
            </button>
            {rebalanceResult && (
              <p style={{ fontSize: 10, color: 'var(--ok)', marginTop: 6, fontWeight: 500, lineHeight: 1.5 }}>{rebalanceResult}</p>
            )}
          </div>
          </fieldset>
        </div>
      </motion.div>
      </div>
    </>
  )
}
