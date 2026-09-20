alter table public.meetup_watch_notifications
  add column if not exists notification_type text not null default 'initial'
    check (notification_type in ('initial','update')),
  add column if not exists notification_key text,
  add column if not exists flags text[] not null default '{}'::text[],
  add column if not exists score integer not null default 0 check (score >= 0),
  add column if not exists discord_message_id text,
  add column if not exists error_message text,
  add column if not exists retry_count integer not null default 0 check (retry_count >= 0),
  add column if not exists next_retry_at timestamptz,
  add column if not exists last_attempt_at timestamptz;

update public.meetup_watch_notifications
set notification_key=dedupe_key
where notification_key is null;

create unique index if not exists meetup_watch_notifications_notification_key_uidx
  on public.meetup_watch_notifications(notification_key)
  where notification_key is not null;

create index if not exists meetup_watch_notifications_retry_idx
  on public.meetup_watch_notifications(status,next_retry_at,created_at);

comment on column public.meetup_watch_notifications.notification_type is
  'initial = first Discord alert, update = new strong flag added after a sent alert.';
comment on column public.meetup_watch_notifications.notification_key is
  'Unique key for the Meetup and normalized notification reason set.';
comment on column public.meetup_watch_notifications.retry_count is
  'Number of Discord delivery failures. Delivery stops after three attempts.';

drop function if exists public.internal_get_meetup_watch_discord_webhook();
