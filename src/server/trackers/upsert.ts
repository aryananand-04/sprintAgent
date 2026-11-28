// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import 'server-only'
import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/db/database.types'
import type { Task } from '@/types'
import { taskToInsert } from '@/lib/data/mappers'

type Db = SupabaseClient<Database>
export type UpsertResult = 'created' | 'updated' | 'skipped'

export async function activeSprintId(db: Db, ws: string): Promise<string | null> {
  const { data } = await db.from('sprints').select('id').eq('workspace_id', ws).eq('status', 'active').maybeSingle()
  return data?.id ?? null
}

/**
 * Creates or updates the task for one tracker ticket, keyed by its URL. New tickets arrive triaged by
 * the rules; existing tasks only get content and open/closed changes, so people's triage and
 * assignments stand. `map` receives the id to use (the existing task's on re-sync).
 */
export async function upsertExternalTask(
  db: Db, ws: string, url: string, map: (id: string) => Task, sprintId?: string | null,
): Promise<UpsertResult> {
  const { data: existing } = await db.from('tasks').select('id, status').eq('workspace_id', ws).eq('external_ref', url).maybeSingle()
  const mapped = map(existing?.id ?? randomUUID())
  const closed = mapped.status === 'done'

  if (existing) {
    const reopened = !closed && existing.status === 'done'
    const nowClosed = closed && existing.status !== 'done'
    const { error } = await db.from('tasks').update({
      title: mapped.title, description: mapped.description, tags: mapped.tags ?? [],
      ...(nowClosed && { status: 'done' as const }), ...(reopened && { status: 'backlog' as const }),
    }).eq('id', existing.id)
    if (error) throw error
    return 'updated'
  }
  if (closed) return 'skipped'
  const sprint = sprintId === undefined ? await activeSprintId(db, ws) : sprintId
  const { error } = await db.from('tasks').insert(taskToInsert(mapped, ws, sprint, null))
  if (error && error.code !== '23505') throw error // a concurrent webhook created it first: fine
  return error ? 'updated' : 'created'
}

/** The task id for a tracker URL in this workspace, if we have one. */
export async function taskIdForRef(db: Db, ws: string, url: string): Promise<string | null> {
  const { data } = await db.from('tasks').select('id').eq('workspace_id', ws).eq('external_ref', url).maybeSingle()
  return data?.id ?? null
}
