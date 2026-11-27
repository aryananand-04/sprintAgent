// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { useId } from 'react'

/**
 * Hand-built "clay" objects: soft, matte, toy-like shapes made from layered radial gradients.
 * Pure SVG (no assets), scales crisply, themable, and decorative (aria-hidden).
 */

type Props = { className?: string }

function useIds(...names: string[]) {
  const base = useId().replace(/:/g, '')
  return Object.fromEntries(names.map((n) => [n, `${base}-${n}`])) as Record<string, string>
}

/** Matte clay fill: highlight top-left, body, deep shade bottom-right. */
function Clay({ id, light, base, dark }: { id: string; light: string; base: string; dark: string }) {
  return (
    <radialGradient id={id} cx="0.32" cy="0.28" r="0.85">
      <stop offset="0" stopColor={light} />
      <stop offset="0.45" stopColor={base} />
      <stop offset="1" stopColor={dark} />
    </radialGradient>
  )
}

function Ground({ id, cx = 200, cy = 286, rx = 120 }: { id: string; cx?: number; cy?: number; rx?: number }) {
  return (
    <>
      <defs>
        <radialGradient id={id}>
          <stop offset="0" stopColor="#000" stopOpacity="0.22" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx={cx} cy={cy} rx={rx} ry={rx * 0.16} fill={`url(#${id})`} />
    </>
  )
}

/** Triage machine: a funnel sorting coloured balls into three cups. */
export function ClayFunnel({ className }: Props) {
  const g = useIds('shadow', 'funnel', 'rim', 'act', 'ask', 'esc', 'cup', 'stem')
  return (
    <svg viewBox="0 0 400 320" className={className} aria-hidden="true">
      <defs>
        <Clay id={g.funnel} light="#fffaf0" base="#efe6d6" dark="#c9bba3" />
        <Clay id={g.rim} light="#ffffff" base="#f5eee2" dark="#d8cbb6" />
        <Clay id={g.act} light="#f4ff9e" base="#c9de2c" dark="#7f9200" />
        <Clay id={g.ask} light="#ffd39e" base="#ff9a3c" dark="#c25d00" />
        <Clay id={g.esc} light="#ffb7ab" base="#ff6b57" dark="#b8301d" />
        <Clay id={g.cup} light="#9be8dc" base="#2bb3a3" dark="#0b6e64" />
        <linearGradient id={g.stem} x1="0" x2="1">
          <stop offset="0" stopColor="#d8cbb6" /><stop offset="0.5" stopColor="#f5eee2" /><stop offset="1" stopColor="#c9bba3" />
        </linearGradient>
      </defs>
      <Ground id={g.shadow} rx={150} />
      {/* balls waiting in the funnel */}
      <g className="clay-part animate-bob">
        <circle cx="168" cy="52" r="15" fill={`url(#${g.ask})`} />
        <circle cx="200" cy="44" r="16" fill={`url(#${g.esc})`} />
        <circle cx="232" cy="54" r="14" fill={`url(#${g.act})`} />
      </g>
      <circle cx="186" cy="70" r="13" fill={`url(#${g.act})`} />
      <circle cx="217" cy="72" r="12" fill={`url(#${g.ask})`} />
      {/* funnel */}
      <path d="M120 78 Q200 104 280 78 L218 150 L218 176 L182 176 L182 150 Z" fill={`url(#${g.funnel})`} />
      <ellipse cx="200" cy="78" rx="80" ry="16" fill={`url(#${g.rim})`} />
      <ellipse cx="200" cy="79" rx="70" ry="11" fill="#bfae94" opacity="0.55" />
      <circle cx="200" cy="170" r="9" fill={`url(#${g.act})`} className="clay-part animate-drop" />
      <rect x="194" y="176" width="12" height="44" rx="6" fill={`url(#${g.stem})`} />
      {/* sorted cups */}
      {[{ x: 110, f: g.act }, { x: 200, f: g.ask }, { x: 290, f: g.esc }].map(({ x, f }) => (
        <g key={x}>
          <path d={`M${x - 34} 232 Q${x - 30} 282 ${x} 282 Q${x + 30} 282 ${x + 34} 232 Z`} fill={`url(#${g.cup})`} />
          <ellipse cx={x} cy="232" rx="34" ry="9" fill="#0b6e64" opacity="0.55" />
          <circle cx={x} cy="228" r="12" fill={`url(#${f})`} />
        </g>
      ))}
      <path d="M200 222 Q160 222 120 226" stroke="#c9bba3" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M200 222 Q240 222 280 226" stroke="#c9bba3" strokeWidth="5" fill="none" strokeLinecap="round" />
    </svg>
  )
}

