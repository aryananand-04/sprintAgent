import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Settings, CheckCircle, Slack, RefreshCw } from 'lucide-react'
import { useSprintStore } from '../store/useSprintStore'
import type { TaskType } from '../types'

export function AgentSettings({ onClose }: { onClose: () => void }) {
  const { slackWebhookUrl, setSlackWebhookUrl, outboundWebhookUrl, setOutboundWebhookUrl, autonomyConfig, setAutonomyConfig } = useSprintStore()
  const [url, setUrl] = useState(slackWebhookUrl)
  const [outboundUrl, setOutboundUrl] = useState(outboundWebhookUrl)
  const [saved, setSaved] = useState(false)
  const [outboundSaved, setOutboundSaved] = useState(false)
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

  const handleSave = () => {
    setSlackWebhookUrl(url.trim())
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleTest = async () => {
    if (!url.trim()) return
    try {
      await fetch(url.trim(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: '✅ Sprint Agent connected successfully. Escalations will appear here.' }),
      })
    } catch {}
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(9,9,11,0.40)', zIndex: 9998, backdropFilter: 'blur(3px)' }}
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
          borderRadius: 10, boxShadow: '0 8px 24px rgba(9,9,11,0.18)',
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
          {/* Slack webhook */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
              <Slack size={13} style={{ color: '#4A154B' }} strokeWidth={1.5} />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--foreground)' }}>Slack Escalation Webhook</span>
            </div>
            <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 10, lineHeight: 1.6 }}>
              When the agent escalates a task, it posts to this Slack channel in real time.
              Get your webhook URL from <strong>api.slack.com/apps → Incoming Webhooks</strong>.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <input
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://hooks.slack.com/services/T…/B…/…"
                style={{
                  width: '100%', outline: 'none',
                  background: 'var(--muted)', border: '1px solid var(--border)',
                  borderRadius: 5, padding: '8px 11px',
                  fontSize: 11, color: 'var(--foreground)',
                  fontFamily: 'JetBrains Mono, monospace',
                  transition: 'border-color 0.12s',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = 'var(--act)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              />
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={handleSave} className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                  {saved ? <><CheckCircle size={11} /> Saved</> : 'Save webhook'}
                </button>
                <button onClick={handleTest} disabled={!url.trim()} className="btn btn-secondary" style={{ flexShrink: 0 }}>
                  Send test
                </button>
              </div>
            </div>
            {slackWebhookUrl && (
              <p style={{ fontSize: 10, color: 'var(--ok)', marginTop: 6, fontWeight: 500 }}>
                Active — escalations will post to Slack
              </p>
            )}
          </div>

          {/* Outbound webhook */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--foreground)', marginBottom: 5 }}>Outbound Webhook (all decisions)</div>
            <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 8, lineHeight: 1.6 }}>
              Fires on every agent decision (ACT, ASK, ESCALATE). Build your own integrations on top.
            </p>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                value={outboundUrl}
                onChange={e => setOutboundUrl(e.target.value.trim())}
                placeholder="https://your-endpoint.com/webhook"
                style={{ flex: 1, outline: 'none', background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 5, padding: '7px 10px', fontSize: 11, color: 'var(--foreground)', fontFamily: 'JetBrains Mono, monospace', transition: 'border-color 0.12s' }}
                onFocus={e => (e.currentTarget.style.borderColor = 'var(--act)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              />
              <button
                onClick={() => { setOutboundWebhookUrl(outboundUrl); setOutboundSaved(true); setTimeout(() => setOutboundSaved(false), 2000) }}
                className="btn btn-secondary"
                style={{ flexShrink: 0 }}
              >
                {outboundSaved ? <><CheckCircle size={11} /> Saved</> : 'Save'}
              </button>
            </div>
            {outboundWebhookUrl && (
              <p style={{ fontSize: 10, color: 'var(--ok)', marginTop: 6, fontWeight: 500 }}>
                Active — all decisions fire to this endpoint
              </p>
            )}
          </div>

          {/* Autonomy thresholds */}
          <div>
            <div className="label" style={{ marginBottom: 12 }}>Autonomy Thresholds</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 11, color: 'var(--foreground)', fontWeight: 500 }}>ACT minimum clarity</span>
                  <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: 'var(--act)' }}>
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
                  <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: 'var(--warn)' }}>
                    {autonomyConfig.askMaxClarity}/5
                  </span>
                </div>
                <input type="range" min={1} max={4} value={autonomyConfig.askMaxClarity}
                  onChange={e => setAutonomyConfig({ askMaxClarity: Number(e.target.value) })}
                  style={{ width: '100%', accentColor: '#d97706' }}
                />
                <p style={{ fontSize: 10, color: 'var(--muted-foreground)', marginTop: 3 }}>
                  Tasks at or below this clarity get ASK decision — agent pauses and asks you
                </p>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 11, color: 'var(--foreground)', fontWeight: 500 }}>Escalate critical after</span>
                  <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: 'var(--crit)' }}>
                    {autonomyConfig.escalateIfCriticalUnassignedHours}h
                  </span>
                </div>
                <input type="range" min={1} max={8} value={autonomyConfig.escalateIfCriticalUnassignedHours}
                  onChange={e => setAutonomyConfig({ escalateIfCriticalUnassignedHours: Number(e.target.value) })}
                  style={{ width: '100%', accentColor: '#dc2626' }}
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
                    <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color }}>{(autonomyConfig as any)[key]}{suffix}</span>
                  </div>
                  <input type="range" min={min} max={max} value={(autonomyConfig as any)[key]}
                    onChange={e => setAutonomyConfig({ [key]: Number(e.target.value) } as any)}
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
                      fontSize: 11, fontWeight: 600, fontFamily: 'Outfit, sans-serif',
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

          {/* Fix #11: manual rebalance */}
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
        </div>
      </motion.div>
      </div>
    </>
  )
}
