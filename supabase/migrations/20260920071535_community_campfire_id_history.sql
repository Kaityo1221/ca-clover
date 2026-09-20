create table if not exists public.community_campfire_ids(
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  campfire_community_id text not null unique,
  status text not null default 'active' check (status in ('active','retired')),
  source text not null default 'backfill',
  observed_name text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  retired_at timestamptz
);

create unique index if not exists community_campfire_ids_one_active_per_community
  on public.community_campfire_ids(community_id)
  where status='active';

create index if not exists community_campfire_ids_community_idx
  on public.community_campfire_ids(community_id,last_seen_at desc);

alter table public.community_campfire_ids enable row level security;
revoke all on public.community_campfire_ids from anon,authenticated;

insert into public.community_campfire_ids(
  community_id,campfire_community_id,status,source,observed_name,first_seen_at,last_seen_at
)
select
  id,campfire_community_id,'active','backfill-current',name,
  coalesce(created_at,now()),coalesce(fetched_at,now())
from public.communities
where campfire_community_id is not null
on conflict (campfire_community_id) do update
set
  community_id=excluded.community_id,
  status='active',
  observed_name=coalesce(public.community_campfire_ids.observed_name,excluded.observed_name),
  last_seen_at=greatest(public.community_campfire_ids.last_seen_at,excluded.last_seen_at),
  retired_at=null;

alter table public.community_access_requests
  add column if not exists campfire_community_id_snapshot text,
  add column if not exists campfire_community_name_snapshot text,
  add column if not exists community_id_resolution text;

create index if not exists community_access_requests_campfire_community_idx
  on public.community_access_requests(campfire_community_id_snapshot);

create or replace function public.internal_set_community_campfire_id(
  p_community_id uuid,
  p_campfire_community_id text,
  p_source text default 'campfire-claim',
  p_observed_name text default null
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_existing_owner uuid;
  v_current_id text;
begin
  if p_community_id is null or nullif(btrim(p_campfire_community_id),'') is null then
    raise exception 'community_id and campfire_community_id are required';
  end if;

  select community_id into v_existing_owner
  from public.community_campfire_ids
  where campfire_community_id=p_campfire_community_id;

  if v_existing_owner is not null and v_existing_owner<>p_community_id then
    raise exception 'Campfire Community ID % already belongs to another Community',p_campfire_community_id;
  end if;

  select campfire_community_id into v_current_id
  from public.communities
  where id=p_community_id
  for update;

  if not found then
    raise exception 'Community % not found',p_community_id;
  end if;

  if v_current_id is not null and v_current_id<>p_campfire_community_id then
    insert into public.community_campfire_ids(
      community_id,campfire_community_id,status,source,observed_name,first_seen_at,last_seen_at,retired_at
    )
    select
      p_community_id,v_current_id,'retired','previous-current',name,
      coalesce(created_at,now()),now(),now()
    from public.communities
    where id=p_community_id
    on conflict (campfire_community_id) do update
    set
      status='retired',
      last_seen_at=now(),
      retired_at=coalesce(public.community_campfire_ids.retired_at,now());
  end if;

  update public.community_campfire_ids
  set status='retired',last_seen_at=now(),retired_at=coalesce(retired_at,now())
  where community_id=p_community_id
    and campfire_community_id<>p_campfire_community_id
    and status='active';

  insert into public.community_campfire_ids(
    community_id,campfire_community_id,status,source,observed_name,first_seen_at,last_seen_at,retired_at
  )
  values(
    p_community_id,p_campfire_community_id,'active',
    coalesce(nullif(btrim(p_source),''),'campfire-claim'),
    nullif(btrim(p_observed_name),''),now(),now(),null
  )
  on conflict (campfire_community_id) do update
  set
    community_id=excluded.community_id,
    status='active',
    source=excluded.source,
    observed_name=coalesce(excluded.observed_name,public.community_campfire_ids.observed_name),
    last_seen_at=now(),
    retired_at=null;

  update public.communities
  set
    campfire_community_id=p_campfire_community_id,
    name=coalesce(nullif(btrim(p_observed_name),''),name),
    fetched_at=now()
  where id=p_community_id;
end;
$$;

revoke all on function public.internal_set_community_campfire_id(uuid,text,text,text)
  from public,anon,authenticated;
grant execute on function public.internal_set_community_campfire_id(uuid,text,text,text)
  to service_role;
