-- Synthetic data ONLY. Disposable PostgreSQL service, not production.
-- Exercise the *actual* review RPC SQL, including fail-closed gate and FK.
\set ON_ERROR_STOP on
begin;

create role anon nologin;
create role authenticated nologin;
create role service_role nologin;

create table public.sync_automation_state(
  id smallint primary key,
  enabled boolean not null default true,
  ca_master_sync_enabled boolean not null default false
);
create table public.communities(id uuid primary key);
create table public.ca_members(id uuid primary key);
create table public.community_ca_members(
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  ca_member_id uuid not null references public.ca_members(id) on delete cascade,
  unique(community_id,ca_member_id)
);
create table public.user_ca_identities(
  user_id text not null,
  community_id uuid not null,
  ca_member_id uuid not null,
  is_primary boolean not null default false,
  primary key(user_id,community_id,ca_member_id),
  constraint user_ca_identities_community_id_ca_member_id_fkey
    foreign key(community_id,ca_member_id)
    references public.community_ca_members(community_id,ca_member_id)
    on delete cascade
);
create table public.stamp_collections(
  id text primary key,owner_user_id text not null
);
insert into public.sync_automation_state(id) values(1);
insert into public.communities(id) values
 ('10000000-0000-4000-8000-000000000001'),
 ('10000000-0000-4000-8000-000000000002'),
 ('10000000-0000-4000-8000-000000000003');
insert into public.ca_members(id) values
 ('20000000-0000-4000-8000-000000000001'),
 ('20000000-0000-4000-8000-000000000002');
insert into public.community_ca_members(community_id,ca_member_id) values
 ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001'),
 ('10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002');
insert into public.user_ca_identities(user_id,community_id,ca_member_id,is_primary) values
 ('tester','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',true);
insert into public.stamp_collections(id,owner_user_id) values ('medal1','tester');

\ir ../../supabase/review/ca-master-atomic-link-reconcile.review.sql

do $test$
declare denied boolean := false;
begin
  -- Service role only; PUBLIC must not be granted execute.
  if has_function_privilege('anon','public.internal_reconcile_ca_master_links(jsonb,uuid[])','EXECUTE')
  or has_function_privilege('authenticated','public.internal_reconcile_ca_master_links(jsonb,uuid[])','EXECUTE')
  or not has_function_privilege('service_role','public.internal_reconcile_ca_master_links(jsonb,uuid[])','EXECUTE') then
    raise exception 'FAIL: incorrect RPC privileges';
  end if;
  begin
    perform public.internal_reconcile_ca_master_links('[]'::jsonb,'{}'::uuid[]);
  exception when sqlstate '55000' then
    denied := true;
  end;
  if not denied then raise exception 'FAIL: paused gate did not reject'; end if;
  raise notice 'PASS: default OFF gate rejects link reconciliation; RPC service role only';
end
$test$;

update public.sync_automation_state set ca_master_sync_enabled=true where id=1;

do $test$
declare denied boolean := false;
begin
  begin
    perform public.internal_reconcile_ca_master_links('[]'::jsonb,'{}'::uuid[]);
  exception when sqlstate '55000' then denied:=true;
  end;
  if not denied then raise exception 'FAIL: unsafe CASCADE FK was allowed'; end if;
  raise notice 'PASS: cascade FK is rejected before reconciliation';
end
$test$;

alter table public.user_ca_identities
  drop constraint user_ca_identities_community_id_ca_member_id_fkey;
alter table public.user_ca_identities
  add constraint user_ca_identities_community_id_ca_member_id_fkey
  foreign key (community_id,ca_member_id)
  references public.community_ca_members(community_id,ca_member_id)
  on delete restrict;

