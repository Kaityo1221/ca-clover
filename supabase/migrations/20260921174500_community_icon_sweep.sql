alter table public.sync_automation_state
  add column if not exists icon_offset integer not null default 0 check (icon_offset>=0),
  add column if not exists icon_batch_size integer not null default 10 check (icon_batch_size between 1 and 10),
  add column if not exists last_icon_at timestamptz,
  add column if not exists last_icon_processed integer not null default 0,
  add column if not exists last_icon_changed integer not null default 0;
