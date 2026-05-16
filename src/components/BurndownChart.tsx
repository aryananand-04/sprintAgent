import { useEffect } from 'react'
import { useSprintStore } from '../store/useSprintStore'

/** Records today's snapshot if not already done, then renders the SVG chart. */
export function BurndownChart() {
  const { sprint, burndownSnapshots, recordBurndownSnapshot } = useSprintStore()

  useEffect(() => {
    recordBurndownSnapshot()
  }, [sprint.completedPoints])

  if (burndownSnapshots.length < 2) {
    return (
      <div style={{ padding: '20px 0', textAlign: 'center' }}>
        <p style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Burndown builds as you complete tasks each day.</p>
        <p style={{ fontSize: 10, color: 'var(--muted-foreground)', marginTop: 3 }}>Mark tasks done to see the chart populate.</p>
      </div>
    )
  }

  // Build a 14-day ideal line + actual snapshots
  const total    = sprint.committedPoints
  const days     = 14
  const W        = 320
  const H        = 120
  const PAD      = { t: 8, r: 8, b: 24, l: 32 }
  const chartW   = W - PAD.l - PAD.r
  const chartH   = H - PAD.t - PAD.b

  // Ideal: starts at `total`, ends at 0
  const idealPoints = Array.from({ length: days + 1 }, (_, i) => ({
    x: PAD.l + (i / days) * chartW,
    y: PAD.t + ((total - (total / days) * i) / total) * chartH,
  }))

  // Actual snapshots — map date to elapsed day index
  const sortedSnaps = [...burndownSnapshots].sort((a, b) => a.date.localeCompare(b.date))
  const firstDate   = new Date(sortedSnaps[0].date)

  const actualPoints = sortedSnaps.map(s => {
    const daysElapsed = Math.round((new Date(s.date).getTime() - firstDate.getTime()) / 86_400_000)
    return {
      x: PAD.l + Math.min(daysElapsed / days, 1) * chartW,
      y: PAD.t + ((total - s.completed) / total) * chartH,
    }
  })

  const toPath = (pts: { x: number; y: number }[]) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')

  // Y-axis labels
  const yTicks = [0, Math.round(total * 0.5), total]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8, fontSize: 10, color: 'var(--muted-foreground)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 20, height: 1, background: 'var(--border)', borderTop: '1px dashed var(--muted-foreground)' }} />
          <span>Ideal</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 20, height: 2, background: 'var(--act)', borderRadius: 1 }} />
          <span>Actual</span>
        </div>
      </div>

      <svg width={W} height={H} style={{ overflow: 'visible', display: 'block' }}>
        {/* Y-axis ticks */}
        {yTicks.map(v => {
          const y = PAD.t + ((total - v) / total) * chartH
          return (
            <g key={v}>
              <line x1={PAD.l - 4} y1={y} x2={PAD.l} y2={y} stroke="var(--border)" strokeWidth={1} />
              <text x={PAD.l - 6} y={y + 3.5} textAnchor="end" fontSize={8} fill="var(--muted-foreground)" fontFamily="JetBrains Mono, monospace">
                {v}
              </text>
            </g>
          )
        })}

        {/* Day labels */}
        {[0, 7, 14].map(d => (
          <text key={d} x={PAD.l + (d / days) * chartW} y={H - 4}
            textAnchor="middle" fontSize={8} fill="var(--muted-foreground)" fontFamily="JetBrains Mono, monospace">
            d{d}
          </text>
        ))}

        {/* Axes */}
        <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={PAD.t + chartH} stroke="var(--border)" strokeWidth={1} />
        <line x1={PAD.l} y1={PAD.t + chartH} x2={PAD.l + chartW} y2={PAD.t + chartH} stroke="var(--border)" strokeWidth={1} />

        {/* Ideal line — dashed */}
        <path d={toPath(idealPoints)} fill="none" stroke="var(--muted-foreground)" strokeWidth={1} strokeDasharray="4 3" opacity={0.5} />

        {/* Actual area fill */}
        {actualPoints.length > 1 && (
          <path
            d={`${toPath(actualPoints)} L ${actualPoints[actualPoints.length - 1].x} ${PAD.t + chartH} L ${PAD.l} ${PAD.t + chartH} Z`}
            fill="var(--act)" opacity={0.08}
          />
        )}

        {/* Actual line */}
        {actualPoints.length > 1 && (
          <path d={toPath(actualPoints)} fill="none" stroke="var(--act)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        )}

        {/* Dots on actual */}
        {actualPoints.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3} fill="var(--act)" />
        ))}
      </svg>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10, color: 'var(--muted-foreground)', fontFamily: 'JetBrains Mono, monospace' }}>
        <span>{sprint.completedPoints}pt completed</span>
        <span>{sprint.committedPoints - sprint.completedPoints}pt remaining</span>
      </div>
    </div>
  )
}
