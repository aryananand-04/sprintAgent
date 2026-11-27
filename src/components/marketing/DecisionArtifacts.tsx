// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import { cn } from '@/lib/utils'

/* Small, real-looking product artifacts: each decision shown as the thing it actually produces. */

function Avatar({ initials, className }: { initials: string; className?: string }) {
  return (
    <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold', className)}>{initials}</span>
  )
}

/** ACT: a ticket the agent just assigned. */
export function TicketArtifact() {
  return (
    <div className="w-full max-w-sm rotate-[-1.5deg] rounded-2xl bg-paper p-4 shadow-lift ring-1 ring-line-soft">
      <div className="flex items-center justify-between text-xs text-mute">
        <span className="font-mono">CHK-4421</span>
        <span className="rounded-full bg-act-tint px-2 py-0.5 font-semibold text-act-accent">Act · 84</span>
      </div>
      <p className="mt-2 text-[15px] font-medium leading-snug text-ink">Promo code crashes checkout on iOS 17</p>
      <div className="mt-4 flex items-center gap-2.5 rounded-xl bg-paper-2 p-2.5">
        <Avatar initials="AN" className="bg-act-pop text-[#141311]" />
        <div className="min-w-0 flex-1 text-xs leading-relaxed">
          <p className="text-ink">Assigned to <strong>Arjun</strong></p>
          <p className="text-mute">Wrote the promo service · 40% load · 91% fit</p>
        </div>
        <span className="rounded-lg bg-paper px-2 py-1 text-[11px] font-medium text-ink-2 ring-1 ring-line">Undo</span>
      </div>
    </div>
  )
}

/** ASK: the one question, and the human's answer. */
export function QuestionArtifact() {
  return (
    <div className="w-full max-w-sm space-y-3">
      <div className="rounded-2xl rounded-bl-md bg-paper p-4 text-[14px] leading-relaxed text-ink shadow-soft ring-1 ring-line-soft">
        <p className="text-xs font-semibold text-ask-accent">Agent → Priya</p>
        <p className="mt-1">“Make checkout feel premium”: which screen bothers you most, cart, payment or confirmation? One example is plenty.</p>
      </div>
      <div className="ml-10 rounded-2xl rounded-br-md bg-ink p-4 text-[14px] leading-relaxed text-paper">
        <p className="text-xs font-semibold opacity-70">Priya</p>
        <p className="mt-1">the cart. it feels cramped on mobile</p>
      </div>
      <p className="pl-1 text-xs text-mute">Clarity 2 → 4. Drafted 3 acceptance criteria for review.</p>
    </div>
  )
}

/** ESCALATE: a message in Slack-ish form with real choices. */
export function EscalationArtifact() {
  return (
    <div className="w-full max-w-sm rounded-2xl bg-paper p-4 shadow-lift ring-1 ring-line-soft">
      <div className="flex items-center gap-2 text-xs text-mute">
        <span className="font-mono">#checkout-team</span><span>·</span><span>10:05</span>
      </div>
      <p className="mt-2 text-[14px] leading-relaxed text-ink">
        <strong>@pm</strong> “Quick” loyalty points in checkout: about <strong>8 days</strong>, touches payments and accounts.
        Sprint has 3 points of slack.
      </p>
      <p className="mt-2 rounded-xl bg-esc-tint px-3 py-2 text-[13px] text-esc-ink">Recommend: next sprint, with a scoping call first.</p>
      <div className="mt-3 flex flex-wrap gap-2 text-[12px] font-medium">
        {['Defer to S25', 'Swap something out', 'Let’s talk'].map((b, i) => (
          <span key={b} className={cn('rounded-lg px-2.5 py-1.5', i === 0 ? 'bg-ink text-paper' : 'bg-paper-2 text-ink-2 ring-1 ring-line')}>{b}</span>
        ))}
      </div>
    </div>
  )
}

/** AUDIT: append-only log lines. */
export function LogArtifact() {
  const rows = [
    ['09:14', 'ACT', 'assign CHK-4421 → arjun', 'rules', 'a91f'],
    ['11:40', 'ASK', 'question → priya', 'ai', '3c07'],
    ['10:05', 'ESC', 'scope +8 pts → pm', 'rules', 'e512'],
    ['16:12', 'UNDO', 'sam reverted assign', 'human', '7bd2'],
  ]
  return (
    <div className="w-full max-w-md overflow-hidden rounded-2xl bg-[#141311] p-4 font-mono text-[12px] leading-6 text-[#e9e6df] shadow-lift">
      <p className="mb-2 text-[#8f8a80]">decisions.log · append-only</p>
      {rows.map(([t, d, what, src, h]) => (
        <p key={h} className="flex gap-3 whitespace-nowrap">
          <span className="text-[#8f8a80]">{t}</span>
          <span className={cn('w-10', d === 'ACT' ? 'text-[#d7ea3a]' : d === 'ASK' ? 'text-[#ffae5c]' : d === 'ESC' ? 'text-[#ff8a76]' : 'text-[#5fd3c2]')}>{d}</span>
          <span className="min-w-0 flex-1 truncate">{what}</span>
          <span className="hidden text-[#8f8a80] sm:inline">{src}</span>
          <span className="text-[#8f8a80]">#{h}</span>
        </p>
      ))}
    </div>
  )
}
