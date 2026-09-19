create table if not exists public.community_access_requests(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  community_id uuid not null references public.communities(id) on delete cascade,
  campfire_meetup_id text not null,
  meetup_url text not null,
  meetup_title text not null,
  community_name_snapshot text not null,
  community_prefecture_snapshot text,
  is_ca_meetup boolean,
  meetup_starts_at timestamptz,
  meetup_ends_at timestamptz,
  meetup_location text,
  rsvp_count integer,
  checkin_count integer,
  campfire_live_event_name text,
  master_match boolean,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  review_note text
);

create unique index if not exists community_access_requests_pending_key
  on public.community_access_requests(user_id,community_id)
  where status='pending';

create index if not exists community_access_requests_status_idx
  on public.community_access_requests(status,requested_at desc);

create index if not exists community_access_requests_user_idx
  on public.community_access_requests(user_id,requested_at desc);

alter table public.community_access_requests enable row level security;

drop policy if exists "claim requests self or admin read" on public.community_access_requests;
create policy "claim requests self or admin read"
on public.community_access_requests
for select
to authenticated
using(user_id=(select auth.uid()) or private.is_admin());

revoke all on public.community_access_requests from anon, authenticated;
grant select on public.community_access_requests to authenticated;
