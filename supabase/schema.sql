create extension if not exists supabase_vault;

create type public.app_role as enum ('admin','ca','pending');
create type public.coverage_status as enum ('complete','partial','missing');

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.profiles(
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
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
  event_url text,
  details text,
  is_ca_meetup boolean,
  rsvp_count integer,
  checkin_count integer,
  accepted_count integer,
  declined_count integer,
  campfire_live_event_name text,
  source text not null,
  fetched_at timestamptz not null default now()
);

create index meetups_community_id_idx
  on public.meetups(community_id);

create index meetups_starts_at_idx
  on public.meetups(starts_at desc);

create index meetups_community_starts_at_idx
  on public.meetups(community_id, starts_at desc);

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

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles(id, email, role)
  values(new.id, new.email, 'pending')
  on conflict (id) do update
    set email = excluded.email;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure private.handle_new_user();

create policy "profiles self or admin read"
on public.profiles for select to authenticated
using(id = (select auth.uid()) or private.is_admin());

create policy "profiles self update"
on public.profiles
for update
to authenticated
using(id = (select auth.uid()))
with check(id = (select auth.uid()));

revoke update on public.profiles from authenticated;
grant update (niantic_id) on public.profiles to authenticated;

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

create policy "read allowed community ca links"
on public.community_ca_members
for select
to authenticated
using(
  private.is_admin()
  or exists(
    select 1
    from public.community_memberships m
    where m.community_id = community_ca_members.community_id
      and m.user_id = (select auth.uid())
  )
);

create policy "read allowed ca master"
on public.ca_members
for select
to authenticated
using(
  private.is_admin()
  or exists(
    select 1
    from public.community_ca_members l
    join public.community_memberships m
      on m.community_id = l.community_id
    where l.ca_member_id = ca_members.id
      and m.user_id = (select auth.uid())
  )
);

create policy "admin reads sync runs"
on public.sync_runs for select to authenticated
using(private.is_admin());


create or replace function public.community_activity_summary(
  p_community_id uuid,
  p_days integer default 30
)
returns table(
  meetup_count bigint,
  ca_meetup_count bigint,
  rsvp_count bigint,
  checkin_count bigint,
  last_event_at timestamptz
)
language sql
stable
set search_path = public, pg_temp
as $$
  select
    count(*)::bigint,
    count(*) filter (where coalesce(m.is_ca_meetup, false))::bigint,
    coalesce(sum(m.rsvp_count), 0)::bigint,
    coalesce(sum(m.checkin_count), 0)::bigint,
    max(m.starts_at)
  from public.meetups m
  where m.community_id = p_community_id
    and m.starts_at >= now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 3650)));
$$;

grant execute on function public.community_activity_summary(uuid, integer) to authenticated;

create or replace function public.community_monthly_activity(
  p_community_id uuid,
  p_months integer default 12
)
returns table(
  month date,
  meetup_count bigint,
  rsvp_count bigint,
  checkin_count bigint
)
language sql
stable
set search_path = public, pg_temp
as $$
  select
    date_trunc('month', m.starts_at)::date as month,
    count(*)::bigint as meetup_count,
    coalesce(sum(m.rsvp_count), 0)::bigint as rsvp_count,
    coalesce(sum(m.checkin_count), 0)::bigint as checkin_count
  from public.meetups m
  where m.community_id = p_community_id
    and m.starts_at >= date_trunc('month', now())
      - make_interval(months => greatest(0, least(coalesce(p_months, 12), 120) - 1))
  group by date_trunc('month', m.starts_at)
  order by month asc;
$$;

grant execute on function public.community_monthly_activity(uuid, integer) to authenticated;


-- Campfire ADMIN token metadata. The raw token itself lives only in Supabase Vault.
create table public.campfire_connection_state(
  id smallint primary key default 1 check (id = 1),
  status text not null default 'missing' check (status in ('missing','ready','expiring','expired','error')),
  token_email text,
  expires_at timestamptz,
  last_validated_at timestamptz,
  last_sync_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now()
);

