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
  const [displayed, setDisplayed] = useState('')
  const [done, setDone] = useState(false)
  const prevText = useRef('')

  useEffect(() => {
    if (text === prevText.current) return
    prevText.current = text
    setDisplayed('')
    setDone(false)
    if (!text) return

    let i = 0
    const interval = setInterval(() => {
      i++
      setDisplayed(text.slice(0, i))
      if (i >= text.length) {
        clearInterval(interval)
        setDone(true)
        onDone?.()
      }
    }, speed)

    return () => clearInterval(interval)
  }, [text, speed])

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
