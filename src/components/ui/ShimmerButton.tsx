import { motion } from 'framer-motion'
import type { ReactNode, CSSProperties } from 'react'

interface ShimmerButtonProps {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  className?: string
  style?: CSSProperties
  background?: string
  shimmerColor?: string
  shimmerDuration?: string
}

export function ShimmerButton({
  children,
  onClick,
  disabled,
  className,
  style,
  background = 'var(--act)',
  shimmerColor = 'rgba(255,255,255,0.18)',
  shimmerDuration = '2.4s',
}: ShimmerButtonProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      disabled={disabled}
      className={className}
      style={{
        position: 'relative',
        overflow: 'hidden',
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: '7px 14px',
        borderRadius: 7,
        background,
        border: '1px solid rgba(255,255,255,0.09)',
        color: '#fff',
        fontSize: 12,
        fontWeight: 700,
        fontFamily: 'Outfit, sans-serif',
        letterSpacing: '-0.01em',
        opacity: disabled ? 0.38 : 1,
        boxShadow: '0 1px 4px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.10)',
        ...style,
      }}
    >
      {/* Shimmer layer */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(105deg, transparent 40%, ${shimmerColor} 50%, transparent 60%)`,
          backgroundSize: '200% 100%',
          backgroundPosition: '-200% 0',
          animation: `shimmer ${shimmerDuration} linear infinite`,
          pointerEvents: 'none',
          borderRadius: 'inherit',
        }}
      />
      {/* Content */}
      <span style={{
        position: 'relative', zIndex: 1,
        display: 'inline-flex', alignItems: 'center', gap: 6,
      }}>
        {children}
      </span>
    </motion.button>
  )
}
