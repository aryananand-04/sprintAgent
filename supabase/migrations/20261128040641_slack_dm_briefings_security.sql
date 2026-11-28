-- PMs may see whether daily DMs are on (the toggle itself goes through the admin-only server route).
grant select (dm_briefings) on public.slack_installations to authenticated;

-- Emails of a workspace's confirmed members, so the agent can find them in Slack. Service role only.
create or replace function public.member_emails(ws uuid)
returns table (user_id uuid, email text)
language sql stable security definer set search_path = '' as $$
  select m.user_id, u.email::text
  from public.workspace_members m
  join auth.users u on u.id = m.user_id
  where m.workspace_id = ws and u.email is not null and u.email_confirmed_at is not null
$$;
revoke all on function public.member_emails(uuid) from public, anon, authenticated;
grant execute on function public.member_emails(uuid) to service_role;
