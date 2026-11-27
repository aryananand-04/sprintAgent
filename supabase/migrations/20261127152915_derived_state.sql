-- Derived state lives in the database so every role sees consistent numbers:
--  * tasks.completed_at is stamped on transition to/from 'done'
--  * sprints.completed_points tracks done story points (any role finishing a task updates it)
--  * new workspaces start with an active sprint and the creator on the team

/* ── completed_at + sprint points ────────────────────────────────────── */
create or replace function app.task_completion()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  was_done boolean := tg_op = 'UPDATE' and old.status = 'done';
  is_done  boolean := new.status = 'done';
  pts int := coalesce(new.story_points, 2);
begin
  if is_done and not was_done then
    new.completed_at := coalesce(new.completed_at, now());
  elsif was_done and not is_done then
    new.completed_at := null;
  end if;

  -- Points leave the old sprint when a done task moves out or reopens.
  if was_done and old.sprint_id is not null and (not is_done or new.sprint_id is distinct from old.sprint_id) then
    update public.sprints set completed_points = greatest(0, completed_points - coalesce(old.story_points, 2))
      where id = old.sprint_id;
  end if;
  -- Points join the sprint when a task becomes done (or a done task moves in).
  if is_done and new.sprint_id is not null and (not was_done or new.sprint_id is distinct from old.sprint_id) then
    update public.sprints set completed_points = completed_points + pts where id = new.sprint_id;
  end if;
  -- Story-point edits on an already-done task.
  if was_done and is_done and new.sprint_id is not distinct from old.sprint_id
     and coalesce(new.story_points, 2) <> coalesce(old.story_points, 2) and new.sprint_id is not null then
    update public.sprints set completed_points = greatest(0, completed_points + pts - coalesce(old.story_points, 2))
      where id = new.sprint_id;
  end if;
  return new;
end;
$$;

create trigger tasks_completion
  before insert or update of status, sprint_id, story_points on public.tasks
  for each row execute function app.task_completion();

create or replace function app.task_completion_delete()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if old.status = 'done' and old.sprint_id is not null then
    update public.sprints set completed_points = greatest(0, completed_points - coalesce(old.story_points, 2))
      where id = old.sprint_id;
  end if;
  return old;
end;
$$;

create trigger tasks_completion_delete
  after delete on public.tasks
  for each row execute function app.task_completion_delete();

/* ── Workspace bootstrap: first sprint + creator as team member ─────── */
create or replace function public.create_workspace(p_name text, p_slug text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  ws uuid;
  display_name text;
begin
  if uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;

  select coalesce(nullif(u.raw_user_meta_data->>'full_name', ''), nullif(u.raw_user_meta_data->>'name', ''),
                  split_part(u.email, '@', 1), 'Me')
    into display_name from auth.users u where u.id = uid;

  insert into public.workspaces (name, slug, created_by) values (p_name, p_slug, uid) returning id into ws;
  insert into public.workspace_members (workspace_id, user_id, role) values (ws, uid, 'admin');
  insert into public.autonomy_policies (workspace_id, updated_by) values (ws, uid);
  insert into public.calibration (workspace_id, decision)
    select ws, d from unnest(enum_range(null::public.agent_decision)) d;
  insert into public.sprints (workspace_id, name, goal, status, start_date, end_date, total_points, committed_points)
    values (ws, 'Sprint 1', '', 'active', current_date, current_date + 13, 40, 20);
  insert into public.team_members (workspace_id, user_id, name, initials, title, skills, capacity, color)
    values (ws, uid, display_name,
            upper(left(regexp_replace(display_name, '[^A-Za-z ]', '', 'g'), 1) ||
                  coalesce(left(split_part(display_name, ' ', 2), 1), '')),
            'Team lead', '{}', 20, 'bg-blue-500');
  return ws;
end;
$$;

/* ── Realtime for comments too ───────────────────────────────────────── */
alter publication supabase_realtime add table public.task_comments;
