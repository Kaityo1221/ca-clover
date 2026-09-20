alter table public.meetups
  add column if not exists structure_hash text,
  add column if not exists activity_hash text;

create table if not exists public.watch_settings (
  id smallint primary key default 1 check (id = 1),
  enabled boolean not null default true,
  hot_ttl_minutes integer not null default 360 check (hot_ttl_minutes between 15 and 10080),
  hot_batch_size integer not null default 3 check (hot_batch_size between 1 and 20),
  watch_lookback_days integer not null default 30 check (watch_lookback_days between 1 and 365),
  rule_version integer not null default 1,
  rule_config jsonb not null default '{"repeat_close_minutes":180,"low_checkin_enabled":false,"low_checkin_max":2,"low_checkin_repeat_count":3,"rsvp_checkin_gap_enabled":false,"rsvp_gap_min":10,"rsvp_checkin_ratio_max":0.25,"official_time_enabled":false}'::jsonb,
  updated_at timestamptz not null default now()
);
insert into public.watch_settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.watch_terms (
  id uuid primary key default gen_random_uuid(),
  phrase text not null,
  category text not null,
  severity smallint not null default 2 check (severity between 1 and 5),
  flag_code text not null,
  regex boolean not null default false,
  negative_pattern text,
  enabled boolean not null default true,
  rule_version integer not null default 1,
  created_at timestamptz not null default now()
);
create unique index if not exists watch_terms_phrase_category_uidx on public.watch_terms (lower(phrase),category);
create index if not exists watch_terms_enabled_category_idx on public.watch_terms (enabled,category);

create table if not exists public.meetup_watch_cases (
  id uuid primary key default gen_random_uuid(),
  meetup_id uuid not null unique references public.meetups(id) on delete cascade,
  community_id uuid references public.communities(id) on delete cascade,
  status text not null default 'unreviewed' check (status in ('unreviewed','no_issue','contact_host','sop_in_progress','completed')),
  review_required boolean not null default false,
  priority smallint not null default 0 check (priority between 0 and 5),
  is_hot_trigger boolean not null default false,
  flags text[] not null default '{}'::text[],
  reason_summary text,
  first_detected_at timestamptz not null default now(),
  last_evaluated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  review_note text,
  updated_at timestamptz not null default now()
);
create index if not exists meetup_watch_cases_queue_idx on public.meetup_watch_cases (review_required,status,priority desc,last_evaluated_at desc);
create index if not exists meetup_watch_cases_community_idx on public.meetup_watch_cases (community_id,last_evaluated_at desc);

create table if not exists public.meetup_watch_findings (
  id uuid primary key default gen_random_uuid(),
  meetup_id uuid not null references public.meetups(id) on delete cascade,
  case_id uuid not null references public.meetup_watch_cases(id) on delete cascade,
  watch_term_id uuid references public.watch_terms(id) on delete set null,
  finding_key text not null,
  flag_code text not null,
  category text not null,
  severity smallint not null check (severity between 1 and 5),
  reason text not null,
  matched_field text,
  matched_text text,
  match_start integer,
  match_end integer,
  source_class text not null default 'structure' check (source_class in ('structure','activity','repeat','reserved')),
  active boolean not null default true,
  rule_version integer not null default 1,
  first_detected_at timestamptz not null default now(),
  last_detected_at timestamptz not null default now()
);
create unique index if not exists meetup_watch_findings_key_uidx on public.meetup_watch_findings (meetup_id,finding_key);
create index if not exists meetup_watch_findings_active_idx on public.meetup_watch_findings (meetup_id,active,severity desc);

create table if not exists public.watch_community_state (
  community_id uuid primary key references public.communities(id) on delete cascade,
  hot_until timestamptz,
  hot_reasons text[] not null default '{}'::text[],
  hot_meetup_id uuid references public.meetups(id) on delete set null,
  last_hot_scan_at timestamptz,
  next_hot_scan_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists watch_community_state_hot_idx on public.watch_community_state (hot_until desc,next_hot_scan_at) where hot_until is not null;

create table if not exists public.meetup_watch_notifications (
  id uuid primary key default gen_random_uuid(),
  meetup_id uuid not null references public.meetups(id) on delete cascade,
  case_id uuid references public.meetup_watch_cases(id) on delete cascade,
  channel text not null default 'discord',
  dedupe_key text not null unique,
  status text not null default 'queued' check (status in ('queued','sent','failed','skipped')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  last_error text
);
create index if not exists meetup_watch_notifications_status_idx on public.meetup_watch_notifications (status,created_at);

alter table public.watch_settings enable row level security;
alter table public.watch_terms enable row level security;
alter table public.meetup_watch_cases enable row level security;
alter table public.meetup_watch_findings enable row level security;
alter table public.watch_community_state enable row level security;
alter table public.meetup_watch_notifications enable row level security;

drop policy if exists "admin only watch_settings" on public.watch_settings;
create policy "admin only watch_settings" on public.watch_settings for all to authenticated using (private.is_admin()) with check (private.is_admin());
drop policy if exists "admin only watch_terms" on public.watch_terms;
create policy "admin only watch_terms" on public.watch_terms for all to authenticated using (private.is_admin()) with check (private.is_admin());
drop policy if exists "admin only meetup_watch_cases" on public.meetup_watch_cases;
create policy "admin only meetup_watch_cases" on public.meetup_watch_cases for all to authenticated using (private.is_admin()) with check (private.is_admin());
drop policy if exists "admin only meetup_watch_findings" on public.meetup_watch_findings;
create policy "admin only meetup_watch_findings" on public.meetup_watch_findings for all to authenticated using (private.is_admin()) with check (private.is_admin());
drop policy if exists "admin only watch_community_state" on public.watch_community_state;
create policy "admin only watch_community_state" on public.watch_community_state for all to authenticated using (private.is_admin()) with check (private.is_admin());
drop policy if exists "admin only meetup_watch_notifications" on public.meetup_watch_notifications;
create policy "admin only meetup_watch_notifications" on public.meetup_watch_notifications for all to authenticated using (private.is_admin()) with check (private.is_admin());

grant select,insert,update,delete on public.watch_settings to authenticated;
grant select,insert,update,delete on public.watch_terms to authenticated;
grant select,insert,update,delete on public.meetup_watch_cases to authenticated;
grant select,insert,update,delete on public.meetup_watch_findings to authenticated;
grant select,insert,update,delete on public.watch_community_state to authenticated;
grant select,insert,update,delete on public.meetup_watch_notifications to authenticated;

comment on table public.meetup_watch_cases is 'Meetup Watch review queue. A case is a request for human review, never an automatic misconduct determination.';
comment on column public.meetup_watch_cases.review_required is 'True when rules indicate human review is useful. It does not mean the Meetup is improper.';
comment on table public.watch_community_state is 'Temporary HOT monitoring state. HOT means higher-frequency monitoring only.';
