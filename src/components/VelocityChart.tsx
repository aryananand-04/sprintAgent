import { useSprintStore } from '../store/useSprintStore'

export function VelocityChart() {
  const { sprintHistory, sprint } = useSprintStore()

  const allSprints = [
    ...sprintHistory,
    { id: 'current', name: sprint.name, completedPoints: sprint.completedPoints, committedPoints: sprint.committedPoints, velocity: sprint.velocity },
  ].slice(-8)   // show last 8 sprints

  if (allSprints.length < 2) {
    return (
      <div style={{ padding: '20px 0', textAlign: 'center' }}>
        <p style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Archive completed sprints to see velocity trends here.</p>
      </div>
    )
  }

  const W = 320
  const H = 100
  const PAD = { t: 8, r: 8, b: 20, l: 28 }
  const chartW = W - PAD.l - PAD.r
  const chartH = H - PAD.t - PAD.b
  const maxVelocity = Math.max(...allSprints.map(s => s.committedPoints), 10)

  const barW = (chartW / allSprints.length) - 4

  return (
    <div>
      <svg width={W} height={H} style={{ overflow: 'visible', display: 'block' }}>
        {/* Grid lines */}
        {[0, 0.5, 1].map(r => {
          const y = PAD.t + chartH * (1 - r)
          return (
            <g key={r}>
              <line x1={PAD.l} y1={y} x2={PAD.l + chartW} y2={y} stroke="var(--border)" strokeWidth={1} strokeDasharray={r === 0 ? undefined : '3 3'} />
              <text x={PAD.l - 4} y={y + 3.5} textAnchor="end" fontSize={8} fill="var(--muted-foreground)" fontFamily="JetBrains Mono, monospace">
                {Math.round(maxVelocity * r)}
              </text>
            </g>
          )
        })}

        {allSprints.map((s, i) => {
          const x = PAD.l + i * (chartW / allSprints.length) + 2
          const committedH = (s.committedPoints / maxVelocity) * chartH
          const completedH = (s.completedPoints / maxVelocity) * chartH
          const isCurrentSprint = i === allSprints.length - 1

          return (
            <g key={s.id}>
              {/* Committed bar (background) */}
              <rect x={x} y={PAD.t + chartH - committedH} width={barW} height={committedH}
                fill="var(--muted)" rx={2} />
              {/* Completed bar (foreground) */}
              <rect x={x} y={PAD.t + chartH - completedH} width={barW} height={completedH}
                fill={isCurrentSprint ? 'var(--act)' : 'var(--ok)'} rx={2} opacity={isCurrentSprint ? 0.8 : 1} />
              {/* Sprint label */}
              <text x={x + barW / 2} y={H - 4} textAnchor="middle" fontSize={7} fill="var(--muted-foreground)"
                fontFamily="JetBrains Mono, monospace">
                {s.name.replace('Sprint ', 'S')}
              </text>
            </g>
          )
        })}
      </svg>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 6, fontSize: 10, color: 'var(--muted-foreground)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 10, height: 8, background: 'var(--ok)', borderRadius: 2 }} />
          <span>Completed</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 10, height: 8, background: 'var(--muted)', borderRadius: 2 }} />
          <span>Committed</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 10, height: 8, background: 'var(--act)', borderRadius: 2, opacity: 0.8 }} />
          <span>Current</span>
        </div>
      </div>
    </div>
  )
}
