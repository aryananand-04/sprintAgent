import type { Metadata } from 'next'
import { ButtonLink, Container, Panel, Tag, TONE, type Tone } from '@/components/marketing/primitives'
import { ClayBell, ClayDial, ClayFunnel, ClayLedger, ClayQuestion, ClayStamp } from '@/components/marketing/clay'
import { TriageDemo } from '@/components/marketing/TriageDemo'
import { LoopTabs } from '@/components/marketing/LoopTabs'
import { AutonomyLicense } from '@/components/marketing/AutonomyLicense'
import { Reveal, RiseWords } from '@/components/marketing/Reveal'
import { Scribble } from '@/components/marketing/Scribble'
import { HouseRules } from '@/components/marketing/HouseRules'
import { StandupCalculator } from '@/components/marketing/StandupCalculator'
import { AgentWeek } from '@/components/marketing/AgentWeek'
import { RepoTryForm } from '@/components/marketing/RepoTryForm'
import { EscalationArtifact, LogArtifact, QuestionArtifact, TicketArtifact } from '@/components/marketing/DecisionArtifacts'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Sprint Agent: the sprint admin, handled',
  description: 'An agent that triages, assigns and chases the routine sprint work, and hands the risky calls to a human with its reasoning attached.',
  openGraph: { title: 'Sprint Agent', description: 'Your sprint, run by an agent you can audit.', type: 'website' },
}

const DECISIONS: Array<{
  tone: Tone; tag: string; title: [string, string]; body: string
  artifact: React.ComponentType; art: React.ComponentType<{ className?: string }>
}> = [
  {
    tone: 'act', tag: 'Act', title: ['Clear work ships', 'without a meeting about it'], artifact: TicketArtifact, art: ClayStamp,
    body: 'Well specified, low risk, nothing blocking it? The agent gives it to the person with the right skills and actual room in their week, and says how sure it is. Wrong call? One click undoes it.',
  },
  {
    tone: 'ask', tag: 'Ask', title: ['Vague asks get', 'one good question'], artifact: QuestionArtifact, art: ClayQuestion,
    body: '“Make it pop” is not a requirement. Instead of guessing, the agent asks the single question that unblocks the work, then drafts acceptance criteria for the PM to approve.',
  },
  {
    tone: 'esc', tag: 'Escalate', title: ['Risky calls go to a human,', 'with the receipts'], artifact: EscalationArtifact, art: ClayBell,
    body: 'Scope creep dressed up as a “quick change”, legal sign-offs, anything near payments: it goes to the right person with the reason and a recommendation, then follows up politely until someone decides.',
  },
  {
    tone: 'agent', tag: 'Audit', title: ['Every decision,', 'on the record'], artifact: LogArtifact, art: ClayLedger,
    body: 'What it decided, why, and who overruled it, written to a log nobody can edit, admins included. Useful in a retro. More useful in an audit.',
  },
]

const AUTONOMY_STEPS = [
  ['It starts by watching', 'For each kind of work, the agent only predicts. Your team decides. Both get written down.'],
  ['It gets marked', 'Predictions are scored against what people chose and how things turned out. It does not grade itself.'],
  ['It earns a licence', 'Observe → Suggest → Act with undo → Act, per type of work. Bugs might graduate long before features do.'],
  ['It can lose it', 'If accuracy drifts or an action causes trouble, the level drops on its own.'],
] as const

