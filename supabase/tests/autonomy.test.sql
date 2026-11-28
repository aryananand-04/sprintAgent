-- SPDX-License-Identifier: FSL-1.1-ALv2
-- SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
-- Earned Autonomy: evidence is written by the server, resolved only by what people do, and the
-- decision log is a tamper-evident chain. Run: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

create function pg_temp.login(email text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users u where u.email = login.email), 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;
create function pg_temp.logout() returns void language plpgsql as $$
begin execute 'reset role'; perform set_config('request.jwt.claims', '', true); end $$;
create function pg_temp.affected(stmt text) returns int language plpgsql as $$
declare n int;
begin execute format('with x as (%s returning 1) select count(*)::int from x', stmt) into n; return n; end $$;

-- Fixtures (as the server): two unassigned tasks with predictions, one licence row.
insert into public.tasks (id, workspace_id, title, type, status, urgency, impact, effort, risk, clarity) values
  ('00000000-0000-4000-8000-00000000a001', md5('demo-workspace')::uuid, 'Shadow task', 'bug', 'triaged', 'medium', 3, 2, 2, 4),
  ('00000000-0000-4000-8000-00000000a002', md5('demo-workspace')::uuid, 'Acted task', 'bug', 'triaged', 'medium', 3, 2, 2, 4),
  ('00000000-0000-4000-8000-00000000a003', md5('demo-workspace')::uuid, 'Agent moves', 'chore', 'triaged', 'medium', 3, 2, 2, 4);
insert into public.predictions (workspace_id, task_id, task_type, action, mode, predicted_member_id, rationale) values
  (md5('demo-workspace')::uuid, '00000000-0000-4000-8000-00000000a001', 'bug', 'assign', 'shadow', md5('ananya')::uuid, 'skills'),
  (md5('demo-workspace')::uuid, '00000000-0000-4000-8000-00000000a003', 'chore', 'assign', 'shadow', md5('ananya')::uuid, 'skills');
update public.tasks set assignee_id = md5('ananya')::uuid where id = '00000000-0000-4000-8000-00000000a002';
insert into public.predictions (workspace_id, task_id, task_type, action, mode, predicted_member_id, rationale) values
  (md5('demo-workspace')::uuid, '00000000-0000-4000-8000-00000000a002', 'bug', 'assign', 'acted', md5('ananya')::uuid, 'skills');
insert into public.autonomy_licenses (workspace_id, task_type, action) values (md5('demo-workspace')::uuid, 'ad-hoc', 'assign');

-- ── Who can read and write ───────────────────────────────────────────
select pg_temp.login('viewer@demo.sprintagent.dev');
select ok((select count(*) from public.predictions) >= 3, 'viewers can see predictions (suggestions are public to the team)');
select is((select earned_level from public.autonomy_licenses where task_type = 'ad-hoc'), 1::smallint, 'viewers can see licences');
select throws_ok($q$insert into public.predictions (workspace_id, task_id, task_type, action, mode, rationale) values (md5('demo-workspace')::uuid, '00000000-0000-4000-8000-00000000a001', 'bug', 'rebalance', 'shadow', 'x')$q$, '42501', null, 'nobody can write evidence directly');
select pg_temp.logout();

select pg_temp.login('pm@demo.sprintagent.dev');
select throws_ok($q$update public.predictions set outcome = 'agree'$q$, '42501', null, 'PMs cannot mark predictions right');
select throws_ok($q$update public.autonomy_licenses set cap = 0$q$, '42501', null, 'PMs cannot change the ceiling');
select pg_temp.logout();

select pg_temp.login('admin@demo.sprintagent.dev');
select throws_ok($q$update public.autonomy_licenses set cap = 1 where task_type = 'ad-hoc'$q$, '42501', null, 'ceilings change only through the server, which checks the plan');
select throws_ok($q$update public.autonomy_licenses set earned_level = 3$q$, '42501', null, 'admins cannot grant autonomy that was not earned');

-- ── Evidence comes from what people do ───────────────────────────────
update public.tasks set assignee_id = md5('ananya')::uuid where id = '00000000-0000-4000-8000-00000000a001';
select is((select outcome::text from public.predictions where task_id = '00000000-0000-4000-8000-00000000a001'), 'agree', 'a person assigning the predicted member: agreement');
select isnt((select resolved_by from public.predictions where task_id = '00000000-0000-4000-8000-00000000a001'), null, 'and we know who decided');
update public.tasks set assignee_id = md5('dev')::uuid where id = '00000000-0000-4000-8000-00000000a002';
select is((select outcome::text from public.predictions where task_id = '00000000-0000-4000-8000-00000000a002'), 'disagree', 'a person moving the agent''s assignment: disagreement');
select pg_temp.logout();

-- The server reassigning doesn't count either way.
update public.tasks set assignee_id = md5('dev')::uuid where id = '00000000-0000-4000-8000-00000000a003';
select is((select outcome::text from public.predictions where task_id = '00000000-0000-4000-8000-00000000a003'), 'expired', 'the agent cannot resolve its own predictions');

-- An acted prediction that survives to in-progress is agreement.
update public.tasks set assignee_id = md5('ananya')::uuid where id = '00000000-0000-4000-8000-00000000a003';
insert into public.predictions (workspace_id, task_id, task_type, action, mode, predicted_member_id, rationale) values
  (md5('demo-workspace')::uuid, '00000000-0000-4000-8000-00000000a003', 'chore', 'assign', 'acted', md5('ananya')::uuid, 'skills');
select pg_temp.login('pm@demo.sprintagent.dev');
update public.tasks set status = 'in-progress' where id = '00000000-0000-4000-8000-00000000a003';
select pg_temp.logout();
select is((select outcome::text from public.predictions where task_id = '00000000-0000-4000-8000-00000000a003' and mode = 'acted'), 'agree', 'the agent''s choice stood until work started: agreement');

-- ── Trust ledger ─────────────────────────────────────────────────────
insert into public.decisions (workspace_id, task_id, kind, source, decision, rationale)
  values (md5('demo-workspace')::uuid, '00000000-0000-4000-8000-00000000a001', 'assign', 'rules', 'ACT', 'ledger 1'),
         (md5('demo-workspace')::uuid, null, 'license', 'rules', null, 'ledger 2');
select is((select ok from public.verify_decision_chain(md5('demo-workspace')::uuid)), true, 'the chain verifies');
select throws_ok($q$update public.decisions set rationale = 'edited' where rationale = 'ledger 1'$q$, '42501', null, 'the log is append-only, even for the server');
delete from public.tasks where id = '00000000-0000-4000-8000-00000000a001';
select is((select ok from public.verify_decision_chain(md5('demo-workspace')::uuid)), true, 'deleting a task does not break the chain');

select pg_temp.login('dev@demo.sprintagent.dev');
select throws_ok($q$select * from public.verify_decision_chain(md5('demo-workspace')::uuid)$q$, '42501', null, 'contributors cannot run the audit check');
select pg_temp.logout();
select pg_temp.login('pm@demo.sprintagent.dev');
select is((select ok from public.verify_decision_chain(md5('demo-workspace')::uuid)), true, 'PMs can');
select pg_temp.logout();

select * from finish();
rollback;
