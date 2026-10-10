-- CA Clover: ephemeral PostgreSQL safety regression test.
-- Synthetic records only. No production credentials or real user data.
\set ON_ERROR_STOP on

begin;

create schema ca_master_ci;

create table ca_master_ci.communities (
  id text primary key
);
create table ca_master_ci.ca_members (
  id text primary key
);
create table ca_master_ci.community_ca_members (
  id text primary key,
  community_id text not null references ca_master_ci.communities(id),
  ca_member_id text not null references ca_master_ci.ca_members(id),
  unique (community_id, ca_member_id)
);
create table ca_master_ci.user_ca_identities (
  user_id text not null,
  community_id text not null,
  ca_member_id text not null,
  is_primary boolean not null default false,
  primary key(user_id,ca_member_id,community_id),
  constraint user_ca_identities_community_id_ca_member_id_fkey
    foreign key(community_id,ca_member_id)
    references ca_master_ci.community_ca_members(community_id,ca_member_id)
    on delete cascade
);
create table ca_master_ci.stamp_collections (
  id text primary key,
  owner_user_id text not null,
  stamp_ca_member_id text not null,
  community_id text not null
);
create table ca_master_ci.sync_automation_state (
  id integer primary key,
  enabled boolean not null default true,
  last_ca_master_at timestamptz,
  ca_master_sync_enabled boolean not null default false
);

insert into ca_master_ci.communities values ('home'),('other'),('retired');
insert into ca_master_ci.ca_members values ('ca1'),('ca2');
insert into ca_master_ci.community_ca_members
  (id,community_id,ca_member_id)
  values ('protected','home','ca1'),('stale','retired','ca2');
insert into ca_master_ci.user_ca_identities
  (user_id,community_id,ca_member_id,is_primary)
  values ('dummy-user','home','ca1',true);
insert into ca_master_ci.stamp_collections
  (id,owner_user_id,stamp_ca_member_id,community_id)
  values ('medal1','dummy-user','ca1','home');
insert into ca_master_ci.sync_automation_state(id,last_ca_master_at)
  values (1,'2099-01-01T00:00:00Z');

-- Simulate the reviewed proposal: prevent accidental primary identity cascade.
alter table ca_master_ci.user_ca_identities
  drop constraint user_ca_identities_community_id_ca_member_id_fkey;
alter table ca_master_ci.user_ca_identities
  add constraint user_ca_identities_community_id_ca_member_id_fkey
  foreign key (community_id,ca_member_id)
  references ca_master_ci.community_ca_members(community_id,ca_member_id)
  on delete restrict;

do $test$
declare
  blocked boolean := false;
begin
  -- The dedicated gate must default to OFF without disabling general Cron.
  if not exists (
    select 1 from ca_master_ci.sync_automation_state
    where id=1 and enabled=true and ca_master_sync_enabled=false
      and last_ca_master_at='2099-01-01T00:00:00Z'::timestamptz
  ) then raise exception 'FAIL: CA-master-only gate did not default OFF'; end if;

  -- An accidental delete of an identity-referenced CA/community link
  -- must raise 23503 and never remove the verified identity.
  begin
    delete from ca_master_ci.community_ca_members where id='protected';
  exception when foreign_key_violation then
    blocked := true;
  end;
  if not blocked then
    raise exception 'FAIL: linked identity was not protected from deletion';
  end if;
  if not exists (
    select 1 from ca_master_ci.user_ca_identities
      where user_id='dummy-user' and is_primary=true
  ) then raise exception 'FAIL: primary identity was lost'; end if;
  if not exists (
    select 1 from ca_master_ci.stamp_collections
      where id='medal1' and owner_user_id='dummy-user'
  ) then raise exception 'FAIL: previously owned medal was lost'; end if;

  -- An unreferenced retired link can still be removed.
  delete from ca_master_ci.community_ca_members where id='stale';
  if exists (select 1 from ca_master_ci.community_ca_members where id='stale') then
    raise exception 'FAIL: unreferenced link was not removed'; end if;

  -- Both the guard and general Cron remain independent.
  update ca_master_ci.sync_automation_state
    set ca_master_sync_enabled=true where id=1;
  if not exists (
    select 1 from ca_master_ci.sync_automation_state
    where id=1 and enabled=true and ca_master_sync_enabled=true
  ) then raise exception 'FAIL: enabled gate is not independent'; end if;

  update ca_master_ci.sync_automation_state
    set ca_master_sync_enabled=false where id=1;
  if (select count(*) from ca_master_ci.user_ca_identities) <> 1
     or (select count(*) from ca_master_ci.stamp_collections) <> 1 then
    raise exception 'FAIL: identity or medal counts changed'; end if;

  raise notice 'PASS: guarded FK prevents identity cascade; medals and unrelated Cron survive';
end
$test$;

-- Simulate the safe DB writes resulting from a no-change master refresh.
-- An UPSERT on the same composite key must not cascade-delete Identity.
insert into ca_master_ci.community_ca_members (id,community_id,ca_member_id)
values ('not-used','home','ca1')
on conflict (community_id,ca_member_id) do update
  set community_id=excluded.community_id;

do $test$
begin
  if (select id from ca_master_ci.community_ca_members
      where community_id='home' and ca_member_id='ca1') <> 'protected' then
    raise exception 'FAIL: UPSERT replaced protected link instead of preserving it';
  end if;
  if not exists (select 1 from ca_master_ci.user_ca_identities
                 where user_id='dummy-user' and community_id='home' and is_primary=true) then
    raise exception 'FAIL: no-change UPSERT removed the Identity';
  end if;
  raise notice 'PASS: same-link master UPSERT keeps Identity';
end
$test$;

-- A reassignment should retain the old verified Identity for human review
-- while the new, as-yet-unverified link becomes available.
insert into ca_master_ci.community_ca_members (id,community_id,ca_member_id)
  values ('new-location','other','ca1');
do $test$
begin
  if not exists (select 1 from ca_master_ci.community_ca_members
                 where id='new-location') then
    raise exception 'FAIL: reassignment missing new link';
  end if;
  if not exists (select 1 from ca_master_ci.user_ca_identities
                 where user_id='dummy-user' and community_id='home' and is_primary=true) then
    raise exception 'FAIL: reassignment lost existing verified Identity';
  end if;
  if (select count(*) from ca_master_ci.stamp_collections) <> 1 then
    raise exception 'FAIL: reassignment changed historical medals';
  end if;
  raise notice 'PASS: reassignment preserves historical Identity and medal';
end
$test$;

rollback;
