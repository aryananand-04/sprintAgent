# Earned Autonomy

**Version 0.1 (draft) · November 2026**
© 2026 Akchhya Singh & Aryan Anand. This specification is licensed under [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/). You may implement it, copy it and build on it, with attribution. Sprint Agent is the reference implementation; its source code is licensed separately (see `LICENSE`).

## 1. Purpose

Software agents that act inside a team's tools (assign work, move it, close it) are usually given autonomy by a settings toggle. A person guesses how far to trust the agent, and nobody measures whether the guess was right.

Earned Autonomy replaces the toggle with a licence that the agent earns from evidence and loses the same way:

1. The agent starts by **predicting** what it would do. People do the work as usual.
2. Each prediction is compared with what people actually did. That comparison is the evidence.
3. The agent may act on its own only when the evidence clears a published statistical bar, per kind of work and per action.
4. Recent disagreement takes the licence away again. A person can always lower it. Nobody can raise it beyond what was earned.
5. Every decision is written to an append-only, hash-chained log that anyone with an export can verify.

The keywords MUST, SHOULD and MAY are used as in RFC 2119.

## 2. Terms

| Term | Meaning |
|---|---|
| **Action** | Something the agent can do on its own, e.g. `assign` (give a task an owner) or `rebalance` (move a task between people). |
| **Task type** | The workspace's own classification of work (bug, feature, chore…). Licences are held per task type × action. |
| **Prediction** | A record of what the agent would do (shadow) or did (acted) for one task and action. |
| **Outcome** | `agree`, `disagree` or `expired`, decided by what people did afterwards. |
| **Licence** | The level the agent holds for one task type × action: earned level, admin ceiling, evidence counts. |

## 3. Levels

| Level | Name | The agent… |
|---|---|---|
| L0 | Observe | records predictions only. Nothing is shown and nothing changes. |
| L1 | Suggest | records predictions and shows them as suggestions people can accept. **Default for new workspaces.** |
| L2 | Act with undo | acts, and shows an undo option for a declared window (reference: 4 hours). |
| L3 | Act | acts. People can still change anything afterwards, and doing so counts as disagreement. |

The **effective** level is `min(earned, ceiling)`. The ceiling is set by workspace admins (default L3). Implementations MUST NOT let anyone set the earned level directly.

## 4. Actions declare their risk

Each action MUST declare:

- **reversible** (boolean): can a person fully undo it?
- **blast radius**: what it touches, in plain words (e.g. "one task, one person").

An irreversible action MUST NOT be licensed above **L2**.

Reference actions: `assign` (reversible; one task, one person) and `rebalance` (reversible; one task, two people).

## 5. Evidence

### 5.1 Recording

Whenever the agent would take a licensed action, it MUST record a prediction, whether or not it acts. A prediction records the task, the task type, the action, its mode (`shadow` below L2, `acted` at L2+), the predicted target (e.g. the member), the previous state, a rationale, and for L2 the undo deadline.

There is at most one open prediction per task × action. A newer one replaces the older one, which becomes `expired`.

### 5.2 Resolution

Outcomes MUST be decided by what people do, never by the agent. Implementations SHOULD enforce this at the data layer: the reference implementation resolves predictions in a database trigger that tells people apart from the agent by the authenticated user.

| Prediction | Event | Outcome |
|---|---|---|
| shadow | a person assigns the predicted member | `agree` |
| shadow | a person assigns someone else | `disagree` |
| acted | a person moves or undoes the agent's assignment | `disagree` |
| acted | work starts or finishes with the agent's assignment unchanged | `agree` |
| any | the agent itself changes the task again | `expired` |
| shadow | nobody acts on it within 14 days | `expired` |

`expired` outcomes are not evidence.

## 6. Promotion and demotion

Let *n* be the number of `agree` + `disagree` outcomes for a licence, *a* the number of `agree`, and **W⁻(a, n)** / **W⁺(a, n)** the lower / upper bounds of the 95% Wilson score interval (z = 1.96).

