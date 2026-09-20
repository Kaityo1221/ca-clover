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
set hot_ttl_minutes=60,
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
create policy "admin only official_event_windows" on public.official_event_windows
  for all to authenticated using (private.is_admin()) with check (private.is_admin());
grant select,insert,update,delete on public.official_event_windows to authenticated;

create or replace function public.internal_get_meetup_watch_discord_webhook()
returns text language sql security definer set search_path=public,vault,pg_temp as $$
  select decrypted_secret from vault.decrypted_secrets
  where name='meetup_watch_discord_webhook'
  order by created_at desc limit 1;
$$;
revoke all on function public.internal_get_meetup_watch_discord_webhook() from public,anon,authenticated;
grant execute on function public.internal_get_meetup_watch_discord_webhook() to service_role;
