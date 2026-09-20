create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

create table if not exists public.sync_automation_state(
  id smallint primary key default 1 check (id=1),
  enabled boolean not null default true,
  public_offset integer not null default 0 check (public_offset>=0),
  public_batch_size integer not null default 10 check (public_batch_size between 1 and 10),
  last_started_at timestamptz,
  last_finished_at timestamptz,
  last_public_at timestamptz,
  last_history_at timestamptz,
  last_public_imported integer not null default 0,
  last_history_imported integer not null default 0,
  last_error text,
  updated_at timestamptz not null default now()
);

insert into public.sync_automation_state(id)
values(1)
on conflict(id) do nothing;

alter table public.sync_automation_state enable row level security;

drop policy if exists "automation state admin read" on public.sync_automation_state;
create policy "automation state admin read"
on public.sync_automation_state
for select
to authenticated
using(private.is_admin());

revoke all on public.sync_automation_state from anon,authenticated;
grant select on public.sync_automation_state to authenticated;

do $$
begin
  if not exists (
    select 1 from vault.decrypted_secrets
    where name='ca_clover_sync_cron_secret'
  ) then
    perform vault.create_secret(
      encode(gen_random_bytes(32),'hex'),
      'ca_clover_sync_cron_secret',
      'CA Clover internal automated sync secret'
    );
  end if;
end
$$;

create or replace function public.internal_get_sync_cron_secret()
returns text
language sql
security definer
set search_path=public,vault
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name='ca_clover_sync_cron_secret'
  limit 1
$$;

revoke all on function public.internal_get_sync_cron_secret() from public,anon,authenticated;
grant execute on function public.internal_get_sync_cron_secret() to service_role;

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
  v_changed boolean;
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

  v_changed := v_current_id is distinct from p_campfire_community_id;

  if v_current_id is not null and v_changed then
    insert into public.community_campfire_ids(
      community_id,campfire_community_id,status,source,observed_name,
      first_seen_at,last_seen_at,retired_at
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
    community_id,campfire_community_id,status,source,observed_name,
    first_seen_at,last_seen_at,retired_at
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
    coverage=case when v_changed then 'missing'::coverage_status else coverage end,
    coverage_from=case when v_changed then null else coverage_from end,
    coverage_to=case when v_changed then null else coverage_to end,
    fetched_at=now()
  where id=p_community_id;
end;
$$;

revoke all on function public.internal_set_community_campfire_id(uuid,text,text,text)
  from public,anon,authenticated;
grant execute on function public.internal_set_community_campfire_id(uuid,text,text,text)
  to service_role;
