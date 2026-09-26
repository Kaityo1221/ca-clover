create table if not exists public.monthly_clover_snapshots (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete cascade,
  month_start date not null,
  meetup_count integer not null default 0 check (meetup_count >= 0),
  checkin_count integer not null default 0 check (checkin_count >= 0),
  exchange_count integer not null default 0 check (exchange_count >= 0),
  active_week_count integer not null default 0 check (active_week_count >= 0),
  host_stage smallint not null default 0 check (host_stage between 0 and 4),
  join_stage smallint not null default 0 check (join_stage between 0 and 4),
  exchange_stage smallint not null default 0 check (exchange_stage between 0 and 4),
  continue_stage smallint not null default 0 check (continue_stage between 0 and 4),
  rules_version text not null default '2026-09-v2',
  refreshed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (owner_user_id, community_id, month_start),
  check (month_start = date_trunc('month', month_start::timestamp)::date)
);

create index if not exists monthly_clover_snapshots_owner_month_idx
  on public.monthly_clover_snapshots(owner_user_id, month_start desc);
create index if not exists monthly_clover_snapshots_community_month_idx
  on public.monthly_clover_snapshots(community_id, month_start desc);

alter table public.monthly_clover_snapshots enable row level security;

drop policy if exists "monthly clover owner read" on public.monthly_clover_snapshots;
create policy "monthly clover owner read"
  on public.monthly_clover_snapshots
  for select
  to authenticated
  using (
    owner_user_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create or replace function public.refresh_monthly_clover_snapshot(
  p_community_id uuid,
  p_month_start date
)
returns public.monthly_clover_snapshots
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_month date := date_trunc('month', p_month_start::timestamp)::date;
  v_next_month date := (date_trunc('month', p_month_start::timestamp) + interval '1 month')::date;
  v_start_ts timestamptz := (date_trunc('month', p_month_start::timestamp)) at time zone 'Asia/Tokyo';
  v_end_ts timestamptz := (date_trunc('month', p_month_start::timestamp) + interval '1 month') at time zone 'Asia/Tokyo';
  v_meetups integer := 0;
  v_checkins integer := 0;
  v_exchanges integer := 0;
  v_weeks integer := 0;
  v_host smallint := 0;
  v_join smallint := 0;
  v_exchange smallint := 0;
  v_continue smallint := 0;
  v_row public.monthly_clover_snapshots;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if not exists (
    select 1
    from public.community_memberships cm
    where cm.user_id = v_uid and cm.community_id = p_community_id
  ) and not exists (
    select 1 from public.profiles p
    where p.id = v_uid and p.role = 'admin'
  ) then
    raise exception 'community_access_denied';
  end if;

  select count(*)::integer,
         coalesce(sum(coalesce(m.checkin_count, 0)), 0)::integer,
         count(distinct date_trunc('week', timezone('Asia/Tokyo', m.starts_at)))::integer
    into v_meetups, v_checkins, v_weeks
  from public.meetups m
  where m.community_id = p_community_id
    and m.starts_at >= v_start_ts
    and m.starts_at < v_end_ts;

  with exchange_events as (
    select sc.stamp_ca_member_id,
           timezone('Asia/Tokyo', sc.first_acquired_at)::date as local_day
    from public.stamp_collections sc
    where sc.owner_user_id = v_uid
      and sc.first_acquired_at >= v_start_ts
      and sc.first_acquired_at < v_end_ts
      and sc.stamp_ca_member_id is not null

    union

    select sc.stamp_ca_member_id,
           coalesce(r.local_date, timezone('Asia/Tokyo', r.met_at)::date) as local_day
    from public.stamp_reunions r
    join public.stamp_collections sc on sc.id = r.collection_id
    where sc.owner_user_id = v_uid
      and coalesce(r.local_date, timezone('Asia/Tokyo', r.met_at)::date) >= v_month
      and coalesce(r.local_date, timezone('Asia/Tokyo', r.met_at)::date) < v_next_month
      and sc.stamp_ca_member_id is not null
  )
  select count(*)::integer
    into v_exchanges
  from (
    select distinct stamp_ca_member_id, local_day
    from exchange_events
    where local_day is not null
  ) d;

  v_host := case when v_meetups <= 0 then 0 when v_meetups < 3 then 1 when v_meetups < 5 then 2 when v_meetups < 8 then 3 else 4 end;
  v_join := case when v_checkins <= 0 then 0 when v_checkins < 50 then 1 when v_checkins < 200 then 2 when v_checkins < 500 then 3 else 4 end;
  v_exchange := case when v_exchanges <= 0 then 0 when v_exchanges < 2 then 1 when v_exchanges < 4 then 2 when v_exchanges < 6 then 3 else 4 end;
  v_continue := case when v_weeks <= 0 then 0 when v_weeks = 1 then 1 when v_weeks = 2 then 2 when v_weeks = 3 then 3 else 4 end;

  insert into public.monthly_clover_snapshots (
    owner_user_id, community_id, month_start,
    meetup_count, checkin_count, exchange_count, active_week_count,
    host_stage, join_stage, exchange_stage, continue_stage,
    rules_version, refreshed_at
  ) values (
    v_uid, p_community_id, v_month,
    v_meetups, v_checkins, v_exchanges, v_weeks,
    v_host, v_join, v_exchange, v_continue,
    '2026-09-v2', now()
  )
  on conflict (owner_user_id, community_id, month_start)
  do update set
    meetup_count = excluded.meetup_count,
    checkin_count = excluded.checkin_count,
    exchange_count = excluded.exchange_count,
    active_week_count = excluded.active_week_count,
    host_stage = excluded.host_stage,
    join_stage = excluded.join_stage,
    exchange_stage = excluded.exchange_stage,
    continue_stage = excluded.continue_stage,
    rules_version = excluded.rules_version,
    refreshed_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.refresh_monthly_clover_snapshot(uuid, date) from public;
grant execute on function public.refresh_monthly_clover_snapshot(uuid, date) to authenticated;
