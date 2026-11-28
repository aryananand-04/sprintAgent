-- Billing is written only by the server (Stripe webhooks, checkout). Members may see the plan; PMs may
-- see usage. Stripe ids are never readable from the browser.
alter table public.workspace_billing enable row level security;
create policy workspace_billing_select on public.workspace_billing for select to authenticated using (app.has_role(workspace_id, 'viewer'));
revoke all on public.workspace_billing from authenticated, anon;
grant select (workspace_id, plan, status, current_period_end, trial_ends_at, trial_used, cancel_at_period_end, seats, updated_at)
  on public.workspace_billing to authenticated;
create trigger workspace_billing_touch before update on public.workspace_billing for each row execute function app.touch_updated_at();

alter table public.ai_usage enable row level security;
create policy ai_usage_select on public.ai_usage for select to authenticated using (app.has_role(workspace_id, 'pm'));
revoke all on public.ai_usage from authenticated, anon;
grant select on public.ai_usage to authenticated;

alter table public.contributor_activity enable row level security;
create policy contributor_activity_select on public.contributor_activity for select to authenticated using (app.has_role(workspace_id, 'pm'));
revoke all on public.contributor_activity from authenticated, anon;
grant select on public.contributor_activity to authenticated;

-- One AI call against the month's allowance, atomically: concurrent callers can't overshoot the cap.
-- p_cap null means no limit (still counted).
create or replace function public.consume_ai_call(p_ws uuid, p_month text, p_cap int)
returns boolean language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if p_cap is not null and p_cap <= 0 then return false; end if;
  insert into public.ai_usage as u (workspace_id, month, calls) values (p_ws, p_month, 1)
  on conflict (workspace_id, month) do update set calls = u.calls + 1
    where p_cap is null or u.calls < p_cap
  returning calls into n;
  return n is not null;
end $$;
revoke execute on function public.consume_ai_call(uuid, text, int) from public, anon, authenticated;
grant execute on function public.consume_ai_call(uuid, text, int) to service_role;

-- Active contributors: whoever is assigned work, and whoever changes a task, in a calendar month (UTC).
create or replace function app.track_contributor()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  m text := to_char(now() at time zone 'utc', 'YYYY-MM');
  me uuid;
begin
  if new.assignee_id is not null and (tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id) then
    insert into public.contributor_activity (workspace_id, month, member_id) values (new.workspace_id, m, new.assignee_id)
    on conflict do nothing;
  end if;
  if auth.uid() is not null then
    select id into me from public.team_members where workspace_id = new.workspace_id and user_id = auth.uid();
    if me is not null then
      insert into public.contributor_activity (workspace_id, month, member_id) values (new.workspace_id, m, me)
      on conflict do nothing;
    end if;
  end if;
  return null;
end $$;
create trigger tasks_track_contributor after insert or update on public.tasks
  for each row execute function app.track_contributor();

-- Ceilings now go through the server, which checks the plan (per-type ceilings are a Business feature;
-- one ceiling for everything is on every plan, because restraining the agent should never cost extra).
drop policy licenses_cap on public.autonomy_licenses;
revoke update on public.autonomy_licenses from authenticated;