/** ACT: an "approved" stamp pressing a ticket. */
export function ClayStamp({ className }: Props) {
  const g = useIds('shadow', 'handle', 'body', 'paper', 'ink')
  return (
    <svg viewBox="0 0 400 320" className={className} aria-hidden="true">
      <defs>
        <Clay id={g.handle} light="#f4ff9e" base="#c9de2c" dark="#7f9200" />
        <Clay id={g.body} light="#fffaf0" base="#efe6d6" dark="#c9bba3" />
        <Clay id={g.paper} light="#ffffff" base="#faf6ee" dark="#e2d8c6" />
        <Clay id={g.ink} light="#c7e05a" base="#6b7f00" dark="#3d4a00" />
      </defs>
      <Ground id={g.shadow} rx={140} />
      <path d="M90 250 L300 220 L326 268 L112 292 Z" fill={`url(#${g.paper})`} />
      <rect x="150" y="258" width="70" height="7" rx="3.5" transform="rotate(-8 185 261)" fill="#e2d8c6" />
      <ellipse cx="226" cy="246" rx="34" ry="10" fill={`url(#${g.ink})`} opacity="0.9" />
      <path d="M212 246 l9 8 l18 -16" stroke="#f6f9dc" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="190" y="150" width="72" height="58" rx="14" fill={`url(#${g.body})`} />
      <ellipse cx="226" cy="150" rx="36" ry="9" fill="#fffaf0" />
      <rect x="216" y="92" width="20" height="62" rx="10" fill={`url(#${g.body})`} />
      <circle cx="226" cy="76" r="30" fill={`url(#${g.handle})`} />
    </svg>
  )
}

/** ASK: a speech bubble with a question mark. */
export function ClayQuestion({ className }: Props) {
  const g = useIds('shadow', 'bubble', 'mark', 'dot')
  return (
    <svg viewBox="0 0 400 320" className={className} aria-hidden="true">
      <defs>
        <Clay id={g.bubble} light="#ffe1bd" base="#ff9a3c" dark="#c25d00" />
        <Clay id={g.mark} light="#ffffff" base="#fff4e6" dark="#e7cdb0" />
      </defs>
      <Ground id={g.shadow} rx={110} />
      <path d="M110 70 Q110 40 140 40 L262 40 Q292 40 292 70 L292 176 Q292 206 262 206 L188 206 L140 254 L150 206 L140 206 Q110 206 110 176 Z" fill={`url(#${g.bubble})`} />
      <path d="M170 104 Q172 74 201 74 Q232 74 232 102 Q232 120 212 128 Q202 133 202 146 L202 152" stroke={`url(#${g.mark})`} strokeWidth="18" fill="none" strokeLinecap="round" />
      <circle cx="202" cy="180" r="11" fill={`url(#${g.mark})`} />
    </svg>
  )
}

