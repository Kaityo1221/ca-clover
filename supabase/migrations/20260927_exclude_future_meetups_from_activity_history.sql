create or replace function public.community_activity_summary(p_community_id uuid, p_days integer default 30)
returns table(meetup_count bigint, ca_meetup_count bigint, rsvp_count bigint, checkin_count bigint, last_event_at timestamptz)
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
    and m.starts_at <= now()
    and (
      p_days is null
      or m.starts_at >= now() - make_interval(days => greatest(1, least(p_days, 3650)))
    );
$function$;

create or replace function public.community_activity_trend(p_community_id uuid, p_bucket text default 'month', p_days integer default 365)
returns table(bucket date, meetup_count bigint, rsvp_count bigint, checkin_count bigint)
language sql
stable
set search_path to 'public', 'pg_temp'
as $function$
  with params as (
    select
      case lower(coalesce(p_bucket,'month'))
        when 'day' then 'day'
        when 'week' then 'week'
        when 'year' then 'year'
        else 'month'
      end as bucket_kind,
      case lower(coalesce(p_bucket,'month'))
        when 'day' then interval '1 day'
        when 'week' then interval '1 week'
        when 'year' then interval '1 year'
        else interval '1 month'
      end as bucket_step
  ),
  bounds as (
    select
      p.bucket_kind,
      p.bucket_step,
      date_trunc(p.bucket_kind, now()) as end_bucket,
      case
        when p_days is null then coalesce(
          (
            select date_trunc(p.bucket_kind, min(m.starts_at))
            from public.meetups m
            where m.community_id=p_community_id
              and m.starts_at is not null
              and m.starts_at <= now()
          ),
          date_trunc(p.bucket_kind, now())
        )
        else date_trunc(
          p.bucket_kind,
          now() - make_interval(days => greatest(1,least(p_days,3650)) - 1)
        )
      end as start_bucket
    from params p
  ),
  series as (
    select
      generate_series(b.start_bucket,b.end_bucket,b.bucket_step) as bucket_start,
      b.bucket_kind
    from bounds b
  ),
  aggregated as (
    select
      date_trunc(p.bucket_kind,m.starts_at) as bucket_start,
      count(*)::bigint as meetup_count,
      coalesce(sum(m.rsvp_count),0)::bigint as rsvp_count,
      coalesce(sum(m.checkin_count),0)::bigint as checkin_count
    from public.meetups m
    cross join params p
    where m.community_id=p_community_id
      and m.starts_at is not null
      and m.starts_at <= now()
      and (
        p_days is null
        or m.starts_at >= now() - make_interval(days => greatest(1,least(p_days,3650)))
      )
    group by date_trunc(p.bucket_kind,m.starts_at)
  )
  select
    s.bucket_start::date as bucket,
    coalesce(a.meetup_count,0)::bigint,
    coalesce(a.rsvp_count,0)::bigint,
    coalesce(a.checkin_count,0)::bigint
  from series s
  left join aggregated a on a.bucket_start=s.bucket_start
  order by s.bucket_start asc;
$function$;
