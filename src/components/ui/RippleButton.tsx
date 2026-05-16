import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ReactNode, CSSProperties } from 'react'

interface Ripple { id: number; x: number; y: number }

interface RippleButtonProps {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  className?: string
  style?: CSSProperties
  rippleColor?: string
}

/**
 * 21st.dev–style button with a radial ripple that expands from the click point.
 */
export function RippleButton({
  children,
  onClick,
  disabled,
  className,
  style,
  rippleColor = 'rgba(255,255,255,0.22)',
}: RippleButtonProps) {
  const [ripples, setRipples] = useState<Ripple[]>([])
  const nextId = useRef(0)
  const btnRef = useRef<HTMLButtonElement>(null)

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return
    const rect = btnRef.current!.getBoundingClientRect()
    const id = nextId.current++
    setRipples(prev => [...prev, { id, x: e.clientX - rect.left, y: e.clientY - rect.top }])
    setTimeout(() => setRipples(prev => prev.filter(r => r.id !== id)), 700)
    onClick?.()
  }

  return (
    <button
      ref={btnRef}
      onClick={handleClick}
      disabled={disabled}
      className={className}
      style={{
        position: 'relative', overflow: 'hidden', cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        ...style,
      }}
    >
      <AnimatePresence>
        {ripples.map(r => (
          <motion.span
            key={r.id}
            initial={{ width: 0, height: 0, opacity: 0.6, x: r.x, y: r.y, translateX: '-50%', translateY: '-50%' }}
            animate={{ width: 300, height: 300, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.65, ease: 'easeOut' }}
            style={{
              position: 'absolute', borderRadius: '50%',
              background: rippleColor, pointerEvents: 'none',
              top: 0, left: 0,
            }}
          />
        ))}
      </AnimatePresence>
      <span style={{ position: 'relative', zIndex: 1, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        {children}
      </span>
    </button>
  )
}
