create type public.app_role as enum ('admin','ca','pending');
create type public.coverage_status as enum ('complete','partial','missing');

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
  source_key text unique,
  trainer_name text not null,
  ca_level text check (ca_level in ('1st','2nd')),
  prefecture text,
  join_date date,
  status text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now()
);

create table public.community_ca_members(
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  ca_member_id uuid not null references public.ca_members(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(community_id,ca_member_id)
);

create table public.community_memberships(
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  community_id uuid references public.communities(id) on delete cascade,
  unique(user_id,community_id)
);

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

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'); $$;

create policy "profiles self or admin read" on public.profiles for select to authenticated using(id=auth.uid() or public.is_admin());
create policy "admin reads communities" on public.communities for select to authenticated using(public.is_admin());
create policy "ca reads assigned communities" on public.communities for select to authenticated using(
  exists(select 1 from public.community_memberships m where m.community_id=communities.id and m.user_id=auth.uid())
);
create policy "admin reads memberships" on public.community_memberships for select to authenticated using(public.is_admin());
create policy "ca reads own memberships" on public.community_memberships for select to authenticated using(user_id=auth.uid());
create policy "admin reads meetups" on public.meetups for select to authenticated using(public.is_admin());
create policy "ca reads assigned meetups" on public.meetups for select to authenticated using(
  exists(select 1 from public.community_memberships m where m.community_id=meetups.community_id and m.user_id=auth.uid())
);
create policy "admin reads ca master" on public.ca_members for select to authenticated using(public.is_admin());
create policy "admin reads sync runs" on public.sync_runs for select to authenticated using(public.is_admin());

create policy "admin reads community ca links" on public.community_ca_members for select to authenticated using(public.is_admin());
