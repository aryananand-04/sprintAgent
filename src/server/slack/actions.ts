// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/db/database.types'
import { can, ROLE_LABEL, type Permission, type Role } from '@/lib/permissions'
import { slackApi } from './api'
import type { SlackLink } from './install'

type Db = SupabaseClient<Database>

export type Member = { userId: string; role: Role }

/**
 * Who a Slack user is in the linked workspace: Slack's verified profile email, matched to a member
 * with a confirmed email. Null for bots, deactivated users, hidden emails and non-members.
 */
export async function memberForSlackUser(db: Db, link: SlackLink, slackUserId: string): Promise<Member | null> {
  const info = await slackApi<{ user?: { is_bot?: boolean; deleted?: boolean; profile?: { email?: string } } }>('users.info', link.token, { user: slackUserId }).catch(() => null)
  const email = info?.user?.profile?.email
  if (!email || info?.user?.is_bot || info?.user?.deleted) return null
  const { data } = await db.rpc('member_by_email', { ws: link.workspaceId, member_email: email })
  const m = data?.[0]
  return m ? { userId: m.user_id, role: m.role as Role } : null
}

export type Gate = { ok: true; member: Member } | { ok: false; message: string }

/** Same permission matrix as the app (and RLS): Slack is just another place to click. */
export async function gate(db: Db, link: SlackLink, slackUserId: string, permission: Permission): Promise<Gate> {
  const member = await memberForSlackUser(db, link, slackUserId)
  if (!member) return { ok: false, message: 'Your Slack email doesn’t match a member of this Sprint Agent workspace. Ask an admin to invite that address.' }
  if (!can(member.role, permission)) return { ok: false, message: `That needs a PM or admin. You’re a ${ROLE_LABEL[member.role]} here.` }
  return { ok: true, member }
}

export type ResolveResult = { result: 'resolved'; taskTitle: string } | { result: 'already' | 'not-found' }

/**
 * Resolves an escalation from Slack, the same way the app does: the task is cleared to act, the
 * decision log records who decided, and the feed says so. Only the first click counts.
 */
export async function resolveEscalation(db: Db, ws: string, escalationId: string, by: Member): Promise<ResolveResult> {
  const { data: esc } = await db.from('escalations').select('id, task_id, task_title, resolved_at').eq('workspace_id', ws).eq('id', escalationId).maybeSingle()
  if (!esc) return { result: 'not-found' }
  const { data: updated } = await db.from('escalations')
    .update({ resolved_at: new Date().toISOString(), resolved_by: by.userId, resolution: 'Resolved in Slack' })
    .eq('id', esc.id).is('resolved_at', null).select('id')
  if (!updated?.length) return { result: 'already' }

  if (esc.task_id) await db.from('tasks').update({ decision: 'ACT', is_ai_triaged: false }).eq('id', esc.task_id).eq('workspace_id', ws)
  await db.from('decisions').insert({
    workspace_id: ws, task_id: esc.task_id, kind: 'override', source: 'human', decision: 'ACT', actor_id: by.userId,
    rationale: `Escalation resolved in Slack: "${esc.task_title}".`, payload: { via: 'slack', escalationId: esc.id },
  })
  await db.from('feed_events').insert({ workspace_id: ws, type: 'resolve', task_id: esc.task_id, decision: 'ACT', message: `Escalation resolved in Slack: "${esc.task_title}". The agent can proceed.` })
  return { result: 'resolved', taskTitle: esc.task_title }
}
