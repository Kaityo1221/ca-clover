-- Read-only access isolation smoke test using the production RLS policy
-- expressions observed on 2026-10-10. Synthetic IDs only; disposable PG16.
-- This is NOT a migration and does NOT install anything in production.
\set ON_ERROR_STOP on
begin;

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create schema private;

create table public.profiles(
  id uuid primary key,
  role text not null
);
create table public.user_ca_identities(
  user_id uuid not null references public.profiles(id),
  ca_member_id uuid not null,
  community_id uuid not null,
  is_primary boolean not null,
  primary key(user_id,ca_member_id,community_id)
);
create table public.stamp_collections(
  id uuid primary key,
  owner_user_id uuid not null references public.profiles(id),
  community_id uuid not null
);
create table public.sync_automation_state(
  id smallint primary key,
  enabled boolean not null default true,
  ca_master_sync_enabled boolean not null default false
);

-- Synthetic profiles (admin, regular CA, other CA) and owned records.
insert into public.profiles values
 ('00000000-0000-4000-8000-000000000001','admin'),
 ('00000000-0000-4000-8000-000000000002','ca'),
 ('00000000-0000-4000-8000-000000000003','ca');
insert into public.user_ca_identities values
 ('00000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000002',true),
 ('00000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000003',
  '20000000-0000-4000-8000-000000000003',true);
insert into public.stamp_collections values
 ('30000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000002'),
 ('30000000-0000-4000-8000-000000000003',
  '00000000-0000-4000-8000-000000000003',
  '20000000-0000-4000-8000-000000000003');
insert into public.sync_automation_state(id) values(1);

-- auth.uid() test shim reads only fake request claims.
create function auth.uid()
returns uuid language sql stable as $uid$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
$uid$;

-- Body copied from production private.is_admin(), backed by fake profiles.
create function private.is_admin()
returns boolean language sql stable security definer
set search_path to 'public','pg_temp' as $fn$
  select exists(
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  );
$fn$;

grant usage on schema auth,private to authenticated,anon;
grant execute on function auth.uid() to authenticated,anon;
grant execute on function private.is_admin() to authenticated;
grant select on public.user_ca_identities,public.stamp_collections,
                public.sync_automation_state to authenticated;
grant select on public.user_ca_identities,public.stamp_collections,
                public.sync_automation_state to service_role;

alter table public.user_ca_identities enable row level security;
alter table public.stamp_collections enable row level security;
alter table public.sync_automation_state enable row level security;

-- Production policies' exact authorization expressions.
create policy "ca identity self or admin read"
on public.user_ca_identities for select to authenticated
using ((user_id = (select auth.uid())) or private.is_admin());

create policy "stamp collections owner or admin read"
on public.stamp_collections for select to authenticated
using ((owner_user_id = (select auth.uid())) or private.is_admin());

create policy "automation state admin read"
on public.sync_automation_state for select to authenticated
using (private.is_admin());

-- Unauthenticated users must not even have table privileges.
do $test$
begin
  if has_table_privilege('anon','public.user_ca_identities','SELECT')
     or has_table_privilege('anon','public.stamp_collections','SELECT')
     or has_table_privilege('anon','public.sync_automation_state','SELECT') then
    raise exception 'FAIL: anon is allowed to read protected data';
  end if;
  if has_table_privilege('authenticated','public.stamp_collections','INSERT')
     or has_table_privilege('authenticated','public.user_ca_identities','DELETE')
     or has_table_privilege('authenticated','public.sync_automation_state','UPDATE') then
    raise exception 'FAIL: ordinary CA can modify protected data';
  end if;
  raise notice 'PASS: anon blocked, normal CA cannot mutate protected rows';
end $test$;

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
do $test$
begin
  if (select count(*) from public.user_ca_identities)<>1
     or (select count(*) from public.stamp_collections)<>1
     or (select count(*) from public.sync_automation_state)<>0
     or (select count(*) from public.user_ca_identities
         where user_id='00000000-0000-4000-8000-000000000003')<>0
     or (select count(*) from public.stamp_collections
         where owner_user_id='00000000-0000-4000-8000-000000000003')<>0 then
    raise exception 'FAIL: regular CA can access another CA record';
  end if;
  raise notice 'PASS: first CA sees only own identity/medal, not sync controls';
end $test$;

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
do $test$
begin
  if (select count(*) from public.user_ca_identities)<>1
     or (select count(*) from public.stamp_collections)<>1
     or (select count(*) from public.sync_automation_state)<>0 then
    raise exception 'FAIL: second CA has inappropriate access';
  end if;
  raise notice 'PASS: second CA also sees only own records';
end $test$;

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
do $test$
begin
  if (select count(*) from public.user_ca_identities)<>2
     or (select count(*) from public.stamp_collections)<>2
     or (select count(*) from public.sync_automation_state)<>1 then
    raise exception 'FAIL: admin cannot inspect protected records';
  end if;
  raise notice 'PASS: admin read access remains available';
end $test$;

reset role;
set local role service_role;
do $test$
begin
  if (select count(*) from public.user_ca_identities)<>2
     or (select count(*) from public.stamp_collections)<>2
     or (select count(*) from public.sync_automation_state)<>1 then
    raise exception 'FAIL: service role cannot access protected records';
  end if;
  raise notice 'PASS: trusted service role bypasses read RLS';
end $test$;

reset role;
rollback;
