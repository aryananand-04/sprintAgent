import { useState, useEffect } from 'react'

export function useTypewriter(text: string, speed = 18): { displayed: string; done: boolean } {
  // Progress is tagged with its text: a new text starts from zero without a reset inside the effect.
  const [progress, setProgress] = useState({ text: '', n: 0 })

  useEffect(() => {
    if (!text) return
    let i = 0
    const interval = setInterval(() => {
      i++
      setProgress({ text, n: i })
      if (i >= text.length) clearInterval(interval)
    }, speed)
    return () => clearInterval(interval)
  }, [text, speed])

  const n = progress.text === text ? progress.n : 0
  return { displayed: text.slice(0, n), done: !!text && n >= text.length }
}
