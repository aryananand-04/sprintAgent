import { useSprintStore } from '../store/useSprintStore'
import { loadColor } from '../utils/loadColor'

export function TeamUtilization() {
  const { tasks, team, escalations, calibration } = useSprintStore()

  const rows = team.map(member => {
    const memberTasks = tasks.filter(t => t.assigneeId === member.id)
    const done = memberTasks.filter(t => t.status === 'done')
    const inProgress = memberTasks.filter(t => t.status === 'in-progress')
    const blocked = memberTasks.filter(t => t.status === 'blocked')
    const ptsShipped = done.reduce((s, t) => s + (t.storyPoints ?? 2), 0)
    const escCount = escalations.filter(e => {
      const task = tasks.find(t => t.id === e.taskId)
      return task?.assigneeId === member.id
    }).length
    const confidences = memberTasks.filter(t => t.confidence !== undefined).map(t => t.confidence!)
    const avgConf = confidences.length ? Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length) : null

    return { member, done: done.length, inProgress: inProgress.length, blocked: blocked.length, ptsShipped, escCount, avgConf }
  })

  const totalCorrect = calibration.act.correct + calibration.ask.correct
  const totalDecisions = calibration.act.total + calibration.ask.total
  const calibrationPct = totalDecisions > 0 ? Math.round((totalCorrect / totalDecisions) * 100) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ flexShrink: 0, padding: '13px 18px', borderBottom: '1px solid var(--border)' }}>
        <span data-feature-id="team-report-header" style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)', letterSpacing: '-0.015em' }}>Team Utilization</span>
        <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 3 }}>
          Per-engineer sprint performance. Real-time from current sprint data.
        </p>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Per-member table */}
        <div>
          <div className="label" style={{ marginBottom: 6 }}>Engineers</div>
          {/* Sticky header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 40px 40px 40px 48px 48px 44px',
            gap: 8, padding: '5px 10px', borderRadius: 4,
            background: 'var(--muted)', fontSize: 9, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted-foreground)',
            marginBottom: 2,
          }}>
            <span>Engineer</span>
            <span style={{ textAlign: 'center' }}>Done</span>
            <span style={{ textAlign: 'center' }}>Active</span>
            <span style={{ textAlign: 'center' }}>Blk</span>
            <span style={{ textAlign: 'center' }}>Pts</span>
            <span style={{ textAlign: 'center' }}>Conf.</span>
            <span style={{ textAlign: 'center' }}>Load</span>
          </div>
          {/* Scrollable rows — fits ~5 rows, scroll for the rest */}
          <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
            {rows.map(({ member, done, inProgress, blocked, ptsShipped, escCount, avgConf }) => {
              const lc = loadColor(member.currentLoad)
              return (
                <div key={member.id} style={{
                  display: 'grid', gridTemplateColumns: '1fr 40px 40px 40px 48px 48px 44px',
                  gap: 8, padding: '6px 10px', borderRadius: 4,
                  background: 'var(--card)', border: '1px solid var(--border)',
                  fontSize: 11, color: 'var(--foreground)',
                  alignItems: 'center',
                }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 11, letterSpacing: '-0.01em' }}>{member.name.split(' ')[0]}</div>
                    <div style={{ fontSize: 9, color: 'var(--muted-foreground)', marginTop: 1 }}>{member.role}</div>
                  </div>
                  <span style={{ textAlign: 'center', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: 'var(--ok)' }}>{done}</span>
                  <span style={{ textAlign: 'center', fontFamily: 'JetBrains Mono, monospace', color: 'var(--foreground)' }}>{inProgress}</span>
                  <span style={{ textAlign: 'center', fontFamily: 'JetBrains Mono, monospace', color: blocked > 0 ? 'var(--crit)' : 'var(--muted-foreground)' }}>{blocked}</span>
                  <span style={{ textAlign: 'center', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: 'var(--act)' }}>{ptsShipped}pt</span>
                  <span style={{ textAlign: 'center', fontFamily: 'JetBrains Mono, monospace', color: avgConf ? (avgConf >= 75 ? 'var(--ok)' : avgConf >= 55 ? 'var(--warn)' : 'var(--crit)') : 'var(--muted-foreground)' }}>
                    {avgConf !== null ? `${avgConf}%` : '—'}
                  </span>
                  <div>
                    <div style={{ height: 3, borderRadius: 3, background: 'var(--muted)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 3, background: lc, width: `${member.currentLoad}%` }} />
                    </div>
                    <div style={{ fontSize: 8, color: lc, fontFamily: 'JetBrains Mono, monospace', marginTop: 2, textAlign: 'center' }}>
                      {member.currentLoad}%
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Agent calibration */}
        <div style={{ padding: '12px 14px', borderRadius: 6, background: 'var(--muted)', border: '1px solid var(--border)' }}>
          <div data-feature-id="calibration-section" className="label" style={{ marginBottom: 8 }}>Agent Calibration</div>
          <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 10, lineHeight: 1.6 }}>
            Tracks ACT decisions that led to successful task completion.
            {calibrationPct !== null ? ` Current accuracy: ` : ' Complete tasks to start building calibration data.'}
            {calibrationPct !== null && (
              <strong style={{ color: calibrationPct >= 80 ? 'var(--ok)' : calibrationPct >= 60 ? 'var(--warn)' : 'var(--crit)' }}>
                {calibrationPct}% ({totalCorrect}/{totalDecisions} decisions)
              </strong>
            )}
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            {(['act', 'ask', 'escalate'] as const).map(type => {
              const data = calibration[type]
              const pct = data.total > 0 ? Math.round((data.correct / data.total) * 100) : null
              const color = type === 'act' ? 'var(--act)' : type === 'ask' ? 'var(--warn)' : 'var(--crit)'
              return (
                <div key={type} style={{ flex: 1, padding: '8px 10px', borderRadius: 5, background: 'var(--card)', border: '1px solid var(--border)', textAlign: 'center' }}>
                  <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color, marginBottom: 4, fontFamily: 'JetBrains Mono, monospace' }}>
                    {type === 'escalate' ? 'ESC' : type.toUpperCase()}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color, fontFamily: 'JetBrains Mono, monospace', lineHeight: 1 }}>
                    {pct !== null ? `${pct}%` : '—'}
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--muted-foreground)', marginTop: 3 }}>{data.total} decisions</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
