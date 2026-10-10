-- CA Clover HTTP integration fixture: disposable PostgreSQL ONLY.
-- Synthetic data and unprivileged REST role. Do NOT run on Supabase.
\set ON_ERROR_STOP on
create role anon nologin;
create table public.sync_automation_state(
 id smallint primary key, enabled boolean not null default true,
 ca_master_sync_enabled boolean not null default false,
 ca_master_lease_owner uuid
);
create table public.ca_members(
 source_key text primary key, status text not null
);
create table public.communities(
 id uuid primary key, name text not null
);
create table public.user_ca_identities(
 user_id uuid primary key, ca_member_id uuid not null, community_id uuid not null,
 is_primary boolean not null
);
create table public.stamp_collections(
 id uuid primary key,owner_user_id uuid not null,
 stamp_ca_member_id uuid not null,community_id uuid not null
);
insert into public.sync_automation_state
 (id,enabled,ca_master_sync_enabled,ca_master_lease_owner)
values(1,true,true,'60000000-0000-4000-8000-000000000001');
insert into public.ca_members values('synthetic-ca','active');
insert into public.communities values
 ('10000000-0000-4000-8000-000000000001','Original Community');
insert into public.user_ca_identities values
 ('40000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',true);
insert into public.stamp_collections values
 ('50000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001');
grant usage on schema public to anon;
grant select on public.sync_automation_state, public.ca_members,
 public.communities, public.user_ca_identities,
 public.stamp_collections to anon;
grant update(status) on public.ca_members to anon;
grant update(name) on public.communities to anon;
grant update(ca_master_sync_enabled) on public.sync_automation_state to anon;

-- PostgREST uses a role with synthetic scope for this integration harness.
-- Live Supabase Edge uses service_role, which has different authorization:
-- these are transactional/HTTP semantics checks, not full auth E2E.
