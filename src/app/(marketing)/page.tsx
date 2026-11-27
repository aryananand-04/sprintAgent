import type { Metadata } from 'next'
import { Check, GitPullRequest, ShieldCheck, ScrollText } from 'lucide-react'
import { ButtonLink, Container, Panel, Tag, TONE, type Tone } from '@/components/marketing/primitives'
import { ClayBell, ClayDial, ClayFunnel, ClayLedger, ClayQuestion, ClayStamp } from '@/components/marketing/clay'
import { TriageDemo } from '@/components/marketing/TriageDemo'
import { LoopTabs } from '@/components/marketing/LoopTabs'
import { AutonomyLicense } from '@/components/marketing/AutonomyLicense'
import { GithubIcon, SlackIcon } from '@/components/ui/brand-icons'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Sprint Agent: the sprint operator you can audit',
  description: 'Sprint Agent triages, assigns and rebalances the routine work in your sprint, and escalates the risky calls to people with the reasons written down.',
  openGraph: { title: 'Sprint Agent', description: 'Your sprint, run by an agent you can audit.', type: 'website' },
}

const DECISIONS: Array<{
  tone: Tone; tag: string; title: [string, string]; body: string; facts: string[]; art: React.ComponentType<{ className?: string }>
}> = [
  {
    tone: 'act', tag: 'Act', title: ['Clear work ships', 'without a meeting'], art: ClayStamp,
    body: 'When a request is well specified, low risk and has no outside blockers, the agent assigns it to the best-fit person who has room, and shows how confident it is.',
    facts: ['Assignment based on skills and current load', 'Every agent action can be undone', 'Your thresholds, not ours'],
  },
  {
    tone: 'ask', tag: 'Ask', title: ['Vague asks get', 'one sharp question'], art: ClayQuestion,
    body: "Low clarity doesn't turn into a guess. The agent writes the one question that unblocks the work and proposes acceptance criteria for the PM to approve.",
    facts: ['Specific question, not a form', 'Draft acceptance criteria', 'Approved criteria raise clarity'],
  },
  {
    tone: 'esc', tag: 'Escalate', title: ['Risky calls go to a human,', 'with the receipts'], art: ClayBell,
    body: 'Scope creep, outside sign-offs and high-risk changes go to the right person with the reason and a recommendation: in the app, or in Slack.',
    facts: ['Scope impact in story points', 'Capacity breaches flagged early', 'Nudges if nobody responds'],
  },
  {
    tone: 'agent', tag: 'Audit', title: ['Every decision,', 'on the record'], art: ClayLedger,
    body: 'An append-only log of what the agent decided, why, and who overrode it. Bring it to the retro, or to a compliance review.',
    facts: ['Rationale stored with each decision', 'Cannot be edited, even by admins', 'Role-based access enforced in the database'],
  },
]

const AUTONOMY_STEPS = [
  ['Shadow mode', 'For each kind of work, the agent first only predicts. People decide, and outcomes are recorded.'],
  ['Scored against reality', 'Its predictions are compared with what people chose and what actually happened.'],
  ['A license per task type', 'Observe → Suggest → Act with undo → Act. Promotion needs evidence, not a settings toggle.'],
  ['Automatic demotion', 'If accuracy drifts or an action causes trouble, the level drops by itself.'],
] as const