/** ESCALATE: a service bell. */
export function ClayBell({ className }: Props) {
  const g = useIds('shadow', 'dome', 'base', 'knob')
  return (
    <svg viewBox="0 0 400 320" className={className} aria-hidden="true">
      <defs>
        <Clay id={g.dome} light="#ffc9bf" base="#ff6b57" dark="#b8301d" />
        <Clay id={g.base} light="#fffaf0" base="#efe6d6" dark="#c9bba3" />
        <Clay id={g.knob} light="#ffe1bd" base="#ff9a3c" dark="#c25d00" />
      </defs>
      <Ground id={g.shadow} rx={140} />
      <rect x="86" y="236" width="228" height="34" rx="17" fill={`url(#${g.base})`} />
      <path d="M110 236 Q110 128 200 120 Q290 128 290 236 Z" fill={`url(#${g.dome})`} />
      <path d="M140 200 Q150 152 196 142" stroke="#ffd5cc" strokeWidth="10" fill="none" strokeLinecap="round" opacity="0.7" />
      <rect x="192" y="96" width="16" height="30" rx="8" fill={`url(#${g.base})`} />
      <circle cx="200" cy="90" r="16" fill={`url(#${g.knob})`} />
      {[[-62, 70], [62, 70], [-80, 112], [80, 112]].map(([dx, y], i) => (
        <path key={i} d={`M${200 + dx} ${y} l${dx > 0 ? 14 : -14} -10`} stroke="#ff6b57" strokeWidth="6" strokeLinecap="round" />
      ))}
    </svg>
  )
}

/** AUDIT: an open ledger with a bookmark. */
export function ClayLedger({ className }: Props) {
  const g = useIds('shadow', 'cover', 'page', 'mark')
  return (
    <svg viewBox="0 0 400 320" className={className} aria-hidden="true">
      <defs>
        <Clay id={g.cover} light="#9be8dc" base="#2bb3a3" dark="#0b6e64" />
        <Clay id={g.page} light="#ffffff" base="#faf6ee" dark="#e2d8c6" />
        <Clay id={g.mark} light="#ffb7ab" base="#ff6b57" dark="#b8301d" />
      </defs>
      <Ground id={g.shadow} rx={150} />
      <path d="M60 230 Q200 200 340 230 L340 262 Q200 236 60 262 Z" fill={`url(#${g.cover})`} />
      <path d="M72 226 Q140 196 198 220 L198 100 Q140 78 72 104 Z" fill={`url(#${g.page})`} />
      <path d="M328 226 Q260 196 202 220 L202 100 Q260 78 328 104 Z" fill={`url(#${g.page})`} />
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i}>
          <path d={`M92 ${124 + i * 18} Q140 ${108 + i * 18} 182 ${122 + i * 18}`} stroke="#d9cfbd" strokeWidth="5" strokeLinecap="round" fill="none" />
          <path d={`M218 ${122 + i * 18} Q260 ${108 + i * 18} ${i % 2 ? 290 : 308} ${124 + i * 18}`} stroke="#d9cfbd" strokeWidth="5" strokeLinecap="round" fill="none" />
        </g>
      ))}
      <path d="M262 94 L262 150 L274 138 L286 150 L286 90" fill={`url(#${g.mark})`} />
    </svg>
  )
}

/** Earned Autonomy: a dial with four detents (L0–L3). */
export function ClayDial({ className, level = 2 }: Props & { level?: 0 | 1 | 2 | 3 }) {
  const g = useIds('shadow', 'plate', 'knob', 'tick')
  const angle = -120 + level * 80
  return (
    <svg viewBox="0 0 400 320" className={className} aria-hidden="true">
      <defs>
        <Clay id={g.plate} light="#fffaf0" base="#efe6d6" dark="#c9bba3" />
        <Clay id={g.knob} light="#9be8dc" base="#2bb3a3" dark="#0b6e64" />
        <Clay id={g.tick} light="#f4ff9e" base="#c9de2c" dark="#7f9200" />
      </defs>
      <Ground id={g.shadow} rx={130} />
      <ellipse cx="200" cy="250" rx="130" ry="30" fill={`url(#${g.plate})`} />
      <circle cx="200" cy="160" r="104" fill={`url(#${g.plate})`} />
      {[0, 1, 2, 3].map((i) => {
        const a = ((-120 + i * 80) * Math.PI) / 180
        return <circle key={i} cx={200 + Math.sin(a) * 84} cy={160 - Math.cos(a) * 84} r={i <= level ? 9 : 6}
          fill={i <= level ? `url(#${g.tick})` : '#d8cbb6'} />
      })}
      <g transform={`rotate(${angle} 200 160)`}>
        <circle cx="200" cy="160" r="56" fill={`url(#${g.knob})`} />
        <rect x="195" y="108" width="10" height="34" rx="5" fill="#e4f3ef" />
      </g>
    </svg>
  )
}
