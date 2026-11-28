// SPDX-License-Identifier: FSL-1.1-ALv2
// SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/db/database.types'
import { seal, unseal } from '@/server/seal'
import { slackApi, type SlackInstall } from './api'

type Db = SupabaseClient<Database>

// The token is sealed for its Slack team, so a sealed value copied onto another row won't open.
const aad = (teamId: string) => `slack-bot:${teamId}`

/**
 * Links a Slack team to a workspace (one each way). The channel picked at install becomes the
 * workspace's Slack destination for escalations and the standup, replacing any pasted webhook.
 */
export async function saveInstall(db: Db, ws: string, userId: string, i: SlackInstall): Promise<'connected' | 'taken'> {
  const { data: other } = await db.from('slack_installations').select('workspace_id').eq('team_id', i.team.id).maybeSingle()
  if (other && other.workspace_id !== ws) return 'taken'

  const { error } = await db.from('slack_installations').upsert({
    workspace_id: ws, team_id: i.team.id, team_name: i.team.name, bot_user_id: i.bot_user_id,
    bot_token_sealed: seal(i.access_token, aad(i.team.id)),
    channel_id: i.incoming_webhook?.channel_id ?? null, channel_name: i.incoming_webhook?.channel ?? null,
    connected_by: userId,
  }, { onConflict: 'workspace_id' })
  if (error?.code === '23505') return 'taken' // raced another workspace for the same team
  if (error) throw error

  if (i.incoming_webhook) {
    const { error: wErr } = await db.from('integrations')
      .upsert({ workspace_id: ws, kind: 'slack_webhook', url: i.incoming_webhook.url, enabled: true }, { onConflict: 'workspace_id,kind' })
    if (wErr) throw wErr
  }
  return 'connected'
}

export interface SlackLink { workspaceId: string; teamId: string; botUserId: string; channelId: string | null; token: string }

async function link(db: Db, column: 'workspace_id' | 'team_id', value: string): Promise<SlackLink | null> {
  const { data } = await db.from('slack_installations').select('workspace_id, team_id, bot_user_id, channel_id, bot_token_sealed').eq(column, value).maybeSingle()
  if (!data) return null
  return { workspaceId: data.workspace_id, teamId: data.team_id, botUserId: data.bot_user_id, channelId: data.channel_id, token: unseal(data.bot_token_sealed, aad(data.team_id)) }
}

export const linkForWorkspace = (db: Db, ws: string) => link(db, 'workspace_id', ws)
export const linkForTeam = (db: Db, teamId: string) => link(db, 'team_id', teamId)

/** Revokes the token at Slack (best effort), then forgets the install and the channel webhook it created. */
export async function disconnect(db: Db, ws: string): Promise<void> {
  const l = await linkForWorkspace(db, ws).catch(() => null)
  if (l) await slackApi('auth.revoke', l.token, {}).catch(() => {})
  await forget(db, ws)
}

/** Slack told us the app is gone (uninstalled or token revoked): nothing to revoke, just clean up. */
export async function forget(db: Db, ws: string): Promise<void> {
  await db.from('slack_installations').delete().eq('workspace_id', ws)
  await db.from('integrations').delete().eq('workspace_id', ws).eq('kind', 'slack_webhook').like('url', 'https://hooks.slack.com/%')
}
