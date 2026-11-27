// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
'use client'

import { useId, useMemo, useState } from 'react'
import { standupCost } from '@/logic/standupCost'

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

function Slider({ label, value, min, max, step = 1, prefix = '', suffix, onChange }: {
  label: string; value: number; min: number; max: number; step?: number; prefix?: string; suffix: string; onChange: (v: number) => void
}) {
  const id = useId()
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm text-ink-2">{label}</label>
        <span className="font-mono text-sm text-ink">{prefix}{value}{suffix}</span>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-[var(--ink)]" />
    </div>
  )
}

export function StandupCalculator() {
  const [people, setPeople] = useState(8)
  const [minutes, setMinutes] = useState(20)
  const [hourly, setHourly] = useState(90)
  const [days, setDays] = useState(10)
  const r = useMemo(() => standupCost({ people, minutes, hourlyCost: hourly, daysPerSprint: days }), [people, minutes, hourly, days])

  return (
    <div className="grid gap-6 rounded-[1.75rem] bg-paper p-5 shadow-soft ring-1 ring-line-soft sm:p-7 md:grid-cols-[1fr_1.1fr]">
      <div className="space-y-5">
        <Slider label="People in the meeting" value={people} min={2} max={30} suffix="" onChange={setPeople} />
        <Slider label="Minutes it actually takes" value={minutes} min={5} max={60} suffix=" min" onChange={setMinutes} />
        <Slider label="Loaded cost per hour" value={hourly} min={30} max={250} step={5} prefix="$" suffix="" onChange={setHourly} />
        <Slider label="Standups per sprint" value={days} min={5} max={15} suffix="" onChange={setDays} />
        <p className="text-xs text-mute">Includes about 10 minutes per person to get back into focus afterwards, which is a conservative estimate.</p>
      </div>
      <div className="flex flex-col justify-between rounded-2xl bg-ask-tint p-5 text-ask-ink" aria-live="polite">
        <div>
          <p className="text-sm">Your standup costs about</p>
          <p className="mt-1 font-display text-5xl font-semibold tracking-tight">{money.format(r.costPerYear)}</p>
          <p className="text-sm">a year, or <strong>{r.engineerDaysPerYear} engineer-days</strong>.</p>
        </div>
        <p className="mt-6 font-hand text-xl leading-snug">{r.verdict}</p>
      </div>
    </div>
  )
}
