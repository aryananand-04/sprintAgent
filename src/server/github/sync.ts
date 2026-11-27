// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import 'server-only'
import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/db/database.types'
import { taskToInsert } from '@/lib/data/mappers'
import { issueToTask, isPullRequest, type GhIssue } from '@/logic/github'
import { paginate } from './app'

type Db = SupabaseClient<Database>

/** Hard ceiling per import so a giant repo can't stall the job; webhooks keep it current afterwards. */
export const MAX_IMPORT = 5_000

async function activeSprintId(db: Db, ws: string): Promise<string | null> {
  const { data } = await db.from('sprints').select('id').eq('workspace_id', ws).eq('status', 'active').maybeSingle()
  return data?.id ?? null
}

/**
 * Creates or updates the task for one issue, keyed by its URL. New issues are triaged by the rules;
 * existing tasks only get content and open/closed changes, so people's triage and assignments stand.
 */
export async function syncIssue(db: Db, ws: string, repoFullName: string, issue: GhIssue, sprintId?: string | null): Promise<'created' | 'updated' | 'skipped'> {
  if (isPullRequest(issue)) return 'skipped'
  const { data: existing } = await db.from('tasks').select('id, status').eq('workspace_id', ws).eq('external_ref', issue.html_url).maybeSingle()
  const mapped = issueToTask(issue, repoFullName, existing?.id ?? randomUUID())

  if (existing) {
    const reopened = issue.state === 'open' && existing.status === 'done'
    const closed = issue.state === 'closed' && existing.status !== 'done'
    const { error } = await db.from('tasks').update({
      title: mapped.title, description: mapped.description, tags: mapped.tags ?? [],
      ...(closed && { status: 'done' as const }), ...(reopened && { status: 'backlog' as const }),
    }).eq('id', existing.id)
    if (error) throw error
    return 'updated'
  }
  if (issue.state === 'closed') return 'skipped'
  const sprint = sprintId === undefined ? await activeSprintId(db, ws) : sprintId
  const { error } = await db.from('tasks').insert(taskToInsert(mapped, ws, sprint, null))
  if (error && error.code !== '23505') throw error // a concurrent webhook created it first: fine
  return error ? 'updated' : 'created'
}

/** Imports every open issue from every repo the installation can see (paginated, capped). */
export async function importInstallation(db: Db, ws: string, installationId: number) {
  const repos = await paginate<{ full_name: string }>(installationId, '/installation/repositories')
  const sprint = await activeSprintId(db, ws)
  const result = { repos: repos.length, created: 0, updated: 0, skipped: 0 }
  let budget = MAX_IMPORT
  for (const repo of repos) {
    if (budget <= 0) break
    const issues = await paginate<GhIssue>(installationId, `/repos/${repo.full_name}/issues?state=open`, Math.ceil(budget / 100))
    for (const issue of issues.slice(0, budget)) {
      result[await syncIssue(db, ws, repo.full_name, issue, sprint)]++
      budget--
    }
  }
  return result
}

/** The workspace an installation is linked to, if any. */
export async function workspaceForInstallation(db: Db, installationId: number): Promise<string | null> {
  const { data } = await db.from('github_installations').select('workspace_id').eq('installation_id', installationId).maybeSingle()
  return data?.workspace_id ?? null
}
