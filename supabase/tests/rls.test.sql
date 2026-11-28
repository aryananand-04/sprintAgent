-- SPDX-License-Identifier: FSL-1.1-ALv2
-- SPDX-FileCopyrightText: 2026 Akchhya Singh & Aryan Anand
-- RLS & integrity tests. Run: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;
select plan(52);

-- Fixtures: a second workspace + outsider user
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000aa', 'outsider@test.dev', 'authenticated', 'authenticated');

create function pg_temp.login(email text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users u where u.email = login.email), 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create function pg_temp.affected(stmt text) returns int language plpgsql as $$
declare n int;
begin execute format('with x as (%s returning 1) select count(*)::int from x', stmt) into n; return n; end $$;

create function pg_temp.logout() returns void language plpgsql as $$
begin execute 'reset role'; perform set_config('request.jwt.claims', '', true); end $$;

-- ── anon & outsider see nothing ─────────────────────────────────────
set local role anon;
select throws_ok('select count(*) from public.tasks', '42501', null, 'anon has no table privileges');
reset role;

select pg_temp.login('outsider@test.dev');
select is((select count(*)::int from public.tasks), 0, 'outsider sees no tasks');
select is((select count(*)::int from public.workspaces), 0, 'outsider sees no workspaces');
select pg_temp.logout();

-- ── viewer: read-only ───────────────────────────────────────────────
select pg_temp.login('viewer@demo.sprintagent.dev');
select is((select count(*)::int from public.tasks), 18, 'viewer reads all workspace tasks');
select is(pg_temp.affected($q$update public.tasks set title = 'x'$q$), 0, 'viewer cannot update tasks');
select throws_ok(
  $$insert into public.feed_events (workspace_id, type, message) values (md5('demo-workspace')::uuid, 'status', 'x')$$,
  '42501', null, 'viewer cannot write feed');
select pg_temp.logout();

-- ── contributor: own tasks only ─────────────────────────────────────
select pg_temp.login('dev@demo.sprintagent.dev');
select ok(
  pg_temp.affected($q$update public.tasks set status = 'done'
     where assignee_id = md5('arjun')::uuid$q$) > 0,
  'contributor updates own tasks');
select is(
  pg_temp.affected($q$update public.tasks set status = 'done'
     where assignee_id is distinct from md5('arjun')::uuid$q$),
  0, 'contributor cannot update others'' tasks');
select throws_ok(
  $$update public.tasks set assignee_id = md5('ananya')::uuid where assignee_id = md5('arjun')::uuid$$,
  '42501', null, 'contributor cannot hand own task to someone else');
select lives_ok(
  $$insert into public.tasks (workspace_id, title, type, impact, effort, risk, clarity, created_by)
    values (md5('demo-workspace')::uuid, 'New', 'bug', 3, 2, 2, 4, md5('user-contrib')::uuid)$$,
  'contributor can create tasks');
select is(pg_temp.affected($q$update public.escalations set resolved_at = now()$q$), 0,
  'contributor cannot resolve escalations');
select is(pg_temp.affected($q$update public.autonomy_policies set act_min_clarity = 5$q$), 0,
  'contributor cannot change autonomy policy');
select pg_temp.logout();

-- ── pm: manages work, not policy ────────────────────────────────────
select pg_temp.login('pm@demo.sprintagent.dev');
select ok(pg_temp.affected($q$update public.tasks set urgency = 'high'$q$) = 19, 'pm updates any task');
select ok(pg_temp.affected($q$update public.escalations set resolved_at = now()$q$) > 0, 'pm resolves escalations');
select is(pg_temp.affected($q$update public.autonomy_policies set act_min_clarity = 4$q$), 0,
  'pm cannot change autonomy policy');
select pg_temp.logout();

-- ── admin: policy yes, audit log immutable ──────────────────────────
select pg_temp.login('admin@demo.sprintagent.dev');
select ok(pg_temp.affected($q$update public.autonomy_policies set act_min_clarity = 4$q$) = 1, 'admin changes policy');
select is(pg_temp.affected($q$update public.feed_events set message = 'tampered'$q$), 0,
  'feed is append-only even for admins');
