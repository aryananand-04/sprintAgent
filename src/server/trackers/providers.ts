// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/db/database.types'
import * as linear from '@/server/linear/api'
import { linearToken } from '@/server/linear/sync'
import * as jira from '@/server/jira/api'
import { deleteWebhooks, registerWebhooks } from '@/server/jira/sync'
import type { Connection, Tokens, TrackerKind } from './connections'

type Db = SupabaseClient<Database>

/** What the generic connect/callback/disconnect routes need from each tracker. */
export interface Provider {
  label: string
  configured(): boolean
  signState(p: { ws: string; uid: string }): string
  readState(s: string | null): { ws: string; uid: string } | null
  authorizeUrl(state: string, redirectUri: string): string
  /** Code → tokens + which org/site was authorised. */
  complete(code: string, redirectUri: string): Promise<{ externalId: string; name: string; siteUrl: string; tokens: Tokens }>
  /** After the link is saved (e.g. Jira registers its webhook). */
  afterConnect?(db: Db, conn: Connection, origin: string): Promise<void>
  /** Before forgetting the link: revoke tokens, remove webhooks (best effort). */
  beforeDisconnect?(db: Db, conn: Connection): Promise<void>
}

const linearProvider: Provider = {
  label: 'Linear',
  configured: linear.linearConfigured,
  signState: linear.signState,
  readState: linear.readState,
  authorizeUrl: linear.authorizeUrl,
  async complete(code, redirectUri) {
    const tokens = await linear.exchangeCode(code, redirectUri)
    const { organization } = await linear.gql<{ organization: { id: string; name: string; urlKey: string } }>(tokens.accessToken, '{ organization { id name urlKey } }')
    return { externalId: organization.id, name: organization.name, siteUrl: `https://linear.app/${organization.urlKey}`, tokens }
  },
  async beforeDisconnect(db, conn) {
    await linear.revoke(await linearToken(db, conn))
  },
}

const jiraProvider: Provider = {
  label: 'Jira',
  configured: jira.jiraConfigured,
  signState: jira.signState,
  readState: jira.readState,
  authorizeUrl: jira.authorizeUrl,
  async complete(code, redirectUri) {
    const tokens = await jira.exchangeCode(code, redirectUri)
    const sites = await jira.accessibleSites(tokens.accessToken)
    const site = sites.find((s) => s.scopes.some((sc) => sc.includes('jira'))) ?? sites[0]
    if (!site) throw new Error('JIRA_NO_SITE')
    return { externalId: site.id, name: site.name, siteUrl: site.url.replace(/\/$/, ''), tokens }
  },
  async afterConnect(db, conn, origin) {
    // Without webhooks the import still works; live sync just waits for a reconnect.
    await registerWebhooks(db, conn, origin).catch((e) => console.error('[jira] webhooks', e instanceof Error ? e.message : e))
  },
  async beforeDisconnect(db, conn) {
    await deleteWebhooks(db, conn)
  },
}

export const PROVIDERS: Record<TrackerKind, Provider> = { linear: linearProvider, jira: jiraProvider }

export const providerFor = (kind: string): { kind: TrackerKind; provider: Provider } | null => {
  const p = PROVIDERS[kind as TrackerKind]
  return p ? { kind: kind as TrackerKind, provider: p } : null
}