export default function LandingPage() {
  return (
    <>
      {/* Hero */}
      <Container className="grid gap-12 pb-16 pt-12 sm:pt-20 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-16 lg:pt-28">
        <div>
          <RiseWords className="display-xl text-ink" text="Your sprint, run by an agent" accent="you can audit." />
          <p className="mt-7 max-w-xl text-lg leading-relaxed text-ink-2">
            It triages the backlog, assigns the obvious work, chases blockers and writes the status update nobody wanted
            to write. Anything risky, vague or political goes to a person, with its reasoning attached so you can check its homework.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <ButtonLink href="/login" size="lg" arrow>Start free</ButtonLink>
            <ButtonLink href="/try" size="lg" variant="outline">Try it on your repo</ButtonLink>
          </div>
          <p className="mt-4 text-sm text-mute">No credit card. No 40-field setup form. No call with sales.</p>
        </div>
        <div className="relative">
          <Scribble arrow="down-right" className="absolute -top-16 right-10 hidden items-end gap-1 xl:flex" arrowClassName="-mb-6 rotate-12">
            the VP one is based on a true story
          </Scribble>
          <Reveal delay={0.25}><TriageDemo /></Reveal>
        </div>
      </Container>

      {/* House rules (replaces the generic stats strip) */}
      <Container className="mt-12"><Reveal><HouseRules /></Reveal></Container>

      {/* The problem, quantified */}
      <Container className="mt-28">
        <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <Reveal>
            <h2 className="display-lg text-ink">Standups were meant to take 15 minutes. <span className="text-ask-accent">Yours didn’t.</span></h2>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-ink-2">
              Most sprint “process” is people telling each other things a computer already knows. The agent reads the
              activity and writes the update, and only pulls people in when a decision actually needs one.
            </p>
          </Reveal>
          <Reveal delay={0.1}><StandupCalculator /></Reveal>
        </div>
      </Container>

      {/* How it works */}
      <Container className="mt-28">
        <Reveal>
          <Panel id="how" className="scroll-mt-24 px-5 py-12 sm:px-10 sm:py-16 lg:px-14">
            <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-end">
              <div>
                <Tag tone="agent">The loop</Tag>
                <h2 className="display-lg mt-6 text-ink">One loop, <span className="text-agent-accent">all sprint long</span></h2>
                <p className="mt-4 max-w-md text-lg text-ink-2">Five steps, running quietly in the background. You only notice the ones that need you.</p>
              </div>
              <ClayFunnel className="mx-auto h-auto w-full max-w-[360px] animate-float lg:ml-auto lg:mr-0" />
            </div>
            <div className="mt-10"><LoopTabs /></div>
          </Panel>
        </Reveal>
      </Container>

      {/* A week in the feed */}
      <Container className="mt-28 grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <h2 className="display-lg text-ink">A week in the agent’s feed</h2>
          <p className="mt-3 font-hand text-xl text-mute -rotate-1">(lightly edited for drama)</p>
          <p className="mt-5 max-w-sm text-lg leading-relaxed text-ink-2">It writes like a colleague, not a dashboard: short, specific, and it says when it’s unsure.</p>
        </div>
        <AgentWeek />
      </Container>

      {/* Decisions: each shows the real artifact it produces, alternating sides */}
      <Container className="mt-28 space-y-6">
        <div id="decisions" className="scroll-mt-24" />
        {DECISIONS.map((d, idx) => (
          <Reveal key={d.tag}>
            <Panel tone={d.tone} className="group px-5 py-10 sm:px-10 sm:py-14 lg:px-14">
              <div className={cn('grid gap-10 lg:grid-cols-2 lg:items-center', idx % 2 === 1 && 'lg:[&>*:first-child]:order-2')}>
                <div>
                  <Tag tone={d.tone}>{d.tag}</Tag>
                  <h2 className={cn('display-lg mt-6', TONE[d.tone].ink)}>
                    {d.title[0]} <span className={TONE[d.tone].accent}>{d.title[1]}</span>
                  </h2>
                  <p className={cn('mt-5 max-w-lg text-lg leading-relaxed opacity-85', TONE[d.tone].ink)}>{d.body}</p>
                </div>
                <div className="relative flex min-h-[300px] items-center justify-center rounded-[1.75rem] bg-paper/60 p-6 sm:p-10">
                  <d.art className="pointer-events-none absolute -right-4 -top-6 h-auto w-36 opacity-90 animate-float sm:w-44" />
                  <div className="relative transition-transform duration-500 group-hover:-translate-y-1">
                    <d.artifact />
                  </div>
                </div>
              </div>
            </Panel>
          </Reveal>
        ))}
      </Container>

      {/* Earned Autonomy */}
      <Container className="mt-6">
        <Reveal>
          <Panel id="autonomy" tone="agent" className="scroll-mt-24 px-5 py-12 sm:px-10 sm:py-16 lg:px-14">
            <div className="grid gap-12 lg:grid-cols-[1fr_0.9fr] lg:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <Tag tone="agent">Earned Autonomy</Tag>
                  <span className="rounded-full bg-paper px-2.5 py-1 text-xs font-medium text-agent-accent ring-1 ring-agent-accent/20">Coming soon</span>
                </div>
                <h2 className="display-lg mt-6 text-agent-ink">Trust is earned, <span className="text-agent-accent">not toggled</span></h2>
                <p className="mt-5 max-w-lg text-lg leading-relaxed text-agent-ink/85">
                  Most AI tools ask how much you trust them on day one. That’s a strange thing to ask a stranger.
                  Sprint Agent starts by watching, gets scored against what your team actually did, and earns autonomy
                  one kind of work at a time.
                </p>
                <ol className="mt-8 divide-y divide-agent-accent/15 border-y border-agent-accent/15">
                  {AUTONOMY_STEPS.map(([title, body], i) => (
                    <li key={title} className="grid grid-cols-[2.5rem_1fr] gap-x-3 py-4">
                      <span className="font-display text-2xl font-semibold text-agent-accent">{i + 1}</span>
                      <div>
                        <p className="font-semibold text-agent-ink">{title}</p>
                        <p className="mt-1 text-[15px] leading-relaxed text-agent-ink/75">{body}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="relative">
                <ClayDial level={2} className="mx-auto -mb-10 h-auto w-full max-w-[280px] animate-float" />
                <AutonomyLicense />
              </div>
            </div>
          </Panel>
        </Reveal>
      </Container>

      {/* Closing: do something, don't just read */}
      <Container className="mt-28">
        <Reveal>
          <div className="grid gap-8 rounded-[2rem] bg-ink px-6 py-12 text-paper sm:rounded-panel sm:px-12 sm:py-16 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <div>
              <h2 className="display-lg">Point it at your backlog.</h2>
              <p className="mt-4 max-w-md text-lg text-paper/75">Paste a public GitHub repo and watch every open issue get a decision, a score and a reason. Ten seconds, no signup.</p>
            </div>
            <div className="[&_form>div]:bg-paper [&_form>div]:ring-0">
              <RepoTryForm compact />
              <p className="mt-4 text-sm text-paper/60">Prefer the full thing? <a href="/login" className="underline underline-offset-4 hover:text-paper">Start free</a>. First sprint runs in shadow mode.</p>
            </div>
          </div>
        </Reveal>
      </Container>
    </>
  )
}
