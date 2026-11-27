-- Integrations hold webhook URLs (secrets): admins only.
-- Outbox is written and delivered by the server (service role); PMs may read delivery status.

alter table public.integrations enable row level security;
alter table public.outbox enable row level security;

create policy integrations_select on public.integrations for select to authenticated using (app.has_role(workspace_id, 'admin'));
create policy integrations_insert on public.integrations for insert to authenticated with check (app.has_role(workspace_id, 'admin'));
create policy integrations_update on public.integrations for update to authenticated
  using (app.has_role(workspace_id, 'admin')) with check (app.has_role(workspace_id, 'admin'));
create policy integrations_delete on public.integrations for delete to authenticated using (app.has_role(workspace_id, 'admin'));

create policy outbox_select on public.outbox for select to authenticated using (app.has_role(workspace_id, 'pm'));
revoke insert, update, delete on public.outbox from authenticated;

create trigger integrations_touch before update on public.integrations for each row execute function app.touch_updated_at();
create trigger integrations_ws_immutable before update on public.integrations for each row execute function app.forbid_workspace_change();

-- Integration URLs must be https.
alter table public.integrations add constraint integrations_url_https check (url ~ '^https://');
