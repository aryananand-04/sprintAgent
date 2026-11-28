-- ════════════════════════════════════════════════════════════════════════
-- Earned Autonomy: predictions are evidence, licences are earned from it.
-- People can read both; only the server writes them; only a trigger resolves predictions.
-- ════════════════════════════════════════════════════════════════════════

alter table public.predictions enable row level security;
create policy predictions_select on public.predictions for select to authenticated using (app.has_role(workspace_id, 'viewer'));
revoke insert, update, delete on public.predictions from authenticated, anon;

create trigger predictions_check_refs before insert on public.predictions
  for each row execute function app.check_task_child_refs();

alter table public.autonomy_licenses enable row level security;
create policy licenses_select on public.autonomy_licenses for select to authenticated using (app.has_role(workspace_id, 'viewer'));
-- Admins may lower (or restore) the ceiling. Earned levels and evidence are server-only.
revoke insert, update, delete on public.autonomy_licenses from authenticated, anon;
grant update (cap) on public.autonomy_licenses to authenticated;
create policy licenses_cap on public.autonomy_licenses for update to authenticated
  using (app.has_role(workspace_id, 'admin')) with check (app.has_role(workspace_id, 'admin'));
create trigger autonomy_licenses_touch before update on public.autonomy_licenses for each row execute function app.touch_updated_at();

alter publication supabase_realtime add table public.predictions, public.autonomy_licenses;

-- ── Resolving predictions from what people actually do ────────────────
-- Runs on every assignee/status change. auth.uid() is set for people (through RLS) and null for the
-- server, so the agent can never resolve its own predictions in its favour.
create or replace function app.resolve_predictions()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  person uuid := auth.uid();
begin
  if new.assignee_id is distinct from old.assignee_id then
    if person is not null then
      -- Shadow: the first person to assign it decides whether the agent was right.
      update public.predictions
         set outcome = case when new.assignee_id = predicted_member_id then 'agree' else 'disagree' end::public.prediction_outcome,
             actual_member_id = new.assignee_id, resolved_by = person, resolved_at = now()
       where task_id = new.id and outcome is null and mode = 'shadow' and new.assignee_id is not null;
      -- Acted: a person moving (or undoing) the agent's choice is a disagreement.
      update public.predictions
         set outcome = 'disagree', actual_member_id = new.assignee_id, resolved_by = person, resolved_at = now()
       where task_id = new.id and outcome is null and mode = 'acted';
    else
      -- The server moved it (a newer agent action): older open predictions no longer apply.
      update public.predictions set outcome = 'expired', resolved_at = now()
       where task_id = new.id and outcome is null and predicted_member_id is distinct from new.assignee_id;
    end if;
  end if;

  -- The agent's choice stood until the work started (or finished): agreement.
  if new.status in ('in-progress', 'done') and old.status is distinct from new.status then
    update public.predictions
       set outcome = 'agree', actual_member_id = new.assignee_id, resolved_by = person, resolved_at = now()
     where task_id = new.id and outcome is null and mode = 'acted' and predicted_member_id = new.assignee_id;
  end if;
  return null;
end;
$$;

create trigger tasks_resolve_predictions after update of assignee_id, status on public.tasks
  for each row execute function app.resolve_predictions();

-- ── Trust ledger: a hash chain over the decision log ──────────────────
create or replace function app.decision_hash(prev text, d public.decisions)
returns text
language sql immutable set search_path = ''
as $$
  select encode(extensions.digest(concat_ws('|',
    coalesce(prev, ''), d.id::text, d.chain_index::text, d.workspace_id::text, d.kind::text, d.source::text,
    coalesce(d.decision::text, ''), d.rationale, d.payload::text, coalesce(d.subject_id::text, ''),
    coalesce(d.actor_ref::text, ''), (extract(epoch from d.created_at) * 1000000)::bigint::text
  ), 'sha256'), 'hex')
$$;

create or replace function app.chain_decision()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare last record;
begin
  -- One writer per workspace chain at a time, so two inserts can't both claim the same predecessor.
  perform pg_advisory_xact_lock(hashtextextended('decisions:' || new.workspace_id::text, 0));
  select chain_index, hash into last from public.decisions
   where workspace_id = new.workspace_id and chain_index is not null order by chain_index desc limit 1;
  new.subject_id := new.task_id;
  new.actor_ref := new.actor_id;
  new.chain_index := coalesce(last.chain_index, 0) + 1;
  new.prev_hash := last.hash;
  new.hash := app.decision_hash(last.hash, new);
  return new;
end;
$$;

create trigger decisions_chain before insert on public.decisions
  for each row execute function app.chain_decision();

-- Append-only for everyone, the server included. The only change allowed is Postgres nulling task_id
-- or actor_id when that task or user is deleted (the chain hashes the immutable copies instead).
create or replace function app.decisions_immutable()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if (new.id, new.workspace_id, new.kind, new.source, new.decision, new.rationale, new.payload, new.created_at,
      new.subject_id, new.actor_ref, new.chain_index, new.prev_hash, new.hash)
     is distinct from
     (old.id, old.workspace_id, old.kind, old.source, old.decision, old.rationale, old.payload, old.created_at,
      old.subject_id, old.actor_ref, old.chain_index, old.prev_hash, old.hash)
     or (new.task_id is not null and new.task_id is distinct from old.task_id)
     or (new.actor_id is not null and new.actor_id is distinct from old.actor_id) then
    raise exception 'the decision log is append-only' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger decisions_append_only before update on public.decisions
  for each row execute function app.decisions_immutable();

-- Backfill the chain for rows written before the ledger existed, oldest first.
do $$
declare d public.decisions; prev text; idx bigint; ws uuid;
begin
  alter table public.decisions disable trigger decisions_append_only;
  for ws in select distinct workspace_id from public.decisions loop
    prev := null; idx := 0;
    for d in select * from public.decisions where workspace_id = ws order by created_at, id loop
      idx := idx + 1;
      d.subject_id := d.task_id; d.actor_ref := d.actor_id; d.chain_index := idx; d.prev_hash := prev;
      d.hash := app.decision_hash(prev, d);
      update public.decisions set subject_id = d.subject_id, actor_ref = d.actor_ref, chain_index = idx, prev_hash = prev, hash = d.hash where id = d.id;
      prev := d.hash;
    end loop;
  end loop;
  alter table public.decisions enable trigger decisions_append_only;
end $$;


-- Recomputes the chain. Returns how many rows were checked and the first row that doesn't match (if any).
create or replace function public.verify_decision_chain(ws uuid)
returns table (checked bigint, broken_at uuid, ok boolean)
language plpgsql stable security definer set search_path = ''
as $$
declare d public.decisions; prev text; n bigint := 0;
begin
  -- Only signed-in users and the server can call this (grants); signed-in users must be PM+ here.
  if auth.uid() is not null and not app.has_role(ws, 'pm') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  for d in select * from public.decisions where workspace_id = ws order by chain_index loop
    n := n + 1;
    if d.chain_index <> n or d.prev_hash is distinct from prev or d.hash <> app.decision_hash(prev, d) then
      return query select n, d.id, false; return;
    end if;
    prev := d.hash;
  end loop;
  return query select n, null::uuid, true;
end;
$$;
revoke all on function public.verify_decision_chain(uuid) from public, anon;
grant execute on function public.verify_decision_chain(uuid) to authenticated, service_role;
