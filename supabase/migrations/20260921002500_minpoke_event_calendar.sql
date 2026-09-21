create table if not exists public.event_calendar_entries (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  source_key text not null,
  source_url text,
  event_name text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  duration_minutes integer not null default 0,
  is_all_day boolean not null default false,
  watch_window_eligible boolean not null default false,
  raw_uid text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists event_calendar_entries_source_key_uidx
  on public.event_calendar_entries(source,source_key);
create index if not exists event_calendar_entries_time_idx
  on public.event_calendar_entries(starts_at,ends_at);
create index if not exists event_calendar_entries_watch_idx
  on public.event_calendar_entries(watch_window_eligible,starts_at);

alter table public.event_calendar_entries enable row level security;
drop policy if exists "admin only event_calendar_entries" on public.event_calendar_entries;
create policy "admin only event_calendar_entries"
  on public.event_calendar_entries for all to authenticated
  using (private.is_admin()) with check (private.is_admin());
grant select,insert,update,delete on public.event_calendar_entries to authenticated;

alter table public.official_event_windows
  add column if not exists source text not null default 'manual',
  add column if not exists source_key text,
  add column if not exists calendar_entry_id uuid references public.event_calendar_entries(id) on delete set null,
  add column if not exists auto_managed boolean not null default false;

create unique index if not exists official_event_windows_source_key_uidx
  on public.official_event_windows(source,source_key)
  where source_key is not null;

alter table public.sync_automation_state
  add column if not exists last_event_calendar_at timestamptz;

alter table public.watch_settings
  add column if not exists event_calendar_sync_interval_minutes integer not null default 360
    check (event_calendar_sync_interval_minutes between 30 and 10080);

update public.watch_settings
set
  rule_config = coalesce(rule_config,'{}'::jsonb)
    || jsonb_build_object(
      'official_pre_grace_minutes',60,
      'official_grace_minutes',60,
      'official_strong_outside_minutes',120,
      'official_max_window_minutes',720
    ),
  rule_version=greatest(rule_version,3),
  updated_at=now()
where id=1;

comment on table public.event_calendar_entries is
  'Reference calendar events imported for Meetup Watch. Source data is not treated as an official Niantic feed.';
comment on column public.event_calendar_entries.watch_window_eligible is
  'True only when the event duration is short enough to be used as a Meetup Watch grace window.';
comment on column public.official_event_windows.source is
  'manual or external reference source such as minpoke_event_ical.';
