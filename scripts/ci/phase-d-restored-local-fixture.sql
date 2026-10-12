-- Synthetic, disposable PostgreSQL fixture for Phase D read-only audit.
-- Fake identifiers only. MUST NEVER load production backups into CI.
\set ON_ERROR_STOP on
create schema auth;
create schema storage;
create table auth.users (id uuid primary key);
create table auth.identities (id uuid primary key,provider text);
create table public.profiles (id uuid primary key,role text not null);
create table public.communities (id uuid primary key);
create table public.ca_members (id uuid primary key,ca_level text,status text);
create table public.community_ca_members(
 id uuid primary key,community_id uuid not null references public.communities(id),
 ca_member_id uuid not null references public.ca_members(id),
 unique(community_id,ca_member_id)
);
create table public.user_ca_identities(
 user_id uuid not null,community_id uuid not null,ca_member_id uuid not null,
 is_primary boolean not null,
 constraint user_ca_identities_community_id_ca_member_id_fkey
 foreign key (community_id,ca_member_id)
 references public.community_ca_members(community_id,ca_member_id)
 on delete cascade
);
create table public.stamp_collections(
 id uuid primary key,owner_user_id uuid,stamp_ca_member_id uuid,community_id uuid
);
create table public.stamp_collection_designs(id uuid primary key);
create table public.community_memberships(id uuid primary key);
create table public.sync_automation_state(
 id int primary key,enabled boolean,last_ca_master_at timestamptz
);
create table public.sync_runs(id uuid primary key,source text,status text);
create table storage.objects (id uuid primary key);
insert into auth.users values ('10000000-0000-4000-8000-000000000001');
insert into auth.identities values ('20000000-0000-4000-8000-000000000001','google');
insert into public.profiles values ('10000000-0000-4000-8000-000000000001','ca');
insert into public.communities values ('30000000-0000-4000-8000-000000000001');
insert into public.ca_members values ('40000000-0000-4000-8000-000000000001','1st','active');
insert into public.community_ca_members values (
 '50000000-0000-4000-8000-000000000001',
 '30000000-0000-4000-8000-000000000001',
 '40000000-0000-4000-8000-000000000001'
);
insert into public.user_ca_identities values (
 '10000000-0000-4000-8000-000000000001',
 '30000000-0000-4000-8000-000000000001',
 '40000000-0000-4000-8000-000000000001',true
);
insert into public.stamp_collections values (
 '60000000-0000-4000-8000-000000000001',
 '10000000-0000-4000-8000-000000000001',
 '40000000-0000-4000-8000-000000000001',
 '30000000-0000-4000-8000-000000000001'
);
insert into public.sync_automation_state values(1,true,'2099-01-01 00:00:00+00');
