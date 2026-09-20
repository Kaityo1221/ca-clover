alter table public.meetups
  add column if not exists campfire_created_at timestamptz;

alter table public.watch_terms
  add column if not exists updated_at timestamptz not null default now();

alter table public.meetup_watch_findings
  add column if not exists score_weight smallint not null default 0
    check (score_weight between 0 and 5);

alter table public.meetup_watch_cases
  add column if not exists score integer not null default 0 check (score >= 0),
  add column if not exists priority_level text not null default 'record'
    check (priority_level in ('record','review','high')),
  add column if not exists high_priority boolean not null default false,
  add column if not exists discord_candidate boolean not null default false;

alter table public.watch_settings
  add column if not exists hot_scan_interval_minutes integer not null default 5
    check (hot_scan_interval_minutes between 5 and 60),
  add column if not exists normal_scan_interval_minutes integer not null default 15
    check (normal_scan_interval_minutes between 5 and 180),
  add column if not exists discord_enabled boolean not null default false;

update public.watch_settings
set
  hot_ttl_minutes=60,
  hot_scan_interval_minutes=5,
  normal_scan_interval_minutes=15,
  rule_version=2,
  rule_config=jsonb_build_object(
    'repeat_close_minutes',30,
    'low_checkin_max',1,
    'low_checkin_repeat_max',2,
    'low_checkin_repeat_count',3,
    'low_checkin_repeat_days',30,
    'created_last_minute_minutes',10,
    'official_grace_minutes',60,
    'official_strong_outside_minutes',120
  ),
  updated_at=now()
where id=1;

create table if not exists public.official_event_windows (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  enabled boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create unique index if not exists official_event_windows_name_start_uidx
  on public.official_event_windows (lower(event_name),starts_at);
create index if not exists official_event_windows_enabled_time_idx
  on public.official_event_windows (enabled,starts_at,ends_at);

alter table public.official_event_windows enable row level security;
drop policy if exists "admin only official_event_windows" on public.official_event_windows;
create policy "admin only official_event_windows"
  on public.official_event_windows for all to authenticated
  using (private.is_admin()) with check (private.is_admin());
grant select,insert,update,delete on public.official_event_windows to authenticated;

create or replace function public.internal_get_meetup_watch_discord_webhook()
returns text language sql security definer set search_path=public,vault,pg_temp as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name='meetup_watch_discord_webhook'
  order by created_at desc
  limit 1;
$$;
revoke all on function public.internal_get_meetup_watch_discord_webhook() from public,anon,authenticated;
grant execute on function public.internal_get_meetup_watch_discord_webhook() to service_role;

update public.watch_terms
set
  flag_code=case
    when category in ('private_limited','english_private','participation_limit','english_limit') then 'PARTICIPATION_RESTRICTED'
    when category in ('secret','english_secret') then 'TITLE_STRONG'
    when category in ('host_absent','english_host_absent') then 'HOST_ABSENT_TEXT'
    when category in ('non_attendance','english_non_attendance') then 'NON_FACE_TO_FACE'
    when category='checkin_only' then 'CHECKIN_ONLY'
    when category='free_checkin' then 'FREE_CHECKIN_TEXT'
    when category='english_checkin' and lower(phrase) like '%free%' then 'FREE_CHECKIN_TEXT'
    when category='english_checkin' then 'CHECKIN_ONLY'
    when category in ('reward','english_reward') then 'REWARD_ONLY'
    when category='short_quick' then 'TITLE_CAUTION'
    else flag_code
  end,
  severity=case
    when category in ('private_limited','english_private','participation_limit','english_limit') then 3
    when category in ('secret','english_secret') then 3
    when category in ('host_absent','english_host_absent') then 3
    when category in ('non_attendance','english_non_attendance') then 3
    when category in ('checkin_only','english_checkin') then 2
    when category='free_checkin' then 2
    when category in ('reward','english_reward') then 3
    when category='short_quick' then 2
    else severity
  end,
  rule_version=2,
  updated_at=now();

delete from public.watch_terms where phrase='参加者限定';

insert into public.watch_terms
  (phrase,category,severity,flag_code,regex,negative_pattern,enabled,rule_version,created_at,updated_at)
values
  ('ホスト不在','host_absent',3,'HOST_ABSENT_TEXT',false,'(?:ではありません|ではない|禁止|不可|NG|ＮＧ|お断り|しません|しない|ではございません)',true,2,now(),now()),
  ('一般参加不可','participation_limit',3,'PARTICIPATION_RESTRICTED',false,'(?:ではありません|ではない|禁止|不可|NG|ＮＧ|お断り|しません|しない|ではございません)',true,2,now(),now()),
  ('部外者お断り','participation_limit',3,'PARTICIPATION_RESTRICTED',false,'(?:ではありません|ではない|禁止|不可|NG|ＮＧ|お断り|しません|しない|ではございません)',true,2,now(),now()),
  ('確認なし','free_checkin',2,'FREE_CHECKIN_TEXT',false,'(?:ではありません|ではない|禁止|不可|NG|ＮＧ|お断り|しません|しない|ではございません)',true,2,now(),now())
on conflict (lower(phrase),category) do update
set severity=excluded.severity,
    flag_code=excluded.flag_code,
    negative_pattern=excluded.negative_pattern,
    enabled=true,
    rule_version=2,
    updated_at=now();

update public.meetup_watch_cases
set review_required=false,
    score=0,
    priority=0,
    priority_level='record',
    high_priority=false,
    discord_candidate=false,
    updated_at=now();

update public.meetup_watch_notifications
set status='skipped',
    last_error='Superseded by Meetup Watch v1.0 scoring'
where status='queued';

update public.watch_community_state s
set hot_until=coalesce(m.ends_at,m.starts_at)+interval '1 hour',
    next_hot_scan_at=case
      when coalesce(m.ends_at,m.starts_at)+interval '1 hour'>now() then now()
      else s.next_hot_scan_at
    end,
    updated_at=now()
from public.meetups m
where m.id=s.hot_meetup_id
  and coalesce(m.ends_at,m.starts_at) is not null;

do $$
declare
  v_jobid bigint;
  v_command text;
begin
  select jobid,command into v_jobid,v_command
  from cron.job
  where jobname in ('ca-clover-auto-sync-15m','ca-clover-auto-sync-5m')
  order by case when jobname='ca-clover-auto-sync-5m' then 0 else 1 end
  limit 1;
  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
    perform cron.schedule('ca-clover-auto-sync-5m','*/5 * * * *',v_command);
  end if;
end $$;
