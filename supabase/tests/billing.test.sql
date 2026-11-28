-- SPDX-License-Identifier: FSL-1.1-ALv2
-- SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
-- Billing: written by the server only, Stripe ids hidden, AI allowance consumed atomically, active
-- contributors tracked by trigger. Run: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

create function pg_temp.login(email text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users u where u.email = login.email), 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;
create function pg_temp.logout() returns void language plpgsql as $$
begin execute 'reset role'; perform set_config('request.jwt.claims', '', true); end $$;

-- ── Visibility ──────────────────────────────────────────────────────
select pg_temp.login('viewer@demo.sprintagent.dev');
select is((select plan::text from public.workspace_billing where workspace_id = md5('demo-workspace')::uuid), 'business', 'members can see the plan');
select throws_ok($q$select stripe_customer_id from public.workspace_billing$q$, '42501', null, 'Stripe ids are not readable from the browser');
select is((select count(*)::int from public.ai_usage), 0, 'viewers cannot see usage');
select pg_temp.logout();

select pg_temp.login('admin@demo.sprintagent.dev');
select throws_ok($q$update public.workspace_billing set plan = 'enterprise'$q$, '42501', null, 'not even admins can change the plan directly');
select throws_ok($q$insert into public.ai_usage (workspace_id, month, calls) values (md5('demo-workspace')::uuid, '2000-01', 0)$q$, '42501', null, 'nobody can reset AI usage');
select throws_ok($q$select public.consume_ai_call(md5('demo-workspace')::uuid, '2000-01', 10)$q$, '42501', null, 'only the server consumes AI calls');
select pg_temp.logout();

-- ── AI allowance ────────────────────────────────────────────────────
select ok(public.consume_ai_call(md5('demo-workspace')::uuid, '2000-01', 2) and public.consume_ai_call(md5('demo-workspace')::uuid, '2000-01', 2), 'calls within the allowance succeed');
select ok(not public.consume_ai_call(md5('demo-workspace')::uuid, '2000-01', 2), 'the call past the allowance is refused');
select ok(not public.consume_ai_call(md5('demo-workspace')::uuid, '2000-02', 0), 'a zero allowance refuses without counting');

-- ── Active contributors ─────────────────────────────────────────────
delete from public.contributor_activity where workspace_id = md5('demo-workspace')::uuid;
insert into public.tasks (id, workspace_id, title, type, status, urgency, impact, effort, risk, clarity, assignee_id) values
  ('00000000-0000-4000-8000-00000000b001', md5('demo-workspace')::uuid, 'Billing fixture', 'bug', 'assigned', 'medium', 3, 2, 2, 4, md5('ananya')::uuid);
select is((select array_agg(member_id) from public.contributor_activity where workspace_id = md5('demo-workspace')::uuid), array[md5('ananya')::uuid], 'being assigned work counts');
update public.team_members set user_id = (select id from auth.users where email = 'pm@demo.sprintagent.dev') where id = md5('dev')::uuid;
select pg_temp.login('pm@demo.sprintagent.dev');
update public.tasks set status = 'in-progress' where id = '00000000-0000-4000-8000-00000000b001';
select pg_temp.logout();
select is((select count(*)::int from public.contributor_activity where workspace_id = md5('demo-workspace')::uuid), 2, 'changing a task counts the person who changed it');

select * from finish();
rollback;
