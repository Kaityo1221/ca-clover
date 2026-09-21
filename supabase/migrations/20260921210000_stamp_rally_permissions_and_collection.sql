create table public.user_permissions(
  user_id uuid not null references public.profiles(id) on delete cascade,
  permission_code text not null
    check (permission_code ~ '^[A-Z][A-Z0-9_]{0,31}$'),
  granted_at timestamptz not null default now(),
  granted_by uuid references public.profiles(id) on delete set null,
  primary key(user_id, permission_code)
);

create index user_permissions_code_idx
  on public.user_permissions(permission_code, user_id);

alter table public.user_permissions enable row level security;

create or replace function private.has_permission(p_permission_code text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists(
    select 1
    from public.user_permissions up
    where up.user_id = (select auth.uid())
      and up.permission_code = upper(trim(p_permission_code))
  );
$$;

grant execute on function private.has_permission(text) to authenticated;

create policy "permissions self or admin read"
on public.user_permissions
for select
to authenticated
using(user_id = (select auth.uid()) or private.is_admin());

revoke all on public.user_permissions from anon, authenticated;
grant select on public.user_permissions to authenticated;

create policy "stamp access reads communities"
on public.communities
for select
to authenticated
using(private.has_permission('S'));

create policy "stamp access reads community ca links"
on public.community_ca_members
for select
to authenticated
using(private.has_permission('S'));

create policy "stamp access reads ca master"
on public.ca_members
for select
to authenticated
using(private.has_permission('S'));

create table public.stamp_collections(
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  stamp_ca_member_id uuid not null references public.ca_members(id) on delete restrict,
  community_id uuid not null references public.communities(id) on delete restrict,
  role_at_acquisition text check (role_at_acquisition in ('1st','2nd')),
  first_acquired_at timestamptz not null default now(),
  first_location text,
  first_event_name text,
  acquisition_source text not null default 'normal'
    check (acquisition_source in ('normal','event','bulk','admin','import')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_user_id, stamp_ca_member_id, community_id)
);

create index stamp_collections_owner_idx
  on public.stamp_collections(owner_user_id, first_acquired_at desc);
create index stamp_collections_ca_idx
  on public.stamp_collections(stamp_ca_member_id);
create index stamp_collections_community_idx
  on public.stamp_collections(community_id);

alter table public.stamp_collections enable row level security;

create policy "stamp collections owner or admin read"
on public.stamp_collections
for select
to authenticated
using(owner_user_id = (select auth.uid()) or private.is_admin());

revoke all on public.stamp_collections from anon, authenticated;
grant select on public.stamp_collections to authenticated;

create table public.stamp_reunions(
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.stamp_collections(id) on delete cascade,
  met_at timestamptz not null default now(),
  local_date date,
  timezone text,
  location text,
  event_name text,
  reunion_source text not null default 'normal'
    check (reunion_source in ('normal','event','bulk','admin','import')),
  created_at timestamptz not null default now()
);

create index stamp_reunions_collection_idx
  on public.stamp_reunions(collection_id, met_at desc);
create index stamp_reunions_local_date_idx
  on public.stamp_reunions(collection_id, local_date);

alter table public.stamp_reunions enable row level security;

create policy "stamp reunions owner or admin read"
on public.stamp_reunions
for select
to authenticated
using(
  private.is_admin()
  or exists(
    select 1
    from public.stamp_collections sc
    where sc.id = stamp_reunions.collection_id
      and sc.owner_user_id = (select auth.uid())
  )
);

revoke all on public.stamp_reunions from anon, authenticated;
grant select on public.stamp_reunions to authenticated;

comment on table public.user_permissions is
  'Extra feature permissions. S grants CA Stamp Rally LAB access without changing the base CA/ADMIN role.';
comment on table public.stamp_collections is
  'One collected CA stamp per owner, CA and Community. Stores immutable first-acquisition context.';
comment on table public.stamp_reunions is
  'Subsequent meetings for an already-collected stamp. Day-level dedupe is enforced in the exchange layer later.';
