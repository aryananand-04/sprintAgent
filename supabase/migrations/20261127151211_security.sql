-- Security layer: role helpers, tenancy integrity, RLS policies, realtime.
-- Hand-written (drizzle-kit --custom). Role order: viewer < contributor < pm < admin.

create schema if not exists app;
revoke all on schema app from public;
grant usage on schema app to authenticated, service_role;

/* ── Role helper ─────────────────────────────────────────────────────── */
create or replace function app.has_role(ws uuid, min_role public.workspace_role)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws
      and m.user_id = (select auth.uid())
      and m.role >= min_role
  );
$$;

create or replace function app.is_own_task(assignee uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.team_members tm
    where tm.id = assignee and tm.user_id = (select auth.uid())
  );
$$;

grant execute on function app.has_role(uuid, public.workspace_role) to authenticated;
grant execute on function app.is_own_task(uuid) to authenticated;

/* ── Workspace creation (RPC; direct inserts are not allowed) ───────── */
create or replace function public.create_workspace(p_name text, p_slug text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  ws uuid;
begin
  if uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;

  insert into public.workspaces (name, slug, created_by) values (p_name, p_slug, uid) returning id into ws;
  insert into public.workspace_members (workspace_id, user_id, role) values (ws, uid, 'admin');
  insert into public.autonomy_policies (workspace_id, updated_by) values (ws, uid);
  insert into public.calibration (workspace_id, decision)
    select ws, d from unnest(enum_range(null::public.agent_decision)) d;
  return ws;
end;
$$;

revoke execute on function public.create_workspace(text, text) from public, anon;
grant execute on function public.create_workspace(text, text) to authenticated;

/* ── Integrity triggers ──────────────────────────────────────────────── */
-- A workspace must always keep at least one admin.
create or replace function app.keep_one_admin()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if old.role = 'admin' and (tg_op = 'DELETE' or new.role <> 'admin') then
    -- Skip when the whole workspace is being deleted (cascade).
    if exists (select 1 from public.workspaces w where w.id = old.workspace_id)
       and not exists (
         select 1 from public.workspace_members m
         where m.workspace_id = old.workspace_id and m.role = 'admin' and m.user_id <> old.user_id
       ) then
      raise exception 'workspace must keep at least one admin' using errcode = '23514';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger workspace_members_keep_one_admin
  before update or delete on public.workspace_members
  for each row execute function app.keep_one_admin();

-- Rows can never move between workspaces.
create or replace function app.forbid_workspace_change()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.workspace_id is distinct from old.workspace_id then
    raise exception 'workspace_id is immutable' using errcode = '23514';
  end if;
  return new;
end;
$$;

-- Referenced rows must belong to the same workspace (prevents cross-tenant links).
create or replace function app.assert_same_workspace(tbl regclass, ref uuid, ws uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare ok boolean;
begin
  if ref is null then return; end if;
  execute format('select exists (select 1 from %s where id = $1 and workspace_id = $2)', tbl)
    into ok using ref, ws;
  if not ok then
    raise exception 'cross-workspace reference to %', tbl using errcode = '23503';
  end if;
end;
$$;

create or replace function app.check_task_refs()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform app.assert_same_workspace('public.sprints', new.sprint_id, new.workspace_id);
  perform app.assert_same_workspace('public.team_members', new.assignee_id, new.workspace_id);
  perform app.assert_same_workspace('public.tasks', new.ad_hoc_swapped_task_id, new.workspace_id);
  return new;
end;
$$;

create or replace function app.check_task_child_refs()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform app.assert_same_workspace('public.tasks', new.task_id, new.workspace_id);
  if tg_table_name = 'task_dependencies' then
    perform app.assert_same_workspace('public.tasks', new.depends_on_task_id, new.workspace_id);
  end if;
  if tg_table_name = 'feed_events' then
    perform app.assert_same_workspace('public.team_members', new.member_id, new.workspace_id);
  end if;
  return new;
end;
$$;

create trigger tasks_check_refs before insert or update on public.tasks
  for each row execute function app.check_task_refs();

create trigger task_dependencies_check_refs before insert or update on public.task_dependencies
  for each row execute function app.check_task_child_refs();
create trigger task_comments_check_refs before insert or update on public.task_comments
  for each row execute function app.check_task_child_refs();
create trigger escalations_check_refs before insert or update on public.escalations
  for each row execute function app.check_task_child_refs();
create trigger decisions_check_refs before insert on public.decisions
  for each row execute function app.check_task_child_refs();
create trigger feed_events_check_refs before insert on public.feed_events
  for each row execute function app.check_task_child_refs();

do $$
declare t text;
begin
  foreach t in array array['workspace_members','team_members','sprints','tasks','task_dependencies',
                           'task_comments','escalations','calibration']
  loop
    execute format('create trigger %I before update on public.%I for each row execute function app.forbid_workspace_change()',
                   t || '_ws_immutable', t);
  end loop;
end $$;

-- updated_at maintenance
create or replace function app.touch_updated_at()
returns trigger
language plpgsql set search_path = ''
as $$
begin new.updated_at := now(); return new; end;
$$;

create trigger tasks_touch before update on public.tasks for each row execute function app.touch_updated_at();
create trigger autonomy_policies_touch before update on public.autonomy_policies for each row execute function app.touch_updated_at();
create trigger calibration_touch before update on public.calibration for each row execute function app.touch_updated_at();

/* ── Privileges: anon gets nothing ───────────────────────────────────── */
revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;

/* ── RLS ─────────────────────────────────────────────────────────────── */
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.team_members enable row level security;
alter table public.sprints enable row level security;
alter table public.tasks enable row level security;
alter table public.task_dependencies enable row level security;
alter table public.task_comments enable row level security;
alter table public.escalations enable row level security;
alter table public.decisions enable row level security;
alter table public.feed_events enable row level security;
alter table public.autonomy_policies enable row level security;
alter table public.calibration enable row level security;

-- workspaces (insert only via create_workspace)
create policy ws_select on public.workspaces for select to authenticated using (app.has_role(id, 'viewer'));
create policy ws_update on public.workspaces for update to authenticated using (app.has_role(id, 'admin')) with check (app.has_role(id, 'admin'));
create policy ws_delete on public.workspaces for delete to authenticated using (app.has_role(id, 'admin'));

-- workspace_members
create policy wm_select on public.workspace_members for select to authenticated using (app.has_role(workspace_id, 'viewer'));
create policy wm_insert on public.workspace_members for insert to authenticated with check (app.has_role(workspace_id, 'admin'));
create policy wm_update on public.workspace_members for update to authenticated using (app.has_role(workspace_id, 'admin')) with check (app.has_role(workspace_id, 'admin'));
create policy wm_delete on public.workspace_members for delete to authenticated
  using (app.has_role(workspace_id, 'admin') or user_id = (select auth.uid()));

-- team_members, sprints, task_dependencies: read for members, write for PM+
do $$
declare t text;
begin
  foreach t in array array['team_members','sprints','task_dependencies'] loop
    execute format('create policy %I on public.%I for select to authenticated using (app.has_role(workspace_id, ''viewer''))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (app.has_role(workspace_id, ''pm''))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (app.has_role(workspace_id, ''pm'')) with check (app.has_role(workspace_id, ''pm''))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (app.has_role(workspace_id, ''pm''))', t || '_delete', t);
  end loop;
end $$;

-- tasks: contributors create and update their own; PM+ manage all
create policy tasks_select on public.tasks for select to authenticated using (app.has_role(workspace_id, 'viewer'));
create policy tasks_insert on public.tasks for insert to authenticated
  with check (app.has_role(workspace_id, 'contributor') and created_by = (select auth.uid()));
create policy tasks_update on public.tasks for update to authenticated
  using (app.has_role(workspace_id, 'pm') or (app.has_role(workspace_id, 'contributor') and app.is_own_task(assignee_id)))
  with check (app.has_role(workspace_id, 'pm') or (app.has_role(workspace_id, 'contributor') and app.is_own_task(assignee_id)));
create policy tasks_delete on public.tasks for delete to authenticated using (app.has_role(workspace_id, 'pm'));

-- task_comments: authors own their comments
create policy comments_select on public.task_comments for select to authenticated using (app.has_role(workspace_id, 'viewer'));
create policy comments_insert on public.task_comments for insert to authenticated
  with check (app.has_role(workspace_id, 'contributor') and author_id = (select auth.uid()));
create policy comments_update on public.task_comments for update to authenticated
  using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()) and app.has_role(workspace_id, 'contributor'));
