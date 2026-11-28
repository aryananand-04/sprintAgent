-- Linear/Jira links are created by the server after OAuth. PMs may see what's linked; nobody can read tokens.
alter table public.tracker_connections enable row level security;
create policy tracker_connections_select on public.tracker_connections for select to authenticated using (app.has_role(workspace_id, 'pm'));
revoke all on public.tracker_connections from authenticated, anon;
grant select (id, workspace_id, kind, name, site_url, write_back, created_at) on public.tracker_connections to authenticated;
