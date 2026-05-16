import { motion } from 'framer-motion'

interface GaugeCircleProps {
  value: number
  size?: number
  strokeWidth?: number
  color?: string
  trackColor?: string
  label?: string
  valueStyle?: React.CSSProperties
  /** false = ring only, no center text — for compact/mini usage */
  showValue?: boolean
  /** animation delay in seconds */
  delay?: number
}

/**
 * SVG circular progress gauge.
 * Works on both light (trackColor: rgba(9,9,11,0.08)) and dark
 * (trackColor: rgba(255,255,255,0.12)) backgrounds.
 * Set showValue={false} for mini ring usage without center text.
 */
export function GaugeCircle({
  value,
  size = 72,
  strokeWidth = 5,
  color = 'var(--ok)',
  trackColor,
  label,
  valueStyle,
  showValue = true,
  delay = 0.1,
}: GaugeCircleProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference

  /* Auto-select track color based on whether a custom one is provided.
     Defaults to a neutral that works on white backgrounds. */
  const resolvedTrack = trackColor ?? 'rgba(9,9,11,0.08)'

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {/* Track */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={resolvedTrack} strokeWidth={strokeWidth}
        />
        {/* Animated fill arc */}
        <motion.circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay }}
        />
      </svg>

      {/* Center content — hidden in mini mode */}
      {showValue && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{
            fontSize: size * 0.26, fontWeight: 700, lineHeight: 1,
            fontFamily: 'JetBrains Mono, monospace', fontVariantNumeric: 'tabular-nums',
            color,
            ...valueStyle,
          }}>
            {value}
          </span>
          {label && (
            <span style={{
              fontSize: size * 0.12, color: 'var(--t3)', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2,
            }}>
              {label}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
