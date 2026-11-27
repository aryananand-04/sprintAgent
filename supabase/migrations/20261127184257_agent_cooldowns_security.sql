-- Cooldowns are server-only bookkeeping: no access for signed-in users.
alter table public.agent_cooldowns enable row level security;
revoke all on public.agent_cooldowns from authenticated;

-- Atomically claim a check: true if it hasn't fired within the cooldown (and records it), false otherwise.
-- Two runners racing on the same workspace can't both win.
create or replace function public.claim_agent_cooldown(ws uuid, check_key text, cooldown_seconds int)
returns boolean language sql security definer set search_path = '' as $$
  insert into public.agent_cooldowns as c (workspace_id, key, fired_at)
  values (ws, check_key, now())
  on conflict (workspace_id, key) do update set fired_at = now()
    where c.fired_at < now() - make_interval(secs => cooldown_seconds)
  returning true;
$$;
revoke execute on function public.claim_agent_cooldown(uuid, text, int) from public, anon, authenticated;
grant execute on function public.claim_agent_cooldown(uuid, text, int) to service_role;
