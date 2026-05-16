import { useRef, useState } from 'react'
import type { ReactNode, CSSProperties } from 'react'

interface SpotlightCardProps {
  children: ReactNode
  className?: string
  style?: CSSProperties
  spotlightColor?: string
  spotlightSize?: number
}

export function SpotlightCard({
  children,
  className,
  style,
  spotlightColor = 'rgba(94,106,210,0.11)',
  spotlightSize = 320,
}: SpotlightCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)

  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  }

  const onMouseLeave = () => setPos(null)

  return (
    <div
      ref={ref}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      className={className}
      style={{ position: 'relative', overflow: 'hidden', ...style }}
    >
      {/* Spotlight radial glow */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 0,
          opacity: pos ? 1 : 0,
          transition: 'opacity 0.25s ease',
          background: pos
            ? `radial-gradient(${spotlightSize}px circle at ${pos.x}px ${pos.y}px, ${spotlightColor}, transparent 70%)`
            : 'transparent',
        }}
      />
      <div style={{ position: 'relative', zIndex: 1 }}>
        {children}
      </div>
    </div>
  )
}
