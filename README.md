# Sprint Agent — AI-Native Sprint Operator

> An AI sprint operator that autonomously runs the boring middle of the sprint and escalates only when ambiguity, risk, or scope conflict makes human judgment cheaper than AI action.

## What this is

Sprint Agent is a high-fidelity prototype of an AI-powered sprint management system. It simulates an autonomous agent that handles the full sprint loop: intake → triage → assignment → tracking → briefing → escalation.

The core product thesis: **the agent owns the operational middle, not the strategic edges.** It assigns clear work, flags ambiguous work, and escalates risky or conflicting work to humans — always with a visible rationale.

---

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

**Build for production:**
```bash
npm run build
npm run preview
```

---

## Demo Scenarios (click ⚡ Demo Scenarios button)

These one-click triggers are designed for a Loom walkthrough:

| Scenario | What it triggers |
|----------|-----------------|
| **Urgent Bug** | Critical production crash enters mid-sprint. Agent classifies as ESCALATE, adds to feed, creates escalation. |
| **Design Blocked** | Checkout UI task blocked waiting for Priya's sign-off. Board updates, feed narrates. |
| **Engineer Overloaded** | Dev Mehta hits 98% capacity. Agent flags, adds escalation, blocks new assignments. |
| **Vague Request** | VP asks to "make checkout feel premium." Agent scores clarity=1, outputs ASK/ESCALATE decision. |
| **Scope Creep** | "Quick" loyalty points request enters. Agent calculates real effort (8+ days), escalates to PM. |

---

## Navigation Guide

| View | What to show |
|------|-------------|
| **Sprint Board** | Kanban with 6 columns, sprint health, capacity metrics |
| **Intake Inbox** | Submit new requests, see ad-hoc resolution decisions |
| **Triage Queue** | Every task classified by decision (ACT / ASK / ESCALATE). Click any row. |
| **Escalations** | 3 open escalations with full reason + recommendation |
| **Briefings** | Team / PM / Manager briefings — role-tailored |
| **Autonomy Framework** | The agent's ruleset — what it owns vs defers |
| **Agent Timeline** | Full audit trail of every decision |

**Click any task card → opens full Triage Analysis panel** (scoring breakdown, assignment recommendation, dependencies).

---

## Architecture Summary

```
src/
  types/        — All TypeScript types (Task, Sprint, Team, Feed, etc.)
  data/         — Seeded mock data (15 tasks, 5 team members, 1 sprint)
  logic/        — Deterministic agent logic
    triage.ts   — ACT/ASK/ESCALATE decision engine
    assign.ts   — Skill+load-based assignment with confidence scoring
    autonomy.ts — 12 named rules for the policy panel
    adHoc.ts    — Mid-sprint absorb/swap/escalate handler
    briefing.ts — Role-based briefing generator
    scoring.ts  — Triage score, ticket quality, assignment confidence
  store/        — Zustand store (central state + actions)
  components/   — 10 React components
  pages/        — Dashboard layout
```

---

## What's Mocked vs Future-Ready

| Feature | Current State | Future Integration |
|---------|--------------|-------------------|
| Task intake | Manual input + seed data | Slack events, GitHub webhooks, Jira API |
| Triage decisions | Deterministic scoring rules | LLM classification with few-shot prompting |
| Team assignments | Skill/load matrix | Calendar availability, PR review history |
| Status feed | Computed from state changes | Real-time Slack messages to team channels |
| Briefings | Template-based | LLM-generated with actual context window |
| Sprint data | Local Zustand state | Linear/Jira/Plane API |

---

## Tech Stack

- **React 18 + TypeScript** — UI
- **Vite** — Build tooling
- **Tailwind CSS** — Utility styling with custom design system
- **Framer Motion** — Transitions, board animations, panel reveals
- **Lucide React** — Icons
- **Zustand** — State management (no backend required)

No external APIs. No auth. No database. Runs entirely in the browser.
