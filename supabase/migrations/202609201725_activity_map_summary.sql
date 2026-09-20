-- Phase 1 Activity Map aggregation.
-- Returns one row per visible Community and keeps RLS in force because this is
-- a security-invoker SQL function (the default).

create or replace function public.activity_map_summary(
  p_days integer default 30
)
returns table(
  community_id uuid,
  community_name text,
  prefecture text,
  latitude double precision,
  longitude double precision,
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
    c.id as community_id,
    c.name as community_name,
    c.prefecture,
    c.latitude,
    c.longitude,
    count(m.id)::bigint as meetup_count,
    count(m.id) filter (where coalesce(m.is_ca_meetup, false))::bigint as ca_meetup_count,
    coalesce(sum(m.rsvp_count), 0)::bigint as rsvp_count,
    coalesce(sum(m.checkin_count), 0)::bigint as checkin_count,
    max(m.starts_at) as last_event_at
  from public.communities c
  left join public.meetups m
    on m.community_id = c.id
   and (
     coalesce(p_days, 30) <= 0
     or m.starts_at >= now()
       - make_interval(days => greatest(1, least(coalesce(p_days, 30), 3650)))
   )
  where c.latitude is not null
    and c.longitude is not null
  group by
    c.id,
    c.name,
    c.prefecture,
    c.latitude,
    c.longitude
  order by c.prefecture nulls last, c.name;
$$;

grant execute on function public.activity_map_summary(integer) to authenticated;
