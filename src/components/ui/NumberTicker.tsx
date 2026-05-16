'use client'
import { useEffect, useRef } from 'react'
import { animate, useMotionValue, useTransform } from 'framer-motion'

interface NumberTickerProps {
  value: number
  decimalPlaces?: number
  delay?: number
  duration?: number
  style?: React.CSSProperties
  className?: string
}

export function NumberTicker({
  value,
  decimalPlaces = 0,
  delay = 0,
  duration = 1.4,
  style,
  className,
}: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const motionVal = useMotionValue(0)
  const rounded = useTransform(motionVal, (v) =>
    parseFloat(v.toFixed(decimalPlaces))
  )

  useEffect(() => {
    const timer = setTimeout(() => {
      const controls = animate(motionVal, value, {
        duration,
        ease: [0.16, 1, 0.3, 1],
      })
      return controls.stop
    }, delay * 1000)
    return () => clearTimeout(timer)
  }, [value, duration, delay])

  useEffect(() => {
    return rounded.on('change', (v) => {
      if (ref.current) {
        ref.current.textContent = new Intl.NumberFormat('en-US', {
          minimumFractionDigits: decimalPlaces,
          maximumFractionDigits: decimalPlaces,
        }).format(v)
      }
    })
  }, [rounded, decimalPlaces])

  return (
    <span
      ref={ref}
      className={className}
      style={{ fontVariantNumeric: 'tabular-nums', ...style }}
    >
      0
    </span>
  )
}
