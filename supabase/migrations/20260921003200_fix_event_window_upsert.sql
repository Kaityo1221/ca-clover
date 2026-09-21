drop index if exists public.official_event_windows_source_key_uidx;

create unique index if not exists official_event_windows_source_key_uidx
  on public.official_event_windows(source,source_key);
