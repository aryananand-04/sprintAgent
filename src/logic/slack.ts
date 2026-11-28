// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
// Provenance: sprintagent-prov-7c1e94d2b85a
// Slack Block Kit messages. Pure: the server sends them.

/** Slack mrkdwn treats <, > and & as control characters (mentions, links); user text must not. */
export const slackEscape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export const RESOLVE_ACTION = 'esc_resolve'

export interface EscalationMessage {
  taskTitle: string
  reason: string
  recommendation: string
  urgency: 'critical' | 'high' | 'medium' | 'low'
  escalationId?: string
}

/**
 * An escalation as a Slack message. With `interactive` (our app is installed and the escalation has
 * an id) it carries a Resolve button; otherwise it's plain text plus a link.
 */
export function escalationMessage(e: EscalationMessage, opts: { appUrl?: string; interactive?: boolean } = {}) {
  const link = opts.appUrl ? `\n<${opts.appUrl}|Open in Sprint Agent>` : ''
  const blocks: unknown[] = [
    { type: 'header', text: { type: 'plain_text', text: `Needs a decision: ${e.taskTitle}`.slice(0, 150) } },
    { type: 'section', text: { type: 'mrkdwn', text: `*Why:* ${slackEscape(e.reason)}\n*Suggested:* ${slackEscape(e.recommendation || '—')}\n*Urgency:* ${e.urgency}${opts.interactive ? '' : link}` } },
  ]
  if (opts.interactive && e.escalationId) {
    blocks.push({
      type: 'actions',
      elements: [
        { type: 'button', action_id: RESOLVE_ACTION, value: e.escalationId, style: 'primary', text: { type: 'plain_text', text: 'Resolve: agent may proceed' },
          confirm: { title: { type: 'plain_text', text: 'Resolve this escalation?' }, text: { type: 'plain_text', text: 'The agent will treat the task as cleared to act.' }, confirm: { type: 'plain_text', text: 'Resolve' }, deny: { type: 'plain_text', text: 'Cancel' } } },
        ...(opts.appUrl ? [{ type: 'button', action_id: 'esc_open', url: opts.appUrl, text: { type: 'plain_text', text: 'Open in Sprint Agent' } }] : []),
      ],
    })
  }
  return { text: `Escalation: ${e.taskTitle}`, blocks }
}

/** Replaces the escalation message once someone resolved it, so the channel shows who decided. */
export function resolvedMessage(taskTitle: string, slackUserId: string) {
  const text = `Resolved by <@${slackUserId}>: ${slackEscape(taskTitle)}. The agent may proceed.`
  return { replace_original: true, text, blocks: [{ type: 'section', text: { type: 'mrkdwn', text } }] }
}

export interface SlackMessage { text: string; blocks?: unknown[] }

/** A reply only the clicker sees. */
export const ephemeral = (m: string | SlackMessage) => ({ response_type: 'ephemeral', replace_original: false, ...(typeof m === 'string' ? { text: m } : m) })

/**
 * Slack message text → plain text for a ticket: drops user/channel mentions, keeps link labels (or
 * the URL), and undoes Slack's &lt; &gt; &amp; escaping.
 */
export function slackToPlain(text: string): string {
  return text
    .replace(/<[@#!][^>]*>/g, ' ')
    .replace(/<([^>|]+)\|([^>]+)>/g, '$2')
    .replace(/<([^>]+)>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').trim()
}

export const INTAKE_HELP = 'Describe the work after the command, e.g. `/sprint Checkout fails on Safari 17 after applying a promo code`. I’ll add it to the backlog and triage it.'

/** The answer to whoever filed a request: what happened to it, and the one question if it's an ASK. */
export function intakeReply(r: { title: string; decision: 'ACT' | 'ASK' | 'ESCALATE' | null; assigneeName?: string | null; question?: string | null }): string {
  const t = `“${slackEscape(r.title)}”`
  if (r.decision === 'ACT') return r.assigneeName ? `Added ${t}. Clear enough to start, so it’s with ${slackEscape(r.assigneeName)}.` : `Added ${t}. Clear enough to start. Nobody has room right now, so it’s waiting in the backlog.`
  if (r.decision === 'ASK') return `Added ${t}. One question before anyone starts: ${slackEscape(r.question ?? 'what does done look like?')}`
  if (r.decision === 'ESCALATE') return `Added ${t}. It needs a PM’s decision, so I’ve escalated it.`
  return `Added ${t} to the backlog. It’ll be triaged on the next pass.`
}

export const ANSWER_ACTION = 'ask_answer'
export const ANSWER_VIEW = 'ask_answer'
export const ANSWER_BLOCK = 'answer'
export const ANSWER_INPUT = 'text'

const short = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

/** A button that opens the answer box for one ASK ticket. */
export const answerButton = (taskId: string, label = 'Answer') =>
  ({ type: 'button', action_id: ANSWER_ACTION, value: taskId, text: { type: 'plain_text', text: short(label, 75) } })

/** A message with Answer buttons under it (one per ASK ticket, at most five). */
export function withAnswerButtons(text: string, items: Array<{ taskId: string; label?: string }>) {
  if (!items.length) return { text }
  return {
    text,
    blocks: [
      { type: 'section', text: { type: 'mrkdwn', text: short(text, 3_000) } },
      { type: 'actions', elements: items.slice(0, 5).map((i) => answerButton(i.taskId, i.label)) },
    ],
  }
}

/** The answer box. The ticket id rides in private_metadata; the server re-checks it on submit. */
export function answerModal(t: { taskId: string; title: string; question: string }) {
  return {
    type: 'modal',
    callback_id: ANSWER_VIEW,
    private_metadata: t.taskId,
    title: { type: 'plain_text', text: 'Answer the agent' },
    submit: { type: 'plain_text', text: 'Send' },
    close: { type: 'plain_text', text: 'Cancel' },
    blocks: [
      { type: 'section', text: { type: 'mrkdwn', text: `*${slackEscape(short(t.title, 200))}*\n${slackEscape(t.question)}` } },
      {
        type: 'input', block_id: ANSWER_BLOCK, label: { type: 'plain_text', text: 'Your answer' },
        hint: { type: 'plain_text', text: 'Saved as a comment on the ticket. Specifics help: what “done” looks like, numbers, an example.' },
        element: { type: 'plain_text_input', action_id: ANSWER_INPUT, multiline: true, min_length: 3, max_length: 3_000 },
      },
    ],
  }
}

/** What the person who answered is told afterwards. */
export function answerOutcome(r: { title: string; decision: 'ACT' | 'ASK' | 'ESCALATE'; question?: string | null }): string {
  const t = `“${slackEscape(r.title)}”`
  if (r.decision === 'ACT') return `Thanks. ${t} is clear enough to start now.`
  if (r.decision === 'ESCALATE') return `Thanks. ${t} now needs a PM’s decision, so it’s with them.`
  return `Thanks, that’s on ${t}. It still needs a little more before anyone starts: ${slackEscape(r.question ?? 'what does “done” look like?')}`
}
