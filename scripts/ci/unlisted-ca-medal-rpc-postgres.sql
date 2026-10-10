-- CA Clover: PR #118 atomic unlisted CA approval RPC review test.
-- Synthetic identities only; disposable GitHub Actions PostgreSQL 16 database.
-- IMPORTANT: the medal trigger below is a STUB, not the live production trigger.
-- This tests RPC transaction/rollback, not end-to-end production medal visuals.
\set ON_ERROR_STOP on
begin;
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create table public.profiles(
  id uuid primary key,
  role text not null,
  niantic_id text
);
create table public.communities(
  id uuid primary key,
  prefecture text not null
);
create table public.ca_members(
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique,
  trainer_name text not null,
  ca_level text not null,
  prefecture text,
  status text not null
);
create table public.community_ca_members(
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id),
  ca_member_id uuid not null references public.ca_members(id),
  unique(community_id,ca_member_id)
);
create table public.community_memberships(
  user_id uuid not null references public.profiles(id),
  community_id uuid not null references public.communities(id),
  primary key(user_id,community_id)
);
create table public.user_ca_identities(
  user_id uuid not null references public.profiles(id),
  ca_member_id uuid not null references public.ca_members(id),
  community_id uuid not null references public.communities(id),
  is_primary boolean not null default false,
  verification_source text,
  verified_at timestamptz,
  verified_by uuid references public.profiles(id),
  primary key(user_id,ca_member_id,community_id),
  unique(ca_member_id,community_id),
  foreign key(community_id,ca_member_id)
    references public.community_ca_members(community_id,ca_member_id)
    on delete restrict
);
create table public.stamp_collections(
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  stamp_ca_member_id uuid not null,
  community_id uuid not null,
  unique(owner_user_id,stamp_ca_member_id,community_id)
);
create table public.community_access_requests(
  id uuid primary key,
  user_id uuid not null references public.profiles(id),
  community_id uuid not null references public.communities(id),
  status text not null,
  request_source text not null,
  ca_map_status text not null,
  creator_ca_badge_verified boolean not null,
  creator_username_matches_profile boolean not null,
  is_ca_meetup boolean not null,
  campfire_meetup_id text,
  niantic_id_snapshot text,
  creator_username text,
  reviewed_at timestamptz,
  reviewed_by uuid
);

-- Mimics the intended side effect of the real identity trigger, not its full code.
create function public.qa_stub_grant_self_medal()
returns trigger language plpgsql as $$
begin
  if new.is_primary then
    insert into public.stamp_collections(owner_user_id,stamp_ca_member_id,community_id)
    values(new.user_id,new.ca_member_id,new.community_id)
    on conflict(owner_user_id,stamp_ca_member_id,community_id) do nothing;
  end if;
  return new;
end;
$$;
create trigger qa_grant_self_medal
after insert or update of is_primary,ca_member_id,community_id
on public.user_ca_identities
for each row execute function public.qa_stub_grant_self_medal();

insert into public.profiles(id,role,niantic_id) values
 ('00000000-0000-4000-8000-000000000001','admin','admin-ca'),
 ('00000000-0000-4000-8000-000000000002','pending','@ca-new'),
 ('00000000-0000-4000-8000-000000000003','pending','ca-another'),
 ('00000000-0000-4000-8000-000000000004','pending','ca-new');
insert into public.communities values ('11111111-1111-4111-8111-111111111111','香川県');
insert into public.community_access_requests(
id,user_id,community_id,status,request_source,ca_map_status,
creator_ca_badge_verified,creator_username_matches_profile,is_ca_meetup,
campfire_meetup_id,niantic_id_snapshot,creator_username) values
 ('22222222-2222-4222-8222-222222222221','00000000-0000-4000-8000-000000000002','11111111-1111-4111-8111-111111111111','pending','meetup_share','not_listed',true,true,true,'fake-meetup-1','ca-new','ca-new'),
 ('22222222-2222-4222-8222-222222222222','00000000-0000-4000-8000-000000000003','11111111-1111-4111-8111-111111111111','pending','meetup_share','not_listed',true,true,true,'fake-meetup-2','ca-another','ca-another'),
 ('22222222-2222-4222-8222-222222222223','00000000-0000-4000-8000-000000000004','11111111-1111-4111-8111-111111111111','pending','meetup_share','not_listed',true,true,true,'fake-meetup-3','ca-new','ca-new');

\ir ../../supabase/review/unlisted_ca_self_medal_atomic_approval.review.sql

