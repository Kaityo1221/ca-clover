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
set search_path to 'public', 'pg_temp'
as $function$
  select
    count(*)::bigint,
    count(*) filter (where coalesce(m.is_ca_meetup, false))::bigint,
    coalesce(sum(m.rsvp_count), 0)::bigint,
    coalesce(sum(m.checkin_count), 0)::bigint,
    max(m.starts_at)
  from public.meetups m
  where m.community_id = p_community_id
    and (
      p_days is null
      or m.starts_at >= now() - make_interval(days => greatest(1, least(p_days, 3650)))
    );
$function$;