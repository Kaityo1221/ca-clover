create type public.app_role as enum ('admin','ca','pending');
create type public.coverage_status as enum ('complete','partial','missing');

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.profiles(
  id uuid primary key references auth.users(id) on delete cascade,
  niantic_id text,
  role public.app_role not null default 'pending',
  created_at timestamptz not null default now()
);

create table public.communities(
  id uuid primary key default gen_random_uuid(),
  campfire_community_id text unique,
  name text not null,
  prefecture text,
  region text,
  campfire_url text,
  member_count integer,
  latitude double precision,
  longitude double precision,
  coverage public.coverage_status not null default 'missing',
  coverage_from timestamptz,
  coverage_to timestamptz,
  fetched_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.ca_members(
  id uuid primary key default gen_random_uuid(),
  source_key text unique not null,
  trainer_name text not null,
  ca_level text check (ca_level in ('1st','2nd')),
  prefecture text,
  join_date date,
  status text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now()
);

create unique index ca_members_trainer_name_ci_key
  on public.ca_members(lower(trainer_name));

create table public.community_ca_members(
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  ca_member_id uuid not null references public.ca_members(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(community_id,ca_member_id)
);

create index community_ca_members_ca_member_id_idx
  on public.community_ca_members(ca_member_id);

create table public.community_memberships(
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  community_id uuid references public.communities(id) on delete cascade,
  unique(user_id,community_id)
);

create index community_memberships_community_id_idx
  on public.community_memberships(community_id);

create table public.meetups(
  id uuid primary key default gen_random_uuid(),
  campfire_meetup_id text unique not null,
  community_id uuid references public.communities(id) on delete cascade,
  title text not null,
  starts_at timestamptz,
  ends_at timestamptz,
  location text,
  is_ca_meetup boolean,
  rsvp_count integer,
  checkin_count integer,
  source text not null,
  fetched_at timestamptz not null default now()
);

create index meetups_community_id_idx
  on public.meetups(community_id);

create table public.sync_runs(
  id uuid primary key default gen_random_uuid(),
  source text not null,
  status text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  details jsonb not null default '{}'::jsonb
);

alter table public.profiles enable row level security;
alter table public.communities enable row level security;
alter table public.community_memberships enable row level security;
alter table public.community_ca_members enable row level security;
alter table public.meetups enable row level security;
alter table public.ca_members enable row level security;
alter table public.sync_runs enable row level security;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists(
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
  );
$$;

grant execute on function private.is_admin() to authenticated;

create policy "profiles self or admin read"
on public.profiles for select to authenticated
using(id = (select auth.uid()) or private.is_admin());

create policy "read allowed communities"
on public.communities for select to authenticated
using(
  private.is_admin()
  or exists(
    select 1 from public.community_memberships m
    where m.community_id = communities.id
      and m.user_id = (select auth.uid())
  )
);

create policy "read allowed memberships"
on public.community_memberships for select to authenticated
using(private.is_admin() or user_id = (select auth.uid()));

create policy "read allowed meetups"
on public.meetups for select to authenticated
using(
  private.is_admin()
  or exists(
    select 1 from public.community_memberships m
    where m.community_id = meetups.community_id
      and m.user_id = (select auth.uid())
  )
);

create policy "admin reads ca master"
on public.ca_members for select to authenticated
using(private.is_admin());

create policy "admin reads sync runs"
on public.sync_runs for select to authenticated
using(private.is_admin());

create policy "admin reads community ca links"
on public.community_ca_members for select to authenticated
using(private.is_admin());
