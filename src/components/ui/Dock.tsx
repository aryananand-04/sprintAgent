import { useRef, useState } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import type { ReactNode } from 'react'

interface DockItemProps {
  children: ReactNode
  mouseY: ReturnType<typeof useMotionValue<number>>
  isActive?: boolean
  onClick?: () => void
  label?: string
}

function DockItem({ children, mouseY, isActive, onClick, label }: DockItemProps) {
  const ref = useRef<HTMLButtonElement>(null)

  const distance = useTransform(mouseY, (val) => {
    if (!ref.current) return Infinity
    const rect = ref.current.getBoundingClientRect()
    const itemCenterY = rect.top + rect.height / 2
    return Math.abs(val - itemCenterY)
  })

  const rawScale = useTransform(distance, [0, 60, 120], [1.45, 1.15, 1.0])
  const scale = useSpring(rawScale, { stiffness: 260, damping: 22 })

  return (
    <div style={{ position: 'relative' }} title={label}>
      <motion.button
        ref={ref}
        onClick={onClick}
        style={{
          scale,
          transformOrigin: 'left center',
          width: 32,
          height: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 8,
          border: 'none',
          cursor: 'pointer',
          background: isActive ? 'var(--b1)' : 'transparent',
          transition: 'background 0.12s',
          boxShadow: isActive ? 'inset 2px 0 0 var(--act)' : 'none',
          padding: 0,
        }}
        whileTap={{ scale: 0.92 }}
      >
        {children}
      </motion.button>
    </div>
  )
}

interface DockProps {
  items: {
    id: string
    icon: ReactNode
    label: string
    badge?: number
    isActive?: boolean
    onClick?: () => void
    badgeColor?: string
  }[]
}

/**
 * 21st.dev–style macOS Dock with proximity-based icon magnification.
 * Designed for vertical sidebar navigation.
 */
export function Dock({ items }: DockProps) {
  const mouseY = useMotionValue(Infinity)

  return (
    <div
      onMouseMove={(e) => mouseY.set(e.clientY)}
      onMouseLeave={() => mouseY.set(Infinity)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: '6px',
      }}
    >
      {items.map((item) => (
        <div key={item.id} style={{ position: 'relative' }}>
          <DockItem
            mouseY={mouseY}
            isActive={item.isActive}
            onClick={item.onClick}
            label={item.label}
          >
            {item.icon}
          </DockItem>
          {item.badge != null && item.badge > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              style={{
                position: 'absolute',
                top: -3,
                right: -3,
                minWidth: 14,
                height: 14,
                borderRadius: 7,
                background: item.badgeColor ?? 'var(--esc)',
                color: '#fff',
                fontSize: 8,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 3px',
                fontFamily: 'JetBrains Mono, monospace',
                border: '1.5px solid var(--bg)',
                pointerEvents: 'none',
              }}
            >
              {item.badge}
            </motion.span>
          )}
        </div>
      ))}
    </div>
  )
}
