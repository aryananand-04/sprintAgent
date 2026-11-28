// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import type { AgentDecision } from '../types'

export type OutgoingEvent =
  | { type: 'escalation'; taskTitle: string; reason: string; recommendation: string; urgency: 'critical' | 'high' | 'medium' | 'low'; escalationId?: string }
  | { type: 'decision'; taskTitle: string; decision: AgentDecision; reason: string }

/** Hands an event to the server outbox (which owns the webhook URLs and retries). Resolves to the number queued. */
export async function sendEvent(event: OutgoingEvent): Promise<number> {
  const res = await fetch('/api/outbox', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(event) })
  if (!res.ok) throw new Error(`OUTBOX_${res.status}`)
  const data = (await res.json()) as { queued: number }
  return data.queued
}
