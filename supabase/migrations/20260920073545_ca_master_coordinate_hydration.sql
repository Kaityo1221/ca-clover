alter table public.sync_automation_state
  add column if not exists last_ca_master_at timestamptz,
  add column if not exists last_ca_master_updated integer not null default 0;

create or replace function public.internal_update_ca_master_coordinates(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_ca_updated integer := 0;
  v_community_updated integer := 0;
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'p_rows must be a JSON array';
  end if;

  with incoming as (
    select
      lower(btrim(source_key)) as source_key,
      latitude::double precision as latitude,
      longitude::double precision as longitude
    from jsonb_to_recordset(p_rows)
      as x(source_key text, latitude double precision, longitude double precision)
    where source_key is not null
      and latitude between -90 and 90
      and longitude between -180 and 180
  ),
  updated as (
    update public.ca_members cm
    set
      latitude=i.latitude,
      longitude=i.longitude
    from incoming i
    where cm.source_key=i.source_key
      and (
        cm.latitude is distinct from i.latitude
        or cm.longitude is distinct from i.longitude
      )
    returning cm.id
  )
  select count(*) into v_ca_updated from updated;

  with ranked as (
    select
      c.id as community_id,
      cm.latitude,
      cm.longitude,
      row_number() over (
        partition by c.id
        order by
          case when cm.ca_level='1st' then 0 else 1 end,
          cm.source_key
      ) as rn
    from public.communities c
    join public.community_ca_members l on l.community_id=c.id
    join public.ca_members cm on cm.id=l.ca_member_id
    where cm.latitude is not null
      and cm.longitude is not null
  ),
  updated as (
    update public.communities c
    set
      latitude=r.latitude,
      longitude=r.longitude,
      fetched_at=coalesce(c.fetched_at,now())
    from ranked r
    where r.community_id=c.id
      and r.rn=1
      and (c.latitude is null or c.longitude is null)
    returning c.id
  )
  select count(*) into v_community_updated from updated;

  return jsonb_build_object(
    'ca_updated',v_ca_updated,
    'community_updated',v_community_updated
  );
end;
$$;

revoke all on function public.internal_update_ca_master_coordinates(jsonb)
  from public,anon,authenticated;
grant execute on function public.internal_update_ca_master_coordinates(jsonb)
  to service_role;
