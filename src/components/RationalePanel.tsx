import React from 'react'
import { motion } from 'framer-motion'
import { BookOpen, Zap, HelpCircle, AlertTriangle, ArrowRight, Cpu, Target, Layers } from 'lucide-react'

const H = (text: string) => <strong style={{ color: 'var(--t1)', fontWeight: 700 }}>{text}</strong>
const N = (text: string) => <strong style={{ color: 'var(--act-t)', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>{text}</strong>
const E = (text: string) => <strong style={{ color: 'var(--crit)', fontWeight: 700 }}>{text}</strong>

const WRITEUP_PARAGRAPHS: { heading?: string; jsx: React.ReactNode }[] = [
  {
    jsx: <>Sprint management fails at the same point every time: a PM who becomes the bottleneck for work that doesn't need human judgment. A task with clear requirements, manageable risk, and a skill-matched engineer at {N('40% load')} doesn't need a PM to assign it. The agent should.</>,
  },
  {
    heading: 'ACT / ASK / ESCALATE — computed on every task',
    jsx: <>{H('ACT')} fires when clarity meets the configured threshold (default {N('3/5')}), risk is below the ceiling, no unresolvable external dependencies exist, and a skill-matched engineer has load below {N('80%')}. The agent assigns, logs its reasoning in first-person to the live feed, and moves on. No confirmation, no notification unless someone checks.</>,
  },
  {
    jsx: <>{H('ASK')} fires when the agent has enough context to know exactly what it's missing. It generates {H('one specific blocking question')} the PM can answer in a single sentence — not a vague clarification request. <em style={{ color: 'var(--t2)' }}>"The PRD says no discount stacking. The VP Growth Slack thread implies unlimited stacking. Which is authoritative?"</em> Once answered, the agent re-triages and resumes. This tier exists because some tasks look clean on every measurable dimension but carry one ambiguity that makes autonomous action genuinely risky.</>,
  },
  {
    jsx: <>{H('ESCALATE')} fires on hard authority boundaries: clarity of {E('1/5')}, risk {E('≥ 5')} combined with effort {E('≥ 4')}, unresolvable external dependencies, or scope-breaking requests. The agent posts a specific reason, a recommended action, and stops. It doesn't attempt a partial solution. Human judgment required means exactly that.</>,
  },
  {
    jsx: <>Thresholds aren't fixed. The agent tracks its own ACT accuracy — correct completions versus total ACT decisions made. Below {N('60% accuracy')} over {N('5')} decisions, it raises its clarity floor autonomously and posts to the feed explaining why. Above {N('90%')} over {N('10')} decisions, it lowers the floor and becomes more autonomous. The PM can override at any point.</>,
  },
  {
    heading: 'Ad-hoc mid-sprint requests',
    jsx: <>Ad-hoc requests follow the same triage with one prior check: sprint buffer. If uncommitted capacity exists and the task is under {N('50%')} of that buffer, it {H('absorbs')}. If there's no room, it finds the lowest-scored backlog item, executes a {H('swap')}, and notifies the PM. If the request is scope-breaking, it {H('escalates')} immediately. The agent always returns a resolution path — it never silently refuses.</>,
  },
  {
    heading: 'Communication',
    jsx: <>The feed logs every decision with full reasoning — {H('pull, not push')}. Escalations break this rule intentionally: they fire to Slack immediately because they represent a blocked decision that needs a human to unblock the sprint. {H('Three AI-generated briefings')} (Team, PM, Manager) surface the same live sprint data framed differently for each audience.</>,
  },
  {
    jsx: <>The hardest trade-off was autonomy versus reliability. A higher ACT threshold means more PM involvement but fewer errors. A lower threshold means more throughput but more corrections. The right answer depends on team maturity and sprint risk tolerance — so it's {H('configurable and self-tuning')} rather than a product default.</>,
  },
]

const SECTIONS = [
  {
    id: 'writeup', icon: BookOpen, iconColor: 'var(--act)', title: 'Write-up: Autonomy & Escalation Framework',
    content: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {WRITEUP_PARAGRAPHS.map((p, i) => (
          <div key={i}>
            {p.heading && (
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)', marginBottom: 5, letterSpacing: '-0.01em' }}>{p.heading}</div>
            )}
            <p style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.75 }}>{p.jsx}</p>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: 'thesis', icon: Target, iconColor: 'var(--act)', title: 'Product Thesis',
    content: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.7 }}>
          Most PM tooling optimizes for <strong style={{ color: 'var(--t1)', fontWeight: 600 }}>visibility</strong> (dashboards) or{' '}
          <strong style={{ color: 'var(--t1)', fontWeight: 600 }}>flexibility</strong> (endless configuration). Neither solves the actual bottleneck in sprint execution: the daily judgment tax.
        </p>
        <p style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.7 }}>
          Sprint execution is 20% strategy and <strong style={{ color: 'var(--t1)', fontWeight: 600 }}>80% operational grind</strong>: who owns what, is this blocked, what does this vague request mean, who's overloaded. That 80% is boring, repetitive, and systematizable. But it currently falls on PMs and tech leads who have better things to do.
        </p>
        <p style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.7 }}>
          Sprint Agent flips the default: <strong style={{ color: 'var(--act-t)', fontWeight: 600 }}>the agent owns the operational middle</strong>, and escalates only when ambiguity or risk makes human judgment genuinely cheaper than autonomous action.
        </p>
        <div style={{ padding: '11px 14px', borderRadius: 5, background: 'var(--act-bg)', border: '1px solid var(--act-bd)', borderLeft: '3px solid var(--act)', marginTop: 4 }}>
          <p style={{ fontSize: 11, color: 'var(--t2)', lineHeight: 1.65, fontStyle: 'italic' }}>
            "This is not AI-assisted PM. It's a different mental model: the agent is a coworker with a defined charter, not a feature bolted onto a task manager."
          </p>
        </div>
      </div>
    ),
  },
  {
    id: 'framework', icon: Layers, iconColor: 'var(--t2)', title: 'Autonomy vs. Escalation Framework',
    content: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p style={{ fontSize: 12, color: 'var(--t3)', lineHeight: 1.65 }}>Every task gets exactly one verdict. The threshold between states is the core product decision.</p>
        {[
          {
            d: 'ACT', icon: Zap, color: 'var(--act)', textColor: 'var(--act-t)', bg: 'var(--act-bg)', bd: 'var(--act-bd)',
            when: 'Clarity ≥ 4, risk ≤ 3, known skill domain, reversible outcome',
            why: 'The cost of a wrong assignment for a clear task is low. Re-assignment is cheap. Waiting for human approval costs more than occasional misassignment.',
            examples: ['Bug with Sentry stacktrace', 'Feature with approved Figma spec', 'Standard QA task'],
          },
          {
            d: 'ASK', icon: HelpCircle, color: 'var(--ask)', textColor: 'var(--ask-t)', bg: 'var(--ask-bg)', bd: 'var(--ask-bd)',
            when: 'Clarity ≤ 2, high effort + incomplete requirements, or load would exceed 90%',
            why: 'A 30-minute clarification call is 5× cheaper than 3 days of misaligned work. The agent asks before acting, not after.',
            examples: ['Feature with no definition of done', 'High-effort task with vague scope', 'Capacity conflict'],
          },
          {
            d: 'ESCALATE', icon: AlertTriangle, color: 'var(--crit)', textColor: 'var(--esc-t)', bg: 'var(--esc-bg)', bd: 'var(--esc-bd)',
            when: 'Clarity = 1, risk × effort ≥ critical threshold, external dependency, scope-breaking mid-sprint',
            why: 'Some decisions have irreversible consequences or require authority the agent doesn\'t have. The agent is opinionated about what it cannot safely own.',
            examples: ['Auth compliance redesign', 'Apple Pay scope mid-sprint', 'Legal sign-off required'],
          },
        ].map(({ d, icon: Icon, color, textColor, bg, bd, when, why, examples }) => (
          <div key={d} style={{ borderRadius: 5, border: `1px solid ${bd}`, background: bg, padding: '12px 13px', borderLeft: `3px solid ${color}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
              <Icon size={12} style={{ color }} />
              <span style={{ fontSize: 13, fontWeight: 800, color: textColor, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.02em' }}>{d}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11 }}>
              <div><span style={{ color: 'var(--t3)', fontWeight: 600 }}>When: </span><span style={{ color: 'var(--t2)' }}>{when}</span></div>
              <div><span style={{ color: 'var(--t3)', fontWeight: 600 }}>Why: </span><span style={{ color: 'var(--t2)' }}>{why}</span></div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
                {examples.map(ex => <span key={ex} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 3, background: 'var(--card)', border: '1px solid var(--b2)', color: 'var(--t3)' }}>{ex}</span>)}
              </div>
            </div>
          </div>
        ))}
        <p style={{ fontSize: 11, color: 'var(--t3)', fontStyle: 'italic' }}>
          The key insight: an agent that escalates too often is useless. An agent that never escalates is dangerous. The right boundary: "would a reasonable senior engineer proceed confidently, or ask someone first?"
        </p>
      </div>
    ),
  },
  {
    id: 'tradeoffs', icon: ArrowRight, iconColor: 'var(--warn)', title: 'Key Trade-offs',
    content: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[
          { title: 'Deterministic rules vs. LLM reasoning', body: 'This prototype uses a scoring formula and rule tree instead of live LLM calls for all decisions. This makes the system testable, predictable, and explainable — properties that matter for trust-building. In production, the right architecture is hybrid: deterministic rules for clearly-bounded cases, LLM reasoning for ambiguous middle-ground.' },
          { title: 'Frontend-first vs. full agent backend', body: 'A polished UI that shows reasoning demonstrates product thinking far more clearly than a backend agent with a weak interface. The data model and logic layer are architecturally correct — they map directly to a real API-backed system with an LLM core.' },
          { title: 'Sprint-goal awareness vs. task-level optimization', body: 'Most task managers optimize per task. Sprint Agent optimizes at the sprint level — every triage decision is framed in terms of velocity, capacity, and goal risk. A low-urgency task that blocks the sprint goal escalates; a high-urgency task that doesn\'t affect the goal absorbs quietly.' },
          { title: 'Opinionated agent vs. flexible configuration', body: 'The agent is deliberately opinionated. It has a named framework, visible rules, and clear rationale for every decision. Teams don\'t want a neutral tool — they want a trusted operator with a clear philosophy. The autonomy framework makes the agent\'s values transparent and auditable.' },
        ].map(({ title, body }, i) => (
          <motion.div key={title}
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            style={{ padding: '11px 14px', borderRadius: 5, background: 'var(--s2)', border: '1px solid var(--b1)' }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)', marginBottom: 5, letterSpacing: '-0.01em' }}>{title}</div>
            <p style={{ fontSize: 11, color: 'var(--t2)', lineHeight: 1.65 }}>{body}</p>
          </motion.div>
        ))}
      </div>
    ),
  },
  {
    id: 'ai-native', icon: Cpu, iconColor: 'var(--act)', title: 'Why This is AI-Native',
    content: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p style={{ fontSize: 11, color: 'var(--t3)' }}>Not "existing PM tooling + a chatbot." AI-native in three specific ways:</p>
        {[
          { n: '1', title: 'The agent is the primary actor', body: 'Humans set goals and resolve escalations. The agent handles everything in between. The default is autonomous action, not human action with AI assistance.' },
          { n: '2', title: 'Reasoning is the product', body: 'Every decision comes with an explanation. The triage panel shows scoring dimensions, ACT/ASK/ESCALATE rationale, assignment confidence, and dependency risks. This is how trust is established and how humans learn when to override.' },
          { n: '3', title: 'UX designed for agent-human collaboration', body: 'The three-panel layout (board + feed + detail) surfaces what the agent is doing in real time. The escalation drawer is a decision queue, not a notification list. The policy panel makes the agent\'s ruleset a legible social contract.' },
        ].map(({ n, title, body }) => (
          <div key={n} style={{ display: 'flex', gap: 11 }}>
            <div style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, background: 'var(--act-bg)', border: '1px solid var(--act-bd)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: 'var(--act-t)', marginTop: 2, fontFamily: 'JetBrains Mono, monospace' }}>
              {n}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)', marginBottom: 4, letterSpacing: '-0.01em' }}>{title}</div>
              <p style={{ fontSize: 11, color: 'var(--t2)', lineHeight: 1.65 }}>{body}</p>
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: 'next', icon: ArrowRight, iconColor: 'var(--ok)', title: 'What Gets Integrated Next',
    content: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {[
          { tier: 'Tier 1 — Immediate', color: 'var(--ok)', bg: 'rgba(33,110,78,0.05)', bd: 'rgba(33,110,78,0.18)', items: ['Slack webhook intake — real messages become tasks automatically', 'Linear/Jira API — bidirectional sync for existing workflows', 'Claude API triage engine replaces rule-based scoring (with deterministic fallback)'] },
          { tier: 'Tier 2 — Sprint 2', color: 'var(--act)', bg: 'rgba(12,102,228,0.05)', bd: 'rgba(12,102,228,0.18)', items: ['Calendar integration — assignment engine uses actual availability', 'GitHub integration — PR status feeds into task status', 'Slack notifications — briefings push to channels by role'] },
          { tier: 'Tier 3 — Platform', color: 'var(--warn)', bg: 'rgba(151,68,0,0.05)', bd: 'rgba(151,68,0,0.18)', items: ['Multi-sprint learning — agent tunes confidence thresholds from history', 'Custom autonomy rules — PM adjusts ACT/ASK/ESCALATE thresholds per team', 'Retrospective engine — generates retro input from decision timeline'] },
        ].map(({ tier, color, bg, bd, items }) => (
          <div key={tier} style={{ borderRadius: 5, border: `1px solid ${bd}`, background: bg, padding: '11px 13px', borderLeft: `3px solid ${color}` }}>
            <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color, marginBottom: 7 }}>{tier}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {items.map(item => (
                <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
                  <div style={{ width: 3, height: 3, borderRadius: '50%', background: color, flexShrink: 0, marginTop: 5 }} />
                  <span style={{ fontSize: 11, color: 'var(--t2)' }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    ),
  },
]

export function RationalePanel() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ flexShrink: 0, padding: '13px 18px', borderBottom: '1px solid var(--b1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <BookOpen size={13} style={{ color: 'var(--act)' }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)', letterSpacing: '-0.015em' }}>Product Rationale</span>
        </div>
        <p style={{ fontSize: 11, color: 'var(--t3)' }}>Thesis, decision framework, trade-offs, and what's AI-native about this design.</p>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {SECTIONS.map((s, i) => {
          const Icon = s.icon
          return (
            <motion.div key={s.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
                <Icon size={12} style={{ color: s.iconColor, flexShrink: 0 }} />
                <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)', letterSpacing: '-0.012em' }}>{s.title}</h3>
              </div>
              {s.content}
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