-- Unchanged link is idempotent and does not delete existing identity.
do $test$
declare v jsonb;
begin
  select public.internal_reconcile_ca_master_links(
    '[{"community_id":"10000000-0000-4000-8000-000000000001","ca_member_id":"20000000-0000-4000-8000-000000000001"}]'::jsonb,
    array['20000000-0000-4000-8000-000000000001'::uuid]
  ) into v;
  if (v->>'removed_stale_links')::int<>0 then
    raise exception 'FAIL: unchanged link was deleted';
  end if;
  if (select count(*) from public.user_ca_identities)<>1 then
    raise exception 'FAIL: unchanged link lost Identity';
  end if;
  raise notice 'PASS: no-change link plan keeps primary Identity';
end
$test$;

-- Move CA1, move CA2. CA1 verified old link must remain,
-- CA2 unverified old link is deleted. Both new links created.
do $test$
declare v jsonb;
begin
  select public.internal_reconcile_ca_master_links(
    '[{"community_id":"10000000-0000-4000-8000-000000000003","ca_member_id":"20000000-0000-4000-8000-000000000001"},'
    ||'{"community_id":"10000000-0000-4000-8000-000000000003","ca_member_id":"20000000-0000-4000-8000-000000000002"}]'::text::jsonb,
    array['20000000-0000-4000-8000-000000000001'::uuid,'20000000-0000-4000-8000-000000000002'::uuid]
  ) into v;
  if (v->>'removed_stale_links')::int<>1
    or jsonb_array_length(v->'protected_stale_identity_links')<>1
    or (select count(*) from public.community_ca_members)<>3
    or (select count(*) from public.user_ca_identities)<>1
    or (select count(*) from public.stamp_collections)<>1 then
    raise exception 'FAIL: desired/old links or medal changed unexpectedly: %',v;
  end if;
  raise notice 'PASS: atomic reassignment retains verified old Identity and medal';
end
$test$;

-- A malformed plan must not remove any links even though the flag is ON.
do $test$
declare denied boolean := false;
declare old_count integer;
begin
  select count(*) into old_count from public.community_ca_members;
  begin
    perform public.internal_reconcile_ca_master_links(
      '[]'::jsonb,
      array['20000000-0000-4000-8000-000000000001'::uuid]
    );
  exception when invalid_parameter_value then denied:=true;
  end;
  if not denied or (select count(*) from public.community_ca_members)<>old_count then
    raise exception 'FAIL: incomplete plan was not rejected unchanged';
  end if;
  raise notice 'PASS: incomplete master link plan fails closed';
end
$test$;

-- Force an insert failure, proving earlier successful changes in the same
-- RPC also roll back (the invalid Community does not exist).
do $test$
declare denied boolean := false;
declare old_links integer;
declare old_identities integer;
begin
  select count(*) into old_links from public.community_ca_members;
  select count(*) into old_identities from public.user_ca_identities;
  begin
    perform public.internal_reconcile_ca_master_links(
      '[{"community_id":"10000000-0000-4000-8000-000000000002","ca_member_id":"20000000-0000-4000-8000-000000000001"},'
      ||'{"community_id":"99999999-0000-4000-8000-000000000099","ca_member_id":"20000000-0000-4000-8000-000000000002"}]'::text::jsonb,
      array['20000000-0000-4000-8000-000000000001'::uuid,'20000000-0000-4000-8000-000000000002'::uuid]
    );
  exception when foreign_key_violation then denied:=true;
  end;
  if not denied or old_links<>(select count(*) from public.community_ca_members)
    or old_identities<>(select count(*) from public.user_ca_identities)
    or (select count(*) from public.stamp_collections)<>1 then
    raise exception 'FAIL: partial RPC write was not rolled back';
  end if;
  raise notice 'PASS: mid-transaction FK failure rolls back all link writes';
end
$test$;

update public.sync_automation_state set ca_master_sync_enabled=false where id=1;
do $test$
declare denied boolean := false;
begin
  begin
    perform public.internal_reconcile_ca_master_links('[]'::jsonb,'{}'::uuid[]);
  exception when sqlstate '55000' then denied:=true;
  end;
  if not denied then raise exception 'FAIL: pause-after-run was bypassed'; end if;
  raise notice 'PASS: paused gate blocks subsequent reconcile call';
end
$test$;

rollback;
