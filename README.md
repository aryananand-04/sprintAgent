# Sprint Agent

Sprint admin, done by an agent that has to earn the right to act.

It triages incoming work, assigns what's clear, asks one good question when a ticket is vague, and escalates anything risky to a human, with the reasoning written down every time. Nobody writes a status update. Nobody grooms "make checkout feel premium" at 4pm on a Thursday.

## How it decides

Every request lands in one of three lanes:

- **ACT**: clear and low risk. The agent assigns it and tells you why.
- **ASK**: something's missing. It asks the requester one specific question.
- **ESCALATE**: risky, expensive or in conflict with sprint scope. A human decides.

The rules are deterministic and readable (`src/logic`). AI helps with wording and edge cases, but it's optional. Without a key, the rule engine runs everything.

## Run it

You'll need Node 20+ and Docker.

```bash
npm install
npm run db:start   # local Supabase
npm run db:env     # writes local keys to .env.local
npm run dev
```

Demo logins use the password `password123`: `admin@`, `pm@`, `dev@` and `viewer@demo.sprintagent.dev`.

To turn on AI, add `GROQ_API_KEY` to `.env.local`. It stays on the server.

## Checks

```bash
npm run typecheck && npm run lint && npm test
npm run db:test    # row-level security tests
npm run test:e2e   # end-to-end, needs the local database
```

## Under the hood

Next.js, React, TypeScript, Tailwind, Supabase (Postgres, auth, realtime) and Drizzle, tested with Vitest, Playwright and pgTAP.

```
src/
  app/          routes: marketing pages, the app, API endpoints
  components/   dashboard/, marketing/, auth/, ui/
  logic/        the decision engine: pure functions, no I/O
  services/     client calls to AI and integrations
  server/       server-only code: LLM access, AI triage, rate limits
  store/        client state (Zustand)
  lib/          shared helpers, Supabase clients, data sync
  db/           schema (migrations live in supabase/)
supabase/       migrations, seed, database tests
e2e/            browser tests
```

## License

Source-available under the [Functional Source License 1.1](LICENSE). Use it, change it and self-host it, as long as you don't build a competing product. Each release becomes Apache-2.0 after two years.

© 2026 Akchhya Singh & Aryan Anand. "Sprint Agent" is a trademark; see [TRADEMARKS.md](TRADEMARKS.md).
