import { useEffect, useState, useRef } from 'react'
import type { CSSProperties } from 'react'

interface TypingAnimationProps {
  text: string
  speed?: number
  className?: string
  style?: CSSProperties
  cursorColor?: string
  showCursor?: boolean
  onDone?: () => void
}

export function TypingAnimation({
  text,
  speed = 14,
  className,
  style,
  cursorColor = 'var(--act)',
  showCursor = true,
  onDone,
}: TypingAnimationProps) {
  // Progress is tagged with its text, so a new text starts from zero without resetting state in an effect.
  const [progress, setProgress] = useState({ text: '', n: 0 })
  const onDoneRef = useRef(onDone)
  useEffect(() => { onDoneRef.current = onDone })

  useEffect(() => {
    if (!text) return
    let i = 0
    const interval = setInterval(() => {
      i++
      setProgress({ text, n: i })
      if (i >= text.length) {
        clearInterval(interval)
        onDoneRef.current?.()
      }
    }, speed)
    return () => clearInterval(interval)
  }, [text, speed])

  const n = progress.text === text ? progress.n : 0
  const displayed = text.slice(0, n)
  const done = !!text && n >= text.length

  return (
    <span className={className} style={style}>
      {displayed || text}
      {showCursor && !done && text && (
        <span
          aria-hidden
          style={{
            display: 'inline-block',
            width: 2,
            height: '0.85em',
            background: cursorColor,
            marginLeft: 2,
            verticalAlign: 'middle',
            borderRadius: 1,
            animation: 'pulseDot 0.75s ease-in-out infinite',
          }}
        />
      )}
    </span>
  )
}
