-- GitHub links are created and removed by the server (after verifying the installation); PMs can see them.
alter table public.github_installations enable row level security;
create policy github_installations_select on public.github_installations for select to authenticated using (app.has_role(workspace_id, 'pm'));
revoke insert, update, delete on public.github_installations from authenticated;
