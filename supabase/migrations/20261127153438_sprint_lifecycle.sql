-- 1) Requesters can complete their own unassigned ticket (agent triage/auto-assign runs in their session).
-- 2) start_new_sprint(): archive the active sprint and roll unfinished work forward atomically.

drop policy tasks_update on public.tasks;
create policy tasks_update on public.tasks for update to authenticated
  using (
    app.has_role(workspace_id, 'pm')
    or (app.has_role(workspace_id, 'contributor')
        and (app.is_own_task(assignee_id) or (assignee_id is null and created_by = (select auth.uid()))))
  )
  with check (
    app.has_role(workspace_id, 'pm')
    or (app.has_role(workspace_id, 'contributor')
        and (app.is_own_task(assignee_id) or created_by = (select auth.uid())))
  );

create or replace function public.start_new_sprint(
  p_workspace uuid, p_name text, p_goal text, p_start date, p_end date,
  p_committed int, p_velocity int, p_snapshot jsonb default '{}'::jsonb
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  old_id uuid;
  new_id uuid;
  task_count int;
  done_count int;
  esc_count int;
begin
  if not app.has_role(p_workspace, 'pm') then
    raise exception 'insufficient role' using errcode = '42501';
  end if;
  if p_end < p_start then raise exception 'end before start' using errcode = '22023'; end if;

  select id into old_id from public.sprints
    where workspace_id = p_workspace and status = 'active' for update;

  if old_id is not null then
    select count(*), count(*) filter (where status = 'done') into task_count, done_count
      from public.tasks where sprint_id = old_id;
    select count(*) into esc_count from public.escalations e
      join public.tasks t on t.id = e.task_id where t.sprint_id = old_id;

    update public.sprints
       set status = 'archived',
           velocity = p_velocity,
           snapshot = jsonb_build_object('taskCount', task_count, 'doneCount', done_count,
                                         'escalationCount', esc_count, 'full', p_snapshot)
     where id = old_id;

    update public.escalations set resolved_at = now(), resolution = 'Closed at sprint end'
     where workspace_id = p_workspace and resolved_at is null;
  end if;

  insert into public.sprints (workspace_id, name, goal, status, start_date, end_date,
                              total_points, committed_points, velocity)
  values (p_workspace, p_name, coalesce(p_goal, ''), 'active', p_start, p_end,
          p_committed + 20, p_committed, p_velocity)
  returning id into new_id;

  update public.tasks
     set sprint_id = new_id, status = 'backlog', assignee_id = null, decision = null,
         decision_reason = null, is_ai_triaged = false
   where workspace_id = p_workspace and status <> 'done'
     and (sprint_id = old_id or sprint_id is null);

  return new_id;
end;
$$;

revoke execute on function public.start_new_sprint(uuid, text, text, date, date, int, int, jsonb) from public, anon;
grant execute on function public.start_new_sprint(uuid, text, text, date, date, int, int, jsonb) to authenticated;
