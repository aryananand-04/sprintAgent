import {
  useState,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
  type CSSProperties,
} from 'react'

export type Theme = 'light' | 'dark'

export interface ThemeToggleProps {
  variant?: 'default' | 'appbar' | 'icon'
  defaultTheme?: Theme
  barHeight?: number
  buttonSize?: number
  duration?: number
  onThemeChange?: (theme: Theme) => void
  children?: ReactNode
}

/* ── Curtain + button palette — tuned to this project's design tokens ── */
const TOKENS: Record<Theme, Record<string, string>> = {
  light: {
    pageBg:  '#F4F5F7',   /* curtain color when sweeping to light */
    btnBg:   '#EBECF0',
    btnText: '#5E6C84',
    btnRing: 'rgba(9,30,66,0.14)',
  },
  dark: {
    pageBg:  '#0D0D10',   /* curtain color when sweeping to dark */
    btnBg:   '#252529',
    btnText: '#EEEEF2',
    btnRing: 'rgba(255,255,255,0.10)',
  },
}

function MoonIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="1"     x2="12" y2="3"     />
      <line x1="12" y1="21"    x2="12" y2="23"    />
      <line x1="4.22"  y1="4.22"  x2="5.64"  y2="5.64"  />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1"     y1="12"    x2="3"     y2="12"    />
      <line x1="21"    y1="12"    x2="23"    y2="12"    />
      <line x1="4.22"  y1="19.78" x2="5.64"  y2="18.36" />
      <line x1="18.36" y1="5.64"  x2="19.78" y2="4.22"  />
    </svg>
  )
}

type CurtainPhase = 'idle' | 'falling' | 'rising'
const EASING = 'cubic-bezier(0.76, 0, 0.24, 1)'

export function ThemeToggle({
  variant     = 'icon',
  defaultTheme = 'light',
  buttonSize  = 30,
  duration    = 500,
  onThemeChange,
}: ThemeToggleProps) {
  const [theme, setTheme]     = useState<Theme>(defaultTheme)
  const [phase, setPhase]     = useState<CurtainPhase>('idle')
  const [hovered, setHovered] = useState(false)
  const [pressed, setPressed] = useState(false)
  const curtainColorRef       = useRef<string>('')
  const t                     = TOKENS[theme]

  /* Sync with existing dark class on mount */
  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark')
    if (isDark && theme !== 'dark') setTheme('dark')
    else if (!isDark && theme !== 'light') setTheme('light')
  }, [])

  const toggle = useCallback(() => {
    if (phase !== 'idle') return
    const next: Theme = theme === 'light' ? 'dark' : 'light'
    curtainColorRef.current = TOKENS[next].pageBg
    setPhase('falling')

    setTimeout(() => {
      setTheme(next)
      onThemeChange?.(next)
      if (next === 'dark') {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
      setPhase('rising')
      setTimeout(() => setPhase('idle'), duration + 60)
    }, duration)
  }, [phase, theme, duration, onThemeChange])

  const curtainStyle: CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: curtainColorRef.current,
    transformOrigin: 'top',
    transform: phase === 'falling' ? 'scaleY(1)' : 'scaleY(0)',
    transition: phase !== 'idle' ? `transform ${duration}ms ${EASING}` : 'none',
    zIndex: 9997,
    pointerEvents: 'none',
  }

  const btnScale = pressed ? 0.95 : hovered ? 1.08 : 1
  const btnStyle: CSSProperties = {
    position: 'relative',
    width: buttonSize,
    height: buttonSize,
    borderRadius: '50%',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: t.btnBg,
    color: t.btnText,
    boxShadow: `0 0 0 1.5px ${t.btnRing}`,
    zIndex: 9999,
    outline: 'none',
    flexShrink: 0,
    transform: `scale(${btnScale})`,
    transition: 'background 0.25s ease, color 0.25s ease, transform 0.14s ease, box-shadow 0.25s ease',
  }

  return (
    <>
      <div aria-hidden="true" style={curtainStyle} />
      <button
        style={btnStyle}
        onClick={toggle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => { setHovered(false); setPressed(false) }}
        onMouseDown={() => setPressed(true)}
        onMouseUp={() => setPressed(false)}
        aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
        aria-pressed={theme === 'dark'}
        title={theme === 'light' ? 'Dark mode' : 'Light mode'}
      >
        {theme === 'light' ? <MoonIcon /> : <SunIcon />}
      </button>
    </>
  )
}
