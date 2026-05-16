/**
 * Posts an escalation to Slack via incoming webhook.
 * User pastes their webhook URL in Settings.
 * Completely free — no backend needed, just a fetch() call.
 */
export async function postSlackEscalation(opts: {
  webhookUrl: string
  taskTitle: string
  reason: string
  recommendation: string
  urgency: string
  appUrl?: string
}): Promise<void> {
  const { webhookUrl, taskTitle, reason, recommendation, urgency, appUrl } = opts
  if (!webhookUrl) return

  const urgencyEmoji = urgency === 'critical' ? '🔴' : urgency === 'high' ? '🟠' : '🟡'

  const payload = {
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: `${urgencyEmoji} Sprint Agent — Escalation Required` },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Task:* ${taskTitle}\n*Urgency:* ${urgency.toUpperCase()}`,
        },
      },
      { type: 'divider' },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*Why the agent escalated:*\n${reason}` },
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*Agent recommendation:*\n${recommendation}` },
      },
      ...(appUrl ? [{
        type: 'actions',
        elements: [{
          type: 'button',
          text: { type: 'plain_text', text: 'View in Sprint Agent' },
          url: appUrl,
          style: 'primary',
        }],
      }] : []),
      {
        type: 'context',
        elements: [{ type: 'mrkdwn', text: 'Sent by Sprint Agent · Human judgment required before agent can proceed.' }],
      },
    ],
  }

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    // Slack webhook failed silently — don't break the app
  }
}
