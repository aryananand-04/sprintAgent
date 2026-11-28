// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/db/database.types'
import { activeSprintId, upsertExternalTask, type UpsertResult } from '@/server/trackers/upsert'
import { issueToTask, isPullRequest, type GhIssue } from '@/logic/github'
import { paginate } from './app'

type Db = SupabaseClient<Database>

/** Hard ceiling per import so a giant repo can't stall the job; webhooks keep it current afterwards. */
export const MAX_IMPORT = 5_000

/** Creates or updates the task for one issue (pull requests are skipped). See `upsertExternalTask`. */
export async function syncIssue(db: Db, ws: string, repoFullName: string, issue: GhIssue, sprintId?: string | null): Promise<UpsertResult> {
  if (isPullRequest(issue)) return 'skipped'
  return upsertExternalTask(db, ws, issue.html_url, (id) => issueToTask(issue, repoFullName, id), sprintId)
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