create policy comments_delete on public.task_comments for delete to authenticated
  using (author_id = (select auth.uid()) or app.has_role(workspace_id, 'pm'));

-- escalations: anyone contributing can raise; PM+ resolve
create policy esc_select on public.escalations for select to authenticated using (app.has_role(workspace_id, 'viewer'));
create policy esc_insert on public.escalations for insert to authenticated with check (app.has_role(workspace_id, 'contributor'));
create policy esc_update on public.escalations for update to authenticated using (app.has_role(workspace_id, 'pm')) with check (app.has_role(workspace_id, 'pm'));
create policy esc_delete on public.escalations for delete to authenticated using (app.has_role(workspace_id, 'admin'));

-- decisions: append-only audit; humans may only log their own overrides. Agent writes via service role.
create policy decisions_select on public.decisions for select to authenticated using (app.has_role(workspace_id, 'viewer'));
create policy decisions_insert on public.decisions for insert to authenticated
  with check (app.has_role(workspace_id, 'pm') and source = 'human' and actor_id = (select auth.uid()));

-- feed_events: append-only
create policy feed_select on public.feed_events for select to authenticated using (app.has_role(workspace_id, 'viewer'));
create policy feed_insert on public.feed_events for insert to authenticated with check (app.has_role(workspace_id, 'contributor'));

-- autonomy_policies: admins only
create policy policy_select on public.autonomy_policies for select to authenticated using (app.has_role(workspace_id, 'viewer'));
create policy policy_update on public.autonomy_policies for update to authenticated
  using (app.has_role(workspace_id, 'admin')) with check (app.has_role(workspace_id, 'admin'));

-- calibration: read-only for users; written by the agent (service role)
create policy calibration_select on public.calibration for select to authenticated using (app.has_role(workspace_id, 'viewer'));

/* ── Realtime ────────────────────────────────────────────────────────── */
alter publication supabase_realtime add table
  public.tasks, public.escalations, public.feed_events, public.team_members, public.sprints;
