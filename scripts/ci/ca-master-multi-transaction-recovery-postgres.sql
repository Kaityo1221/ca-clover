-- Disposable Postgres integration rehearsal; synthetic rows only.
-- This models THREE SEPARATE COMMITTED REST write transactions.
-- It is not a live Supabase Edge/PostgREST E2E test and cannot replace it.
\set ON_ERROR_STOP on
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create table public.sync_automation_state(
 id smallint primary key,enabled boolean not null default true,
 ca_master_sync_enabled boolean not null default false
);
create table public.communities(id uuid primary key,name text not null);
create table public.ca_members(
 id uuid primary key,source_key text unique not null,status text not null
);
create table public.community_ca_members(
 id uuid primary key,
 community_id uuid not null references public.communities(id),
 ca_member_id uuid not null references public.ca_members(id),
 unique(community_id,ca_member_id)
);
create table public.user_ca_identities(
 user_id uuid not null,
 ca_member_id uuid not null,
 community_id uuid not null,
 is_primary boolean not null,
 primary key(user_id,ca_member_id,community_id),
 constraint user_ca_identities_community_id_ca_member_id_fkey
 foreign key(community_id,ca_member_id)
 references public.community_ca_members(community_id,ca_member_id)
 on delete restrict
);
create table public.stamp_collections(
 id uuid primary key,owner_user_id uuid not null,
 stamp_ca_member_id uuid not null,community_id uuid not null
);
insert into public.sync_automation_state values(1,true,false);
insert into public.communities values
 ('10000000-0000-4000-8000-000000000001','Original Community');
insert into public.ca_members values
 ('20000000-0000-4000-8000-000000000001','synthetic-ca','active');
insert into public.community_ca_members values
 ('30000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001');
insert into public.user_ca_identities values
 ('40000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',true);
insert into public.stamp_collections values
 ('50000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001');

\ir ../../supabase/review/ca-master-exclusive-lease.review.sql

-- Administrator allows one controlled run in this FAKE DB.
begin;
update public.sync_automation_state
set ca_master_sync_enabled=true where id=1;
commit;

do $test$
begin
 if public.internal_begin_ca_master_lease(
    '60000000-0000-4000-8000-000000000001') is distinct from true then
   raise exception 'FAIL: isolated rehearsal lease not acquired'; end if;
 raise notice 'PASS: leased run starts only after explicit gate enable';
end $test$;

-- Separate HTTP request #1: CA metadata update *commits*.
begin;
update public.ca_members set status='inactive'
where source_key='synthetic-ca';
commit;

-- Separate HTTP request #2: Community update would violate a constraint.
-- The DML is rolled back while the *previous* HTTP transaction stays committed.
begin;
do $test$
declare blocked boolean:=false;
begin
 begin
   update public.communities set name=null
    where id='10000000-0000-4000-8000-000000000001';
 exception when not_null_violation then blocked:=true;
 end;
 if not blocked then raise exception 'FAIL: injected community write did not fail'; end if;
end $test$;
commit;

do $test$
begin
 if (select status from public.ca_members
       where source_key='synthetic-ca')<>'inactive'
    or (select name from public.communities
       where id='10000000-0000-4000-8000-000000000001')<>'Original Community'
    or (select count(*) from public.user_ca_identities where is_primary)<>1
    or (select count(*) from public.stamp_collections)<>1 then
   raise exception 'FAIL: multi-request partial failure not correctly simulated'; end if;
 raise notice 'PASS: first REST transaction commits; failed second leaves a partial snapshot';
end $test$;

-- Separate HTTP request #3: the error handler pauses ONLY CA-master.
begin;
update public.sync_automation_state
set ca_master_sync_enabled=false
where id=1
 and ca_master_lease_owner='60000000-0000-4000-8000-000000000001';
commit;

do $test$
begin
 if (select ca_master_sync_enabled from public.sync_automation_state where id=1)
     is distinct from false
    or (select enabled from public.sync_automation_state where id=1)
     is distinct from true then
   raise exception 'FAIL: unrelated scheduler paused or CA master still enabled'; end if;
 if public.internal_finish_ca_master_lease(
      '60000000-0000-4000-8000-000000000001') is distinct from true then
   raise exception 'FAIL: confirmed stopped owner cannot release'; end if;
 if public.internal_begin_ca_master_lease(
      '60000000-0000-4000-8000-000000000002') is distinct from false then
   raise exception 'FAIL: master restarted after partial write without admin review'; end if;
 if (select count(*) from public.user_ca_identities where is_primary)<>1
    or (select count(*) from public.stamp_collections)<>1 then
   raise exception 'FAIL: protected identity or medal lost during partial failure'; end if;
 raise notice 'PASS: partial write pauses master and retains independently running Cron';
end $test$;

-- Explicit human repair simulation in disposable DB only; no automatic retry.
begin;
update public.ca_members set status='active' where source_key='synthetic-ca';
commit;

do $test$
begin
 if (select status from public.ca_members where source_key='synthetic-ca')<>'active'
    or (select name from public.communities
       where id='10000000-0000-4000-8000-000000000001')<>'Original Community'
    or (select count(*) from public.user_ca_identities where is_primary)<>1
    or (select count(*) from public.stamp_collections)<>1
    or (select ca_master_sync_enabled from public.sync_automation_state where id=1)
      is distinct from false then
   raise exception 'FAIL: manual repair did not restore record integrity'; end if;
 raise notice 'PASS: operator repair restores CA metadata, protected IDs and medals unchanged';
end $test$;
