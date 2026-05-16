import { motion } from 'framer-motion'
import type { CSSProperties } from 'react'

interface BorderBeamProps {
  /** Color of the leading beam */
  colorFrom?: string
  /** Color of the trailing beam */
  colorTo?: string
  /** Rotation duration in seconds */
  duration?: number
  /** Border width in px */
  borderWidth?: number
  /** Border radius to match the container */
  borderRadius?: number
  style?: CSSProperties
  className?: string
}

/**
 * 21st.dev BorderBeam — a conic-gradient beam that sweeps around
 * a card's border. Place inside a `position: relative` container.
 * The container MUST have `overflow: hidden`.
 */
export function BorderBeam({
  colorFrom = '#5E6AD2',
  colorTo = '#8B98F0',
  duration = 5,
  borderWidth = 1,
  borderRadius = 8,
  style,
  className,
}: BorderBeamProps) {
  return (
    <div
      aria-hidden
      className={className}
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 0,
        ...style,
      }}
    >
      {/* Rotating conic gradient */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration, repeat: Infinity, ease: 'linear' }}
        style={{
          position: 'absolute',
          inset: -80,
          background: `conic-gradient(from 0deg, transparent 0%, transparent 65%, ${colorFrom} 78%, ${colorTo} 85%, transparent 92%)`,
        }}
      />
      {/* Inner mask to hide everything except the border strip */}
      <div
        style={{
          position: 'absolute',
          inset: borderWidth,
          borderRadius: borderRadius - borderWidth,
          background: 'var(--card-inner, #18181C)',
        }}
      />
    </div>
  )
}
