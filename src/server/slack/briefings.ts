// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/db/database.types'
import type { EscalationItem, Sprint, Task, TeamMember } from '@/types'
import { can, type Role } from '@/lib/permissions'
import { personalBriefing } from '@/logic/personalBriefing'
import { standupDue } from '@/logic/standup'
import { askQuestion } from '@/logic/textSignals'
import { slackApi } from './api'
import { linkForWorkspace } from './install'

type Db = SupabaseClient<Database>

export type DmResult = { result: 'off' | 'not-due' | 'already' } | { result: 'sent'; sent: number; skipped: number }

/**
 * The daily DMs, at 9am workspace time, once per local day: each linked person gets their own work,
 * the answers only they can give, and (PM+) the decisions waiting. People with nothing get nothing.
 */
export async function sendDmBriefings(
  db: Db, ws: string, snap: { tasks: Task[]; team: TeamMember[]; sprint: Sprint; escalations: EscalationItem[] }, now: Date,
): Promise<DmResult> {
  const { data: inst } = await db.from('slack_installations').select('dm_briefings').eq('workspace_id', ws).maybeSingle()
  if (!inst?.dm_briefings) return { result: 'off' }
  const { data: w } = await db.from('workspaces').select('timezone').eq('id', ws).single()
  const { due, day } = standupDue(now, w?.timezone ?? 'UTC')
  if (!due) return { result: 'not-due' }
  const { data: first, error } = await db.rpc('claim_agent_cooldown', { ws, check_key: `dm-briefings-${day}`, cooldown_seconds: 2 * 86_400 })
  if (error) throw error
  if (!first) return { result: 'already' }

  const link = await linkForWorkspace(db, ws)
  if (!link) return { result: 'off' }
  const [{ data: emails }, { data: roles }, { data: asks }] = await Promise.all([
    db.rpc('member_emails', { ws }),
    db.from('workspace_members').select('user_id, role').eq('workspace_id', ws),
    db.from('tasks').select('id, created_by').eq('workspace_id', ws).eq('decision', 'ASK').neq('status', 'done').not('created_by', 'is', null),
  ])
  const openEscalations = snap.escalations.filter((e) => !e.resolved).length

  let sent = 0, skipped = 0
  for (const member of snap.team) {
    const email = member.userId && emails?.find((e) => e.user_id === member.userId)?.email
    if (!email) { skipped++; continue }
    const role = (roles?.find((r) => r.user_id === member.userId)?.role ?? null) as Role | null
    const waitingOnThem = (asks ?? []).filter((a) => a.created_by === member.userId)
      .map((a) => snap.tasks.find((t) => t.id === a.id)).filter((t): t is Task => !!t)
      .map((task) => ({ task, question: askQuestion(task) ?? 'What does “done” look like for this?' }))
    const text = personalBriefing({
      name: member.name, sprint: snap.sprint, waitingOnThem,
      assigned: snap.tasks.filter((t) => t.assigneeId === member.id),
      openEscalations: can(role, 'escalation:resolve') ? openEscalations : 0,
    })
    if (!text) { skipped++; continue }
    try {
      const { user } = await slackApi<{ user: { id: string } }>('users.lookupByEmail', link.token, { email })
      await slackApi('chat.postMessage', link.token, { channel: user.id, text })
      sent++
    } catch (e) {
      skipped++ // not in this Slack team, deactivated, or a hiccup: never block the others
      if (!(e instanceof Error && /users_not_found/.test(e.message))) console.error('[slack] dm', e instanceof Error ? e.message : e)
    }
  }
  if (sent) await db.from('feed_events').insert({ workspace_id: ws, type: 'status', message: `Sent ${sent} morning DM${sent === 1 ? '' : 's'} in Slack.` })
  return { result: 'sent', sent, skipped }
}
