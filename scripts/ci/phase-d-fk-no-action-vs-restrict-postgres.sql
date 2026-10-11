-- Phase D: synthetic PostgreSQL 16+ FK semantics only.
-- NO PRIVATE DATA; NO PRODUCTION ACCESS; do not run on production.
\set ON_ERROR_STOP on
begin;
do $guard$
begin
  if current_database() not in ('ca_master_safety', 'ca_clover_release_qa')
     or inet_server_addr() is null then
    raise exception 'STOP: expected disposable CI-only database over TCP';
  end if;
end
$guard$;

create schema phase_d_fk_ci;
create table phase_d_fk_ci.links(
  community_id text not null,
  ca_member_id text not null,
  primary key(community_id,ca_member_id)
);
create table phase_d_fk_ci.identities(
  user_id text primary key,
  community_id text not null,
  ca_member_id text not null,
  constraint identity_link_fk foreign key(community_id,ca_member_id)
    references phase_d_fk_ci.links(community_id,ca_member_id)
    on delete cascade
);
create table phase_d_fk_ci.medals(id text primary key);
create table phase_d_fk_ci.exchanges(id text primary key);
insert into phase_d_fk_ci.links values('community-A','ca-A'),('community-B','ca-B');
insert into phase_d_fk_ci.identities values('fake-user','community-A','ca-A');
insert into phase_d_fk_ci.medals values('fake-medal');
insert into phase_d_fk_ci.exchanges values('fake-exchange');

-- First show the dangerous behavior, then completely reverse the simulated deletion.
savepoint synthetic_cascade;
delete from phase_d_fk_ci.links where community_id='community-A' and ca_member_id='ca-A';
do $check$
begin
  if (select count(*) from phase_d_fk_ci.identities) <> 0 then
    raise exception 'Expected CASCADE to delete the synthetic identity';
  end if;
end
$check$;
rollback to savepoint synthetic_cascade;

-- Reproduce the operator's NO ACTION variant (non-deferrable).
alter table phase_d_fk_ci.identities drop constraint identity_link_fk;
alter table phase_d_fk_ci.identities
  add constraint identity_link_fk foreign key(community_id,ca_member_id)
    references phase_d_fk_ci.links(community_id,ca_member_id)
    on delete no action not deferrable;
do $check$
declare blocked boolean := false;
begin
  if not exists(
    select 1 from pg_constraint
     where conrelid='phase_d_fk_ci.identities'::regclass
       and conname='identity_link_fk' and confdeltype='a'
       and condeferrable=false
  ) then raise exception 'NO ACTION FK setting mismatch'; end if;
  begin
    delete from phase_d_fk_ci.links
     where community_id='community-A' and ca_member_id='ca-A';
  exception when foreign_key_violation then
    blocked := true;
  end;
  if not blocked then raise exception 'NO ACTION failed to block deletion'; end if;
  if (select count(*) from phase_d_fk_ci.identities) <> 1 then
    raise exception 'NO ACTION identity count changed';
  end if;
end
$check$;

-- Verify the currently proposed migration/RPC contract, which requires RESTRICT.
alter table phase_d_fk_ci.identities drop constraint identity_link_fk;
alter table phase_d_fk_ci.identities
  add constraint identity_link_fk foreign key(community_id,ca_member_id)
    references phase_d_fk_ci.links(community_id,ca_member_id)
    on delete restrict;
do $check$
declare blocked boolean := false;
begin
  if not exists(
    select 1 from pg_constraint
     where conrelid='phase_d_fk_ci.identities'::regclass
       and conname='identity_link_fk' and confdeltype='r'
  ) then raise exception 'RESTRICT FK setting mismatch'; end if;
  begin
    delete from phase_d_fk_ci.links
     where community_id='community-A' and ca_member_id='ca-A';
  exception when foreign_key_violation then
    blocked := true;
  end;
  if not blocked then raise exception 'RESTRICT failed to block deletion'; end if;
  if (select count(*) from phase_d_fk_ci.identities) <> 1
     or (select count(*) from phase_d_fk_ci.medals) <> 1
     or (select count(*) from phase_d_fk_ci.exchanges) <> 1
     or (select count(*) from phase_d_fk_ci.links) <> 2 then
    raise exception 'Synthetic identity, medal, exchange or link was changed';
  end if;
  raise notice 'PHASE_D_SYNTHETIC_PASS: CASCADE hazard reproduced, NO ACTION and RESTRICT both protect, all data preserved';
end
$check$;
rollback;
