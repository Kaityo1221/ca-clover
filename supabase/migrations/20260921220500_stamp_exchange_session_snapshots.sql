
alter table public.stamp_exchange_sessions
  add column if not exists issuer_snapshot jsonb,
  add column if not exists scanner_snapshot jsonb,
  add column if not exists last_client_seen_at timestamptz;

comment on column public.stamp_exchange_sessions.issuer_snapshot is
  'Cached issuer CA/Community display data for resilient exchange UI.';
comment on column public.stamp_exchange_sessions.scanner_snapshot is
  'Cached scanner CA/Community display data for resilient exchange UI.';
