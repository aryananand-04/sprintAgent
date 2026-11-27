-- RLS & integrity tests. Run: npm run db:test
begin;
create extension if not exists pgtap with schema extensions;
select plan(23);

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
select pg_temp.logout();

select throws_ok(
  $$update public.tasks set assignee_id = (select id from public.team_members limit 1)
    where workspace_id = md5('demo-workspace')::uuid and id = md5('task-1')::uuid;
    insert into public.team_members (workspace_id, name, initials, title, color)
    select id, 'X', 'X', 'X', 'x' from public.workspaces where slug = 'other-ws';
    update public.tasks set assignee_id = (select tm.id from public.team_members tm join public.workspaces w on w.id = tm.workspace_id where w.slug = 'other-ws')
    where id = md5('task-1')::uuid$$,
  '23503', null, 'cross-workspace assignee is rejected');

select * from finish();
rollback;
