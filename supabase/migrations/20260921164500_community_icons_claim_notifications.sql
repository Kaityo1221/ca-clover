alter table public.communities
  add column if not exists avatar_url text,
  add column if not exists avatar_content_hash text,
  add column if not exists avatar_last_checked_at timestamptz,
  add column if not exists avatar_last_changed_at timestamptz;

create table if not exists public.community_icon_changes(
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  change_type text not null check (change_type in ('initial','changed')),
  detection_method text not null default 'content_sha256' check (detection_method in ('content_sha256','url_fallback')),
  previous_avatar_url text,
  previous_content_hash text,
  new_avatar_url text not null,
  new_content_hash text not null,
  detected_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null
);

create index if not exists community_icon_changes_pending_idx
  on public.community_icon_changes(reviewed_at,detected_at desc);
create index if not exists community_icon_changes_community_idx
  on public.community_icon_changes(community_id,detected_at desc);

alter table public.community_icon_changes enable row level security;

drop policy if exists "admin reads community icon changes" on public.community_icon_changes;
create policy "admin reads community icon changes"
on public.community_icon_changes
for select
to authenticated
using(private.is_admin());

revoke all on public.community_icon_changes from anon, authenticated;
grant select on public.community_icon_changes to authenticated;

create table if not exists public.community_claim_notifications(
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.community_access_requests(id) on delete cascade,
  channel text not null default 'discord' check (channel in ('discord')),
  status text not null default 'queued' check (status in ('queued','sent','failed')),
  retry_count integer not null default 0 check (retry_count >= 0),
  next_retry_at timestamptz,
  sent_at timestamptz,
  discord_message_id text,
  last_attempt_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);

create index if not exists community_claim_notifications_queue_idx
  on public.community_claim_notifications(status,next_retry_at,created_at);

alter table public.community_claim_notifications enable row level security;

drop policy if exists "admin reads community claim notifications" on public.community_claim_notifications;
create policy "admin reads community claim notifications"
on public.community_claim_notifications
for select
to authenticated
using(private.is_admin());

revoke all on public.community_claim_notifications from anon, authenticated;
grant select on public.community_claim_notifications to authenticated;