select is(pg_temp.affected($q$delete from public.feed_events$q$), 0, 'feed cannot be deleted');
select throws_ok(
  $$update public.workspace_members set role = 'pm' where user_id = md5('user-admin')::uuid$$,
  '23514', null, 'last admin cannot be demoted');
select pg_temp.logout();

-- ── integrity ───────────────────────────────────────────────────────
select pg_temp.login('outsider@test.dev');
select lives_ok($$select public.create_workspace('Other', 'other-ws')$$, 'any user can create a workspace');
select is((select role::text from public.workspace_members where user_id = auth.uid()), 'admin', 'creator becomes admin');
select is((select count(*)::int from public.calibration), 3, 'new workspace gets calibration rows');
select is((select count(*)::int from public.sprints where status = 'active'), 1, 'new workspace starts with an active sprint');
select is((select count(*)::int from public.team_members where user_id = auth.uid()), 1, 'creator joins the team');
select pg_temp.logout();

select throws_ok(
  $$update public.tasks set assignee_id = (select id from public.team_members limit 1)
    where workspace_id = md5('demo-workspace')::uuid and id = md5('task-1')::uuid;
    update public.tasks set assignee_id = (select tm.id from public.team_members tm join public.workspaces w on w.id = tm.workspace_id where w.slug = 'other-ws')
    where id = md5('task-1')::uuid$$,
  '23503', null, 'cross-workspace assignee is rejected');

-- ── derived sprint points (any role finishing work updates the sprint) ──
select pg_temp.login('dev@demo.sprintagent.dev');
create temp table pts_before as select completed_points p from public.sprints where status = 'active' and workspace_id = md5('demo-workspace')::uuid;
update public.tasks set status = 'in-progress' where id = (
  select id from public.tasks where assignee_id = md5('arjun')::uuid and status = 'done' limit 1);
select pg_temp.logout();
select ok((select completed_points from public.sprints where id = md5('sprint-23')::uuid) < (select p from pts_before),
  'reopening a done task removes its points');
select pg_temp.login('dev@demo.sprintagent.dev');
update public.tasks set status = 'done' where assignee_id = md5('arjun')::uuid;
select pg_temp.logout();
select is((select completed_points from public.sprints where id = md5('sprint-23')::uuid), (select p from pts_before),
  'contributor finishing the task again restores sprint points exactly');
select ok((select bool_and(completed_at is not null) from public.tasks where status = 'done'), 'done tasks get completed_at');
select is((select count(*)::int from public.tasks where status <> 'done' and completed_at is not null), 0,
  'non-done tasks have no completed_at');

-- ── requester can complete their own unassigned ticket, not others' ──
select pg_temp.login('dev@demo.sprintagent.dev');
insert into public.tasks (id, workspace_id, title, type, impact, effort, risk, clarity, created_by)
values ('00000000-0000-0000-0000-0000000000c1', md5('demo-workspace')::uuid, 'Mine', 'bug', 3, 2, 2, 4, md5('user-contrib')::uuid);
select is(pg_temp.affected($q$update public.tasks set decision = 'ACT', assignee_id = md5('ananya')::uuid
  where id = '00000000-0000-0000-0000-0000000000c1'$q$), 1, 'requester can triage + assign own new ticket');
select is(pg_temp.affected($q$update public.tasks set title = 'hijack'
  where id = '00000000-0000-0000-0000-0000000000c1'$q$), 0, 'once assigned to someone else, requester loses edit');
select pg_temp.logout();

-- ── start_new_sprint ─────────────────────────────────────────────────
select pg_temp.login('dev@demo.sprintagent.dev');
select throws_ok($q$select public.start_new_sprint(md5('demo-workspace')::uuid, 'S24', '', current_date, current_date + 13, 30, 40)$q$,
  '42501', null, 'contributor cannot start a sprint');
select pg_temp.logout();
select pg_temp.login('pm@demo.sprintagent.dev');
select lives_ok($q$select public.start_new_sprint(md5('demo-workspace')::uuid, 'S24', 'g', current_date, current_date + 13, 30, 40)$q$,
  'pm starts a new sprint');