| To hold | Requires |
|---|---|
| L2 Act with undo | n ≥ 20 and W⁻ ≥ 0.80 |
| L3 Act | n ≥ 50 and W⁻ ≥ 0.90 |

- **Promotion** is evaluated on the whole record and moves **one level at a time**.
- **Demotion** is evaluated on the most recent 20 outcomes (when there are at least 10). If W⁺ of the recent window is below the bar of the current level, the licence drops one level. The upper bound is used deliberately: the agent is demoted only when recent evidence can't plausibly support the level it holds.
- Every level change MUST be written to the decision log (§7) with the numbers behind it.

Implementations MAY choose stricter bars. They MUST publish the bars they use.

## 7. Decision log (trust ledger)

### 7.1 Schema

Each workspace has an append-only log. Each entry has:

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `workspace_id` | uuid | |
| `chain_index` | integer | 1, 2, 3… with no gaps, per workspace |
| `created_at` | timestamp (µs) | |
| `kind` | text | `triage`, `assign`, `rebalance`, `escalate`, `ad-hoc`, `override`, `license` |
| `source` | text | `rules`, `ai` or `human` |
| `decision` | text or null | `ACT`, `ASK`, `ESCALATE` |
| `rationale` | text | plain language |
| `payload` | JSON object | details (evidence counts, mode, level, targets) |
| `subject_id` | uuid or null | immutable copy of the task id |
| `actor_ref` | uuid or null | immutable copy of the acting user's id |
| `prev_hash` | hex or null | `hash` of entry `chain_index − 1` |
| `hash` | hex | see 7.2 |

Entries MUST NOT be updated or deleted. If a referenced task or user is deleted, the live reference may be cleared, but `subject_id` and `actor_ref` stay as written.

### 7.2 Hash

```
hash = hex(sha256(utf8(join("|", [
  prev_hash or "", id, chain_index, workspace_id, kind, source, decision or "",
  rationale, jsonb_text(payload), subject_id or "", actor_ref or "", created_at_micros
]))))
```

- `jsonb_text` is PostgreSQL's `jsonb` text form: object keys ordered by byte length, then bytewise; `", "` between items and `": "` after keys; strings JSON-escaped, non-ASCII left as UTF-8.
- `created_at_micros` is integer microseconds since the Unix epoch.

Writers MUST serialise appends per workspace so that two entries can't claim the same predecessor.

### 7.3 Verification

A verifier walks entries by `chain_index` and checks three things for each: the index is contiguous, `prev_hash` equals the previous `hash`, and `hash` recomputes. The first failure identifies where the log was changed. The reference implementation provides:

- `public.verify_decision_chain(workspace)` in the database;
- `GET /api/audit/export?format=json`, which includes every field above;
- `npm run ledger:verify -- <export.json>`, which verifies offline with no database access.

## 8. Weekly digest

Implementations SHOULD send a weekly summary of the shadow evidence. It covers agreement over the week, per task type × action, the distance to the next level, and up to three cases where the agent would have chosen differently. It is the onboarding loop: teams turn autonomy on because the numbers say they can, not because a vendor said so.

## 9. Conformance checklist

- [ ] Licences are per task type × action, with the levels in §3.
- [ ] New workspaces start at L1 or lower.
- [ ] Predictions are recorded whether or not the agent acts (§5.1).
- [ ] Outcomes come from people's actions only (§5.2).
- [ ] Promotion and demotion follow §6, one level at a time, with the bars published.
- [ ] Admins can lower a ceiling. Nobody can raise an earned level by hand.
- [ ] Irreversible actions stop at L2.
- [ ] The decision log is append-only and hash-chained as in §7, and exportable with every hashed field.

## 10. Related work

- *Toward Agentic Software Project Management* (arXiv:2601.16392): a research roadmap for agents in project management. Earned Autonomy proposes a concrete, measurable answer to its question of when an agent should be trusted to act.
- Wilson, E. B. (1927). *Probable inference, the law of succession, and statistical inference.* JASA 22(158).

## 11. Changes

- **0.1 (Nov 2026):** first draft, from the Sprint Agent reference implementation.