do $test$
declare blocked boolean := false;
begin
  if has_function_privilege('anon','public.internal_approve_unlisted_ca_claim(uuid,uuid,text)','EXECUTE')
     or has_function_privilege('authenticated','public.internal_approve_unlisted_ca_claim(uuid,uuid,text)','EXECUTE')
     or not has_function_privilege('service_role','public.internal_approve_unlisted_ca_claim(uuid,uuid,text)','EXECUTE') then
     raise exception 'FAIL: RPC privileges too broad';
  end if;
  begin
    perform public.internal_approve_unlisted_ca_claim(
      '22222222-2222-4222-8222-222222222221',
      '00000000-0000-4000-8000-000000000002','1st');
  exception when insufficient_privilege then blocked:=true;
  end;
  if not blocked then raise exception 'FAIL: non-admin confirmation accepted'; end if;
  begin
    perform public.internal_approve_unlisted_ca_claim(
      '22222222-2222-4222-8222-222222222221',
      '00000000-0000-4000-8000-000000000001','3rd');
    raise exception 'FAIL: invalid level accepted';
  exception when invalid_parameter_value then null;
  end;
  if (select count(*) from public.ca_members)<>0
     or (select count(*) from public.stamp_collections)<>0 then
    raise exception 'FAIL: unauthorized attempts wrote data';
  end if;
  raise notice 'PASS: non-admin and invalid-level approvals rejected without writes';
end
$test$;

do $test$
declare r jsonb;
begin
  select public.internal_approve_unlisted_ca_claim(
    '22222222-2222-4222-8222-222222222221',
    '00000000-0000-4000-8000-000000000001','1st')
    into r;
  if r->>'status'<>'approved'
     or (select count(*) from public.ca_members)<>1
     or (select count(*) from public.community_ca_members)<>1
     or (select count(*) from public.community_memberships)<>1
     or (select count(*) from public.user_ca_identities where is_primary)<>1
     or (select count(*) from public.stamp_collections)<>1
     or (select role from public.profiles where id='00000000-0000-4000-8000-000000000002')<>'ca'
     or (select status from public.community_access_requests where id='22222222-2222-4222-8222-222222222221')<>'approved' then
    raise exception 'FAIL: success did not produce exactly one own medal and verified identity';
  end if;
  raise notice 'PASS: one transactional approval issues only one self medal';
end
$test$;

do $test$
declare denied boolean := false;
begin
  begin
    perform public.internal_approve_unlisted_ca_claim(
      '22222222-2222-4222-8222-222222222221',
      '00000000-0000-4000-8000-000000000001','1st');
  exception when insufficient_privilege then denied:=true;
  end;
  if not denied or (select count(*) from public.stamp_collections)<>1 then
    raise exception 'FAIL: repeated approval was not blocked';
  end if;
  raise notice 'PASS: same claim retry cannot mint a second medal';
end
$test$;

-- Another pending user claiming same CA is rejected, preserving the owner.
do $test$
declare denied boolean := false;
begin
  begin
    perform public.internal_approve_unlisted_ca_claim(
      '22222222-2222-4222-8222-222222222223',
      '00000000-0000-4000-8000-000000000001','1st');
  exception when unique_violation then denied:=true;
  end;
  if not denied or (select count(*) from public.stamp_collections)<>1
     or (select count(*) from public.user_ca_identities)<>1 then
    raise exception 'FAIL: another claimant hijacked the CA identity';
  end if;
  raise notice 'PASS: CA identity ownership cannot be seized';
end
$test$;

-- Disable the QA medal trigger and force the real RPC's medal assertion to
-- fail. All earlier inserts/role updates in that call must be rolled back.
alter table public.user_ca_identities disable trigger qa_grant_self_medal;
do $test$
declare denied boolean := false;
declare old_ca integer;
begin
  select count(*) into old_ca from public.ca_members;
  begin
    perform public.internal_approve_unlisted_ca_claim(
      '22222222-2222-4222-8222-222222222222',
      '00000000-0000-4000-8000-000000000001','2nd');
  exception when raise_exception then denied:=true;
  end;
  if not denied
    or (select count(*) from public.ca_members)<>old_ca
    or (select count(*) from public.community_ca_members)<>1
    or (select count(*) from public.community_memberships)<>1
    or (select count(*) from public.user_ca_identities)<>1
    or (select count(*) from public.stamp_collections)<>1
    or (select role from public.profiles where id='00000000-0000-4000-8000-000000000003')<>'pending'
    or (select status from public.community_access_requests where id='22222222-2222-4222-8222-222222222222')<>'pending' then
    raise exception 'FAIL: missing medal did not roll back approval';
  end if;
  raise notice 'PASS: medal trigger failure rolls back full approval';
end
$test$;
alter table public.user_ca_identities enable trigger qa_grant_self_medal;

rollback;
