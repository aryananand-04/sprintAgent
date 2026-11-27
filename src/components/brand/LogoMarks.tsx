/* Logo candidates derived from Tally (© Akchhya Singh & Aryan Anand). One will become <Logo />. */
const INK = '#1b1b1b', SUN = '#ffc928', SLATE = '#17202a', AMBER = '#ffb000'

/** V1 Badge: Tally's face on a sticker-style badge. */
export function MarkBadge({ size = 40 }: { size?: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <rect x="3" y="7" width="42" height="38" rx="10" fill={SUN} stroke={INK} strokeWidth="3" />
      <rect x="16" y="2" width="16" height="9" rx="3" fill={INK} />
      <ellipse cx="18" cy="23" rx="4" ry="5" fill="#fff" stroke={INK} strokeWidth="2" />
      <ellipse cx="30" cy="23" rx="4" ry="5" fill="#fff" stroke={INK} strokeWidth="2" />
      <circle cx="19" cy="24.5" r="2" fill={INK} /><circle cx="31" cy="24.5" r="2" fill={INK} />
      <path d="M17 33 Q 24 39 31 33" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  )
}

/** V2 Tally marks: the clipboard carrying a tally (IIII crossed), a pun on the name. */
export function MarkTally({ size = 40 }: { size?: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <rect x="7" y="7" width="34" height="38" rx="7" fill={SUN} stroke={INK} strokeWidth="3" />
      <rect x="16" y="2" width="16" height="9" rx="3" fill={INK} />
      <g stroke={INK} strokeWidth="3" strokeLinecap="round">
        <path d="M15 19 V 35" /><path d="M21 19 V 35" /><path d="M27 19 V 35" /><path d="M33 19 V 35" /><path d="M12 32 L 36 22" />
      </g>
    </svg>
  )
}

/** V3 Peek: Tally's eyes peeking over a split-flap tile (bridges the brand and the app). */
export function MarkPeek({ size = 40 }: { size?: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <ellipse cx="18" cy="14" rx="5" ry="6" fill="#fff" stroke={INK} strokeWidth="2.5" />
      <ellipse cx="30" cy="14" rx="5" ry="6" fill="#fff" stroke={INK} strokeWidth="2.5" />
      <circle cx="19" cy="15.5" r="2.4" fill={INK} /><circle cx="31" cy="15.5" r="2.4" fill={INK} />
      <rect x="4" y="18" width="40" height="27" rx="6" fill={SLATE} stroke={INK} strokeWidth="3" />
      <path d="M4 31.5 H 44" stroke="#000" strokeWidth="1.5" opacity="0.6" />
      <text x="24" y="38.5" textAnchor="middle" fontSize="17" fontWeight="700" fill={AMBER} fontFamily="var(--font-flap), monospace">S</text>
    </svg>
  )
}

export function Wordmark({ className }: { className?: string }) {
  return <span className={className} style={{ fontFamily: 'var(--font-toon), system-ui', letterSpacing: '0.01em' }}>sprint agent</span>
}