export default function LandingPage() {
  return (
    <>
      {/* Hero */}
      <Container className="grid gap-12 pb-20 pt-10 sm:pt-16 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-14 lg:pt-24">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-paper-2 px-3 py-1 text-xs font-medium text-ink-2 ring-1 ring-line-soft">
            <span className="h-1.5 w-1.5 rounded-full bg-act-accent" aria-hidden /> For teams that ship every week
          </p>
          <h1 className="display-xl mt-6 text-ink">
            Your sprint, run by an agent <span className="text-agent-accent">you can audit.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-2">
            Sprint Agent triages, assigns and rebalances the routine work in your sprint. The risky, vague and
            political calls go to a person, and every decision comes with its reasons.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <ButtonLink href="/login" size="lg" arrow>Start free</ButtonLink>
            <ButtonLink href="#how" size="lg" variant="lime" arrow>See how it works</ButtonLink>
          </div>
          <p className="mt-4 text-sm text-mute">Free for small teams. No credit card.</p>
        </div>
        <TriageDemo />
      </Container>

      {/* Facts strip (no fake logos) */}
      <Container>
        <div className="grid gap-px overflow-hidden rounded-3xl bg-line-soft ring-1 ring-line-soft sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: GitPullRequest, k: '3 decisions', v: 'Act, Ask or Escalate, and nothing in between' },
            { icon: ScrollText, k: 'Every decision logged', v: 'Append-only, with the reason attached' },
            { icon: ShieldCheck, k: 'Least privilege', v: 'Viewer, contributor, PM, admin, enforced in the database' },
          ].map(({ icon: Icon, k, v }) => (
            <div key={k} className="bg-paper p-5">
              <Icon size={18} className="text-mute" aria-hidden />
              <p className="mt-3 font-display text-lg font-semibold tracking-tight text-ink">{k}</p>
              <p className="mt-1 text-sm text-mute">{v}</p>
            </div>
          ))}
          <div className="bg-paper p-5">
            <div className="flex gap-2 text-ink" aria-hidden><GithubIcon size={18} /><SlackIcon size={18} /></div>
            <p className="mt-3 font-display text-lg font-semibold tracking-tight text-ink">Works where you work</p>
            <p className="mt-1 text-sm text-mute">GitHub and Slack today. Linear and Jira next.</p>
          </div>
        </div>
      </Container>

      {/* How it works */}
      <Container className="mt-24">
        <Panel id="how" className="scroll-mt-24 px-5 py-12 sm:px-10 sm:py-16 lg:px-14">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-end">
            <div>
              <Tag tone="agent">The loop</Tag>
              <h2 className="display-lg mt-6 text-ink">One loop, <span className="text-agent-accent">all sprint long</span></h2>
            </div>
            <ClayFunnel className="mx-auto h-auto w-full max-w-[380px] lg:ml-auto lg:mr-0" />
          </div>
          <div className="mt-10"><LoopTabs /></div>
        </Panel>
      </Container>

      {/* Decisions */}
      <Container className="mt-6 space-y-6" >
        <div id="decisions" className="scroll-mt-24" />
        {DECISIONS.map((d) => (
          <Panel key={d.tag} tone={d.tone} className="px-5 py-10 sm:px-10 sm:py-14 lg:px-14">
            <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
              <div>
                <Tag tone={d.tone}>{d.tag}</Tag>
                <h2 className={cn('display-lg mt-6', TONE[d.tone].ink)}>
                  {d.title[0]} <span className={TONE[d.tone].accent}>{d.title[1]}</span>
                </h2>
                <p className={cn('mt-5 max-w-lg text-lg leading-relaxed opacity-85', TONE[d.tone].ink)}>{d.body}</p>
                <ul className="mt-6 space-y-2.5">
                  {d.facts.map((f) => (
                    <li key={f} className={cn('flex items-center gap-2.5 text-[15px]', TONE[d.tone].ink)}>
                      <span className={cn('flex h-5 w-5 items-center justify-center rounded-full text-paper', TONE[d.tone].solid)}><Check size={12} strokeWidth={3} aria-hidden /></span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-[1.75rem] bg-gradient-to-b from-paper to-paper-3 p-6 sm:p-10">
                <d.art className="mx-auto h-auto w-full max-w-[420px]" />
              </div>
            </div>
          </Panel>
        ))}
      </Container>

      {/* Earned Autonomy */}
      <Container className="mt-6">
        <Panel id="autonomy" tone="agent" className="scroll-mt-24 px-5 py-12 sm:px-10 sm:py-16 lg:px-14">
          <div className="grid gap-12 lg:grid-cols-[1fr_0.9fr] lg:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <Tag tone="agent">Earned Autonomy</Tag>
                <span className="rounded-full bg-paper px-2.5 py-1 text-xs font-medium text-agent-accent ring-1 ring-agent-accent/20">Coming soon</span>
              </div>
              <h2 className="display-lg mt-6 text-agent-ink">Autonomy is earned, <span className="text-agent-accent">not configured</span></h2>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-agent-ink/85">
                Most AI tools ask you to choose how much to trust them. Sprint Agent works it out from evidence,
                one kind of work at a time, and can lose that trust as easily as it earned it.
              </p>
              <ol className="mt-8 grid gap-4 sm:grid-cols-2">
                {AUTONOMY_STEPS.map(([title, body], i) => (
                  <li key={title} className="rounded-2xl bg-paper/70 p-4 ring-1 ring-agent-accent/10">
                    <p className="font-mono text-xs text-agent-accent">0{i + 1}</p>
                    <p className="mt-1 font-semibold text-agent-ink">{title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-agent-ink/75">{body}</p>
                  </li>
                ))}
              </ol>
            </div>
            <div className="relative">
              <ClayDial level={2} className="mx-auto -mb-10 h-auto w-full max-w-[300px]" />
              <AutonomyLicense />
            </div>
          </div>
        </Panel>
      </Container>

      {/* Closing CTA */}
      <Container className="mt-24 text-center">
        <h2 className="display-lg mx-auto max-w-3xl text-ink">What should your agent handle <span className="text-act-accent">first?</span></h2>
        <p className="mx-auto mt-5 max-w-xl text-lg text-ink-2">Connect a repo, import your backlog and see where the agent lands on every item, before it changes anything.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/login" size="lg" arrow>Start free</ButtonLink>
          <ButtonLink href="/pricing" size="lg" variant="outline">See pricing</ButtonLink>
        </div>
      </Container>
    </>
  )
}
