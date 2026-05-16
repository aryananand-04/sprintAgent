import { useRef } from 'react'
import { motion, useMotionValue, useSpring } from 'framer-motion'
import type { ReactNode, CSSProperties } from 'react'

interface MagneticButtonProps {
  children: ReactNode
  className?: string
  style?: CSSProperties
  strength?: number
  onClick?: () => void
  as?: 'button' | 'div'
}

export function MagneticButton({
  children,
  className,
  style,
  strength = 0.28,
  onClick,
}: MagneticButtonProps) {
  const ref = useRef<HTMLDivElement>(null)

  const x = useMotionValue(0)
  const y = useMotionValue(0)

  const springConfig = { stiffness: 180, damping: 18, mass: 0.6 }
  const springX = useSpring(x, springConfig)
  const springY = useSpring(y, springConfig)

  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    x.set((e.clientX - cx) * strength)
    y.set((e.clientY - cy) * strength)
  }

  const onMouseLeave = () => {
    x.set(0)
    y.set(0)
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      style={{ display: 'inline-flex' }}
    >
      <motion.div
        style={{ x: springX, y: springY, display: 'inline-flex', ...style }}
        whileTap={{ scale: 0.96 }}
        className={className}
        onClick={onClick}
      >
        {children}
      </motion.div>
    </div>
  )
}
