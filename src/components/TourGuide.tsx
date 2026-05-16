import { TourHint } from './TourHint'

// side choices:
// 'bottom' — element spans full width (paragraphs, textareas, headings)
// 'right'  — element is narrow (labels, spans, short text)
// 'top'    — element is at the bottom of the screen

const STEPS = [
  {
    step: 1,
    side: 'bottom' as const,   // sprint goal paragraph — full-width → below it
    title: 'Agent generated this 3 seconds after load',
    body: 'That line below the sprint goal was written by Groq the moment the page opened — one API call, no input from you. The agent also triaged your backlog and assigned tasks before you saw anything.',
  },
  {
    step: 2,
    side: 'bottom' as const,   // blocked column header label → below it
    title: 'Agent resolved a real blocker here',
    body: "The 60s monitoring loop detected a task was blocked 30+ hours. It found the dependency owner was overloaded, re-assigned them to someone with headroom — not just an alert, it actually acted.",
  },
  {
    step: 3,
    side: 'top' as const,      // live dot in pill at bottom of screen → above it
    title: 'This pill is the live agent feed — click it',
    body: 'Every autonomous decision is logged here in real time with first-person narration. Click the pill to expand and see what the agent has been doing for the past 6 hours.',
  },
  {
    step: 4,
    side: 'bottom' as const,   // textarea — very wide → below it
    title: 'Just describe it. Agent does the rest.',
    body: 'Type any request in plain English. No urgency picker, no assignee dropdown. The agent scores it 0–100, decides ACT / ASK / ESCALATE, and assigns it — all before you finish your next message.',
  },
  {
    step: 5,
    side: 'bottom' as const,
    title: 'Every verdict is explicit and auditable',
    body: 'ACT: agent proceeds autonomously. ASK: it needs one specific answer. ESCALATE: it hit a hard authority boundary — compliance, scope conflict, or zero clarity. Click any row for full AI reasoning.',
  },
  {
    step: 6,
    side: 'bottom' as const,   // Escalations heading → below it
    title: 'Agent deferred. You decide. It resumes.',
    body: "Both items exceed the agent's authority boundary. Resolve either one and the agent immediately re-triages the task, closes the loop, and resumes autonomous operation.",
  },
]

export function TourGuide() {
  return (
    <>
      {STEPS.map(s => (
        <TourHint key={s.step} step={s.step} title={s.title} body={s.body} side={s.side} />
      ))}
    </>
  )
}
