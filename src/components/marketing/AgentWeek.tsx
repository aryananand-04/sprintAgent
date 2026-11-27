// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { Reveal } from './Reveal'
import { cn } from '@/lib/utils'

type Kind = 'act' | 'ask' | 'esc' | 'agent'
const KIND: Record<Kind, { label: string; cls: string }> = {
  act: { label: 'Act', cls: 'bg-act-tint text-act-accent' },
  ask: { label: 'Ask', cls: 'bg-ask-tint text-ask-accent' },
  esc: { label: 'Escalate', cls: 'bg-esc-tint text-esc-accent' },
  agent: { label: 'Agent', cls: 'bg-agent-tint text-agent-accent' },
}

const WEEK: Array<{ day: string; items: Array<{ t: string; k: Kind; text: string }> }> = [
  { day: 'Monday', items: [
    { t: '09:02', k: 'agent', text: 'Sprint 24 started. 31 items in the backlog; 9 were the same bug wearing different titles. Merged them.' },
    { t: '09:14', k: 'act', text: 'Assigned “Promo code crash on iOS” to Arjun. Clear repro, his code, 40% load. Confidence 91%.' },
    { t: '11:40', k: 'ask', text: 'Asked Priya which screen “make checkout premium” is about: cart, payment or confirmation. One question, zero meetings.' },
  ] },
  { day: 'Tuesday', items: [
    { t: '10:05', k: 'esc', text: 'Escalated “loyalty points in checkout” to the PM. Described as a quick change. Estimated at 8 days; touches payments.' },
  ] },
  { day: 'Wednesday', items: [
    { t: '15:30', k: 'agent', text: 'Dev hit 98% load. Moved two small tasks to Mei, who has room this week.' },
  ] },
  { day: 'Thursday', items: [
    { t: '09:00', k: 'agent', text: 'Wrote the standup so nobody had to: 2 blocked, 1 waiting on review, 6% behind pace. Reading time: 40 seconds.' },
    { t: '16:12', k: 'act', text: 'Sam undid my reassignment of the analytics ticket. Fair. Lowering my confidence on analytics work a notch.' },
  ] },
  { day: 'Friday', items: [
    { t: '17:45', k: 'agent', text: 'Sprint is 82% done. I’d love to take credit, but the team did the work. I did the paperwork.' },
  ] },
]

export function AgentWeek() {
  return (
    <ol className="relative space-y-10 border-l border-line pl-6 sm:pl-10">
      {WEEK.map((d) => (
        <li key={d.day}>
          <p className="sticky top-20 -ml-[31px] inline-flex items-center gap-3 bg-paper pr-3 text-sm font-semibold text-ink sm:-ml-[47px]">
            <span className="h-3 w-3 rounded-full bg-ink ring-4 ring-paper" aria-hidden />{d.day}
          </p>
          <ul className="mt-4 space-y-3">
            {d.items.map((it) => (
              <li key={it.t}>
                <Reveal className="flex flex-col gap-2 rounded-2xl bg-paper-2 p-4 sm:flex-row sm:items-start sm:gap-4">
                  <span className="font-mono text-xs text-mute sm:w-12 sm:pt-0.5">{it.t}</span>
                  <span className={cn('self-start rounded-full px-2.5 py-0.5 text-[11px] font-semibold', KIND[it.k].cls)}>{KIND[it.k].label}</span>
                  <p className="text-[15px] leading-relaxed text-ink">{it.text}</p>
                </Reveal>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  )
}
