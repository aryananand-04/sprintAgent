import { motion } from 'framer-motion'
import type { ReactNode, CSSProperties } from 'react'

interface GlowCardProps {
  children: ReactNode
  glowColor?: string
  glowSize?: number
  className?: string
  style?: CSSProperties
  animate?: boolean
}

/**
 * 21st.dev–style card with a subtle pulsing outer glow.
 * Ideal for escalation cards, alerts, and high-priority items.
 */
export function GlowCard({
  children,
  glowColor = 'rgba(185,64,64,0.22)',
  glowSize = 12,
  className,
  style,
  animate: shouldAnimate = true,
}: GlowCardProps) {
  return (
    <motion.div
      className={className}
      style={{ position: 'relative', ...style }}
      animate={
        shouldAnimate
          ? {
              boxShadow: [
                `0 0 0 0 ${glowColor}, 0 0 ${glowSize}px 0 transparent`,
                `0 0 0 0 ${glowColor.replace(/[\d.]+\)$/, '0)')} , 0 0 ${glowSize * 2}px ${Math.floor(glowSize / 2)}px ${glowColor}`,
                `0 0 0 0 ${glowColor}, 0 0 ${glowSize}px 0 transparent`,
              ],
            }
          : {}
      }
      transition={
        shouldAnimate
          ? { duration: 2.6, repeat: Infinity, ease: 'easeInOut' }
          : {}
      }
    >
      {children}
    </motion.div>
  )
}