insert into public.campfire_connection_state(id,status)
values(1,'missing')
on conflict (id) do nothing;

alter table public.campfire_connection_state enable row level security;

create policy "admin reads campfire connection state"
on public.campfire_connection_state
for select
to authenticated
using(private.is_admin());

revoke all on public.campfire_connection_state from anon, authenticated;
grant select on public.campfire_connection_state to authenticated;

create or replace function public.internal_set_campfire_token(
  p_token text,
  p_email text,
  p_expires_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, vault
as $$
declare
  v_id uuid;
begin
  select id into v_id
  from vault.decrypted_secrets
  where name = 'ca_clover_campfire_token'
  limit 1;

  if v_id is null then
    perform vault.create_secret(p_token,'ca_clover_campfire_token','CA Clover Campfire bearer token',null);
  else
    perform vault.update_secret(v_id,p_token,'ca_clover_campfire_token','CA Clover Campfire bearer token',null);
  end if;

  insert into public.campfire_connection_state(
    id,status,token_email,expires_at,last_validated_at,last_error,updated_at
  )
  values(1,'ready',p_email,p_expires_at,now(),null,now())
  on conflict(id) do update
    set status='ready',
        token_email=excluded.token_email,
        expires_at=excluded.expires_at,
        last_validated_at=excluded.last_validated_at,
        last_error=null,
        updated_at=now();
end;
$$;

create or replace function public.internal_get_campfire_token()
returns text
language sql
security definer
set search_path = pg_catalog, vault
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name='ca_clover_campfire_token'
  limit 1;
$$;

create or replace function public.internal_clear_campfire_token()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, vault
as $$
begin
  delete from vault.secrets where name='ca_clover_campfire_token';

  update public.campfire_connection_state
  set status='missing',
      token_email=null,
      expires_at=null,
      last_validated_at=null,
      last_sync_at=null,
      last_error=null,
      updated_at=now()
  where id=1;
end;
$$;

revoke all on function public.internal_set_campfire_token(text,text,timestamptz) from public, anon, authenticated;
revoke all on function public.internal_get_campfire_token() from public, anon, authenticated;
revoke all on function public.internal_clear_campfire_token() from public, anon, authenticated;

grant execute on function public.internal_set_campfire_token(text,text,timestamptz) to service_role;
grant execute on function public.internal_get_campfire_token() to service_role;
grant execute on function public.internal_clear_campfire_token() to service_role;

create or replace function public.activity_summary(
  p_days integer default 30
)
returns table(
  meetup_count bigint,
  ca_meetup_count bigint,
  rsvp_count bigint,
  checkin_count bigint,
  last_event_at timestamptz
)
language sql
stable
set search_path = public, pg_temp
as $$
  select
    count(*)::bigint,
    count(*) filter (where coalesce(m.is_ca_meetup,false))::bigint,
    coalesce(sum(m.rsvp_count),0)::bigint,
    coalesce(sum(m.checkin_count),0)::bigint,
    max(m.starts_at)
  from public.meetups m
  where m.starts_at >= now() - make_interval(days => greatest(1,least(coalesce(p_days,30),3650)));
$$;

grant execute on function public.activity_summary(integer) to authenticated;

create or replace function public.activity_monthly(
  p_months integer default 12
)
returns table(
  month date,
  meetup_count bigint,
  rsvp_count bigint,
  checkin_count bigint
)
language sql
stable
set search_path = public, pg_temp
as $$
  select
    date_trunc('month',m.starts_at)::date,
    count(*)::bigint,
    coalesce(sum(m.rsvp_count),0)::bigint,
    coalesce(sum(m.checkin_count),0)::bigint
  from public.meetups m
  where m.starts_at >= date_trunc('month',now())
    - make_interval(months => greatest(0,least(coalesce(p_months,12),120)-1))
  group by date_trunc('month',m.starts_at)
  order by 1;
$$;

grant execute on function public.activity_monthly(integer) to authenticated;
