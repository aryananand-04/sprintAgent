// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { cn } from '@/lib/utils'

const LEVELS = ['Observe', 'Suggest', 'Act + undo', 'Act'] as const

// Illustrative example of the license UI, not customer data.
const ROWS = [
  { type: 'Bugs with repro', level: 3, agree: 94, n: 61 },
  { type: 'Chores', level: 2, agree: 88, n: 34 },
  { type: 'Features', level: 1, agree: 71, n: 22 },
  { type: 'Spikes', level: 0, agree: 0, n: 4 },
]

export function AutonomyLicense() {
  return (
    <figure className="rounded-3xl bg-paper p-5 shadow-lift ring-1 ring-line-soft sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-mute">Autonomy license</p>
          <p className="mt-1 font-display text-xl font-semibold tracking-tight text-ink">Checkout team</p>
        </div>
        <span className="rounded-full bg-agent-tint px-2.5 py-1 text-[11px] font-medium text-agent-accent">Example</span>
      </div>
      <ul className="mt-5 space-y-4">
        {ROWS.map((r) => (
          <li key={r.type}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium text-ink">{r.type}</span>
              <span className="text-xs text-mute">
                {r.level > 0 ? `${r.agree}% agreement · ${r.n} decisions` : `shadow mode · ${r.n} decisions`}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-1" aria-hidden>
              {LEVELS.map((l, i) => (
                <span key={l} className={cn('h-2 rounded-full', i <= r.level ? (i === 3 ? 'bg-act-accent' : 'bg-agent-accent') : 'bg-line')} />
              ))}
            </div>
            <p className="mt-1 text-[11px] text-mute">L{r.level} · {LEVELS[r.level]}</p>
          </li>
        ))}
      </ul>
      <figcaption className="mt-5 border-t border-line-soft pt-4 text-xs leading-relaxed text-mute">
        Promotion needs enough decisions and a statistically safe agreement rate. If accuracy drifts, the level drops automatically.
      </figcaption>
    </figure>
  )
}
