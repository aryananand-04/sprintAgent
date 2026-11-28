-- Slack installs are created and removed by the server after the OAuth exchange. PMs may see which
-- Slack team and channel are linked, but never the sealed bot token (column-level grant).
alter table public.slack_installations enable row level security;
create policy slack_installations_select on public.slack_installations for select to authenticated using (app.has_role(workspace_id, 'pm'));
revoke all on public.slack_installations from authenticated, anon;
grant select (id, workspace_id, team_id, team_name, channel_id, channel_name, created_at) on public.slack_installations to authenticated;

-- Who is this Slack user in Sprint Agent? Slack gives us a verified email; we map it to a member of
-- the linked workspace. Service role only: it reads auth.users.
create or replace function public.member_by_email(ws uuid, member_email text)
returns table (user_id uuid, role public.workspace_role)
language sql stable security definer set search_path = '' as $$
  select m.user_id, m.role
  from public.workspace_members m
  join auth.users u on u.id = m.user_id
  where m.workspace_id = ws and lower(u.email) = lower(member_email) and u.email_confirmed_at is not null
  limit 1
$$;
revoke all on function public.member_by_email(uuid, text) from public, anon, authenticated;
grant execute on function public.member_by_email(uuid, text) to service_role;
