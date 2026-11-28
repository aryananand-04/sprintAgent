# Sprint Agent

Sprint admin, done by an agent that has to earn the right to act.

It triages incoming work, assigns what's clear, asks one good question when a ticket is vague, and escalates anything risky to a human, with the reasoning written down every time. Nobody writes a status update. Nobody grooms "make checkout feel premium" at 4pm on a Thursday.

## How it decides

Every request lands in one of three lanes:

- **ACT**: clear and low risk. The agent assigns it and tells you why.
- **ASK**: something's missing. It asks the requester one specific question.
- **ESCALATE**: risky, expensive or in conflict with sprint scope. A human decides.

The rules are deterministic and readable (`src/logic`). AI helps with wording and edge cases, but it's optional. Without a key, the rule engine runs everything.

## Where it works

The agent runs on the server every few minutes, so nobody needs the app open.

- **GitHub, Linear and Jira**: imports open issues, keeps them in sync and triages new ones. Optionally it posts the decision back as a label and the ASK question as a comment. A reply on the issue counts as the answer.
- **Slack**: file work with `/sprint`, answer ASK questions, resolve escalations with a button, and get a short morning DM about your own work.
- **Every morning**: a standup written from what actually happened, at 9am in the workspace's time zone.

## How it earns the right to act

The agent doesn't get autonomy from a settings toggle. For each kind of work (bugs, features, chores…) and each action (assigning, moving work between people) it holds a licence:

- **Suggest** (where every workspace starts): it says who it would pick, and a person decides.
- **Act with undo**: it assigns, and anyone can undo it for four hours.
- **Act**: it assigns.

Every accepted or overridden suggestion is evidence. A licence goes up only when the evidence clears a published bar (for example, 20+ decisions with at least 80% agreement at 95% confidence) and comes down when recent decisions stop agreeing. Admins can set a ceiling; nobody can raise a licence by hand. Every decision is written to a hash-chained log you can export and verify offline (`npm run ledger:verify -- export.json`).

The rules are an open spec: [docs/earned-autonomy-spec.md](docs/earned-autonomy-spec.md) (CC BY 4.0).

## Plans

| | Free | Team | Business | Enterprise |
|---|---|---|---|---|
| Triage | Rules | Rules + AI, 2,000 AI calls/month | Rules + AI, 10,000/month | Custom |
| Connected tools | 1 | All | All | All |
| Active contributors | Up to 5 | Billed per person | Billed per person | Contract |
| Earned autonomy, verifiable log | ✓ | ✓ | ✓ | ✓ |
| Ceiling | One for all work | One for all work | Per kind of work | Per kind of work |
| Decision log export | | | ✓ | ✓ |

Viewers are always free. An *active contributor* is anyone assigned work or changing a task that month. Past the AI allowance, triage carries on with the rules. Restraining the agent and verifying its log are never paid features.

Billing runs through Stripe: Checkout for a 14-day trial (no card), the Stripe portal for everything after. Seats follow active contributors daily and change at the next renewal. Limits come from one table, `src/logic/billing.ts`, and the server enforces them. Hiding a button in the UI is only for convenience.

## Run it

You'll need Node 20+ and Docker.

```bash
npm install
npm run db:start   # local Supabase
npm run db:env     # writes local keys to .env.local
npm run dev
```

Demo logins use the password `password123`: `admin@`, `pm@`, `dev@` and `viewer@demo.sprintagent.dev`.

Everything else is optional and off until you add its keys to `.env.local` (all listed with setup notes in `.env.example`, and all server-side):

- `GROQ_API_KEY` for AI triage.
- GitHub App, Slack app, Linear and Jira OAuth keys for the integrations.
- `STRIPE_*` for billing. Without it, workspaces stay on Free; the demo workspace is seeded on Business.
- `npm run jobs:dev` runs the background jobs (agent loop, deliveries, imports) through a local Inngest.

## Checks

```bash
npm run typecheck && npm run lint && npm test
npm run db:test    # row-level security, autonomy and billing tests (pgTAP)
npm run test:db    # server code against the local database
npm run test:e2e   # end-to-end, needs the local database
```

## Under the hood

Next.js, React, TypeScript, Tailwind, Supabase (Postgres, auth, realtime), Drizzle, Inngest and Stripe, tested with Vitest, Playwright and pgTAP.

```
src/
  app/          routes: marketing pages, the app, API endpoints
  components/   dashboard/, marketing/, auth/, ui/
  logic/        the decision engine: pure functions, no I/O
  services/     client calls to AI and integrations
  server/       server-only code: the agent loop, AI, integrations, autonomy, billing
  store/        client state (Zustand)
  lib/          shared helpers, Supabase clients, data sync
  db/           schema (migrations live in supabase/)
supabase/       migrations, seed, database tests
e2e/            browser tests
```

## License

Source-available under the [Functional Source License 1.1](LICENSE). Use it, change it and self-host it, as long as you don't build a competing product. Each release becomes Apache-2.0 after two years.

© 2026 Akchhya Singh & Aryan Anand. "Sprint Agent" is a trademark; see [TRADEMARKS.md](TRADEMARKS.md).
