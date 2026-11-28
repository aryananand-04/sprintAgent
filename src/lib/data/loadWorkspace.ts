// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/db/database.types'
import type { WorkspaceSnapshot } from '@/store/useSprintStore'
import {
  taskFromRow, teamFromRow, sprintFromRow, archiveFromRow, escalationFromRow, feedFromRow,
  commentFromRow, policyFromRow, calibrationFromRows, licenseFromRow, suggestionFromRow,
} from './mappers'
import type { TaskComment } from '@/types'
import { DEFAULT_AUTONOMY_CONFIG } from '@/logic/constants'
import { effectivePlan } from '@/logic/billing'

const FEED_LIMIT = 100

/** Loads one workspace's live state through RLS (the caller's own permissions apply). */
/** Pass a service client to load without RLS (server agent only, after its own checks). */
export async function loadWorkspace(workspaceId: string, client?: SupabaseClient<Database>): Promise<WorkspaceSnapshot | null> {
  const supabase = client ?? await createClient()

  const { data: active, error: sprintErr } = await supabase
    .from('sprints').select('*').eq('workspace_id', workspaceId).eq('status', 'active').maybeSingle()
  if (sprintErr) throw sprintErr
  if (!active) return null

  const [tasks, team, archived, escalations, feed, policy, calibration, licenses, suggestions, billing] = await Promise.all([
    supabase.from('tasks').select('*').eq('workspace_id', workspaceId)
      .or(`sprint_id.eq.${active.id},sprint_id.is.null`).order('created_at'),
    supabase.from('team_members').select('*').eq('workspace_id', workspaceId).order('created_at'),
    supabase.from('sprints').select('*').eq('workspace_id', workspaceId).eq('status', 'archived')
      .order('end_date', { ascending: false }).limit(12),
    supabase.from('escalations').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }),
    supabase.from('feed_events').select('*').eq('workspace_id', workspaceId).gte('created_at', active.created_at)
      .order('created_at', { ascending: false }).limit(FEED_LIMIT),
    supabase.from('autonomy_policies').select('*').eq('workspace_id', workspaceId).maybeSingle(),
    supabase.from('calibration').select('*').eq('workspace_id', workspaceId),
    supabase.from('autonomy_licenses').select('*').eq('workspace_id', workspaceId),
    supabase.from('predictions').select('*').eq('workspace_id', workspaceId).is('outcome', null),
    supabase.from('workspace_billing').select('plan, status').eq('workspace_id', workspaceId).maybeSingle(),
  ])
  for (const r of [tasks, team, archived, escalations, feed, policy, calibration, licenses, suggestions, billing]) if (r.error) throw r.error

  const taskIds = (tasks.data ?? []).map((t) => t.id)
  const [deps, comments] = taskIds.length
    ? await Promise.all([
        supabase.from('task_dependencies').select('task_id, depends_on_task_id').in('task_id', taskIds),
        supabase.from('task_comments').select('*').in('task_id', taskIds).order('created_at'),
      ])
    : [{ data: [], error: null }, { data: [], error: null }]
  if (deps.error) throw deps.error
  if (comments.error) throw comments.error

  const depsBy = new Map<string, string[]>()
  for (const d of deps.data ?? []) depsBy.set(d.task_id, [...(depsBy.get(d.task_id) ?? []), d.depends_on_task_id])
  const commentsBy = new Map<string, TaskComment[]>()
  for (const c of comments.data ?? []) commentsBy.set(c.task_id, [...(commentsBy.get(c.task_id) ?? []), commentFromRow(c)])

  return {
    workspaceId,
    sprint: sprintFromRow(active),
    tasks: (tasks.data ?? []).map((t) => taskFromRow(t, depsBy.get(t.id), commentsBy.get(t.id))),
    team: (team.data ?? []).map(teamFromRow),
    sprintHistory: (archived.data ?? []).map(archiveFromRow),
    escalations: (escalations.data ?? []).map(escalationFromRow),
    feed: (feed.data ?? []).map(feedFromRow),
    autonomyConfig: policy.data ? policyFromRow(policy.data) : DEFAULT_AUTONOMY_CONFIG,
    calibration: calibrationFromRows(calibration.data ?? []),
    licenses: (licenses.data ?? []).map(licenseFromRow),
    suggestions: (suggestions.data ?? []).map(suggestionFromRow),
    plan: effectivePlan(billing.data),
  }
}