select pg_temp.logout();
select is((select name from public.sprints where workspace_id = md5('demo-workspace')::uuid and status = 'active'), 'S24',
  'new sprint is the only active one');
select is((select count(*)::int from public.tasks where sprint_id = md5('sprint-23')::uuid and status <> 'done'), 0,
  'unfinished work rolled into the new sprint');

-- ── integrations (admin only) & outbox (server writes, PM reads) ─────
select pg_temp.login('admin@demo.sprintagent.dev');
select is(pg_temp.affected($q$insert into public.integrations (workspace_id, kind, url)
  values (md5('demo-workspace')::uuid, 'slack_webhook', 'https://hooks.slack.com/services/T/B/x')$q$), 1, 'admin can add an integration');
select throws_ok($q$insert into public.integrations (workspace_id, kind, url)
  values (md5('demo-workspace')::uuid, 'outbound_webhook', 'http://insecure.example')$q$, '23514', null, 'integration URLs must be https');
select pg_temp.logout();

select pg_temp.login('pm@demo.sprintagent.dev');
select is((select count(*)::int from public.integrations), 0, 'PM cannot read webhook URLs');
select throws_ok($q$insert into public.outbox (workspace_id, integration_id, event, payload)
  select workspace_id, id, 'x', '{}' from public.integrations$q$, '42501', null, 'PM cannot write the outbox');
select pg_temp.logout();

insert into public.outbox (workspace_id, integration_id, event, payload)
  select workspace_id, id, 'escalation', '{}'::jsonb from public.integrations where kind = 'slack_webhook';
select pg_temp.login('pm@demo.sprintagent.dev');
select is((select count(*)::int from public.outbox), 1, 'PM can read delivery status');
select pg_temp.logout();

select pg_temp.login('dev@demo.sprintagent.dev');
select is((select count(*)::int from public.outbox), 0, 'contributor cannot read the outbox');
select is((select count(*)::int from public.integrations), 0, 'contributor cannot read integrations');
select pg_temp.logout();

-- ── agent cooldowns are server-only ─────────────────────────────────
select pg_temp.login('admin@demo.sprintagent.dev');
select throws_ok('select count(*) from public.agent_cooldowns', '42501', null, 'users cannot read agent cooldowns');
select throws_ok($q$select public.claim_agent_cooldown(md5('demo-workspace')::uuid, 'x', 60)$q$, '42501', null, 'users cannot claim agent cooldowns');
select pg_temp.logout();

-- ── Slack installs: PMs see the link, nobody sees the token ─────────
insert into public.slack_installations (workspace_id, team_id, team_name, bot_user_id, bot_token_sealed, channel_name)
  values (md5('demo-workspace')::uuid, 'T0TEST', 'Acme', 'U0BOT', 'v1.sealed', '#eng');
select pg_temp.login('pm@demo.sprintagent.dev');
select is((select team_name from public.slack_installations), 'Acme', 'PM sees the linked Slack team');
select throws_ok('select bot_token_sealed from public.slack_installations', '42501', null, 'PM cannot read the sealed bot token');
select is((select dm_briefings from public.slack_installations), false, 'PM sees whether daily DMs are on (off by default)');
select pg_temp.logout();
select pg_temp.login('admin@demo.sprintagent.dev');
select throws_ok('select * from public.slack_installations', '42501', null, 'not even admins can select the token column');
select throws_ok($q$update public.slack_installations set channel_name = 'x'$q$, '42501', null, 'admins cannot edit the install directly');
select throws_ok($q$select * from public.member_emails(md5('demo-workspace')::uuid)$q$, '42501', null, 'users cannot list member emails');
select throws_ok($q$select * from public.member_by_email(md5('demo-workspace')::uuid, 'pm@demo.sprintagent.dev')$q$, '42501', null, 'users cannot look members up by email');
select pg_temp.logout();
select pg_temp.login('dev@demo.sprintagent.dev');
select is((select count(*)::int from public.slack_installations), 0, 'contributors do not see the Slack link');
select pg_temp.logout();

select * from finish();
rollback;
