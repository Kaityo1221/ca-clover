create table public.stamp_events(
  id uuid primary key default gen_random_uuid(),
  name text not null check(length(trim(name)) between 1 and 120),
  location text,
  timezone text not null default 'Asia/Tokyo',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'scheduled'
    check(status in ('scheduled','cancelled')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(ends_at>starts_at)
);

create index stamp_events_window_idx on public.stamp_events(starts_at,ends_at);
create index stamp_events_status_idx on public.stamp_events(status,starts_at);

alter table public.stamp_events enable row level security;
revoke all on public.stamp_events from anon,authenticated;

create table public.stamp_event_participants(
  event_id uuid not null references public.stamp_events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key(event_id,user_id)
);

create index stamp_event_participants_user_idx on public.stamp_event_participants(user_id,joined_at desc);

alter table public.stamp_event_participants enable row level security;
revoke all on public.stamp_event_participants from anon,authenticated;

create table public.stamp_mission_templates(
  id uuid primary key default gen_random_uuid(),
  title text not null check(length(trim(title)) between 1 and 80),
  instruction text not null check(length(trim(instruction)) between 1 and 300),
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.stamp_mission_templates enable row level security;
revoke all on public.stamp_mission_templates from anon,authenticated;

create table public.stamp_event_daily_missions(
  event_id uuid not null references public.stamp_events(id) on delete cascade,
  local_date date not null,
  mission_template_id uuid not null references public.stamp_mission_templates(id) on delete restrict,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  primary key(event_id,local_date)
);

alter table public.stamp_event_daily_missions enable row level security;
revoke all on public.stamp_event_daily_missions from anon,authenticated;

alter table public.stamp_exchange_sessions
  add column if not exists event_id uuid references public.stamp_events(id) on delete set null,
  add column if not exists event_name text,
  add column if not exists event_location text,
  add column if not exists event_timezone text;

create index stamp_exchange_sessions_event_idx
  on public.stamp_exchange_sessions(event_id,created_at desc);

create or replace function public.stamp_event_create_internal(
  p_name text,p_location text,p_timezone text,p_starts_local text,p_ends_local text,p_created_by uuid
)
returns uuid
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare
  v_id uuid;
  v_start timestamp;
  v_end timestamp;
begin
  if not exists(select 1 from pg_timezone_names where name=p_timezone) then
    raise exception 'invalid timezone' using errcode='22023';
  end if;

  begin
    v_start:=p_starts_local::timestamp;
    v_end:=p_ends_local::timestamp;
  exception when others then
    raise exception 'invalid local datetime' using errcode='22007';
  end;

  if v_end<=v_start then
    raise exception 'end must be after start' using errcode='22023';
  end if;

  insert into public.stamp_events(name,location,timezone,starts_at,ends_at,created_by)
  values(
    trim(p_name),nullif(trim(p_location),''),p_timezone,
    v_start at time zone p_timezone,
    v_end at time zone p_timezone,
    p_created_by
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.stamp_event_create_internal(text,text,text,text,text,uuid)
  from public,anon,authenticated;
grant execute on function public.stamp_event_create_internal(text,text,text,text,text,uuid)
  to service_role;

create or replace function public.stamp_event_update_internal(
  p_event_id uuid,p_name text,p_location text,p_timezone text,p_starts_local text,p_ends_local text,p_status text
)
returns boolean
language plpgsql
security definer
set search_path=public,private,pg_temp
as $$
declare
  v_start timestamp;
  v_end timestamp;
begin
  if p_status not in ('scheduled','cancelled') then
    raise exception 'invalid event status' using errcode='22023';
  end if;
  if not exists(select 1 from pg_timezone_names where name=p_timezone) then
    raise exception 'invalid timezone' using errcode='22023';
  end if;

  begin
    v_start:=p_starts_local::timestamp;
    v_end:=p_ends_local::timestamp;
  exception when others then
    raise exception 'invalid local datetime' using errcode='22007';
  end;

  if v_end<=v_start then
    raise exception 'end must be after start' using errcode='22023';
  end if;

  update public.stamp_events
  set name=trim(p_name),
      location=nullif(trim(p_location),''),
      timezone=p_timezone,
      starts_at=v_start at time zone p_timezone,
      ends_at=v_end at time zone p_timezone,
      status=p_status,
      updated_at=now()
  where id=p_event_id;

  return found;
end;
$$;

revoke all on function public.stamp_event_update_internal(uuid,text,text,text,text,text,text)
  from public,anon,authenticated;
grant execute on function public.stamp_event_update_internal(uuid,text,text,text,text,text,text)
  to service_role;

comment on table public.stamp_events is
  'CA Stamp Rally events. Event mode is active only for opted-in participants while server time is inside the event window.';
comment on table public.stamp_event_participants is
  'Explicit per-user event opt-in. No user is auto-enrolled.';
comment on table public.stamp_mission_templates is
  'Reusable stock of playful daily event missions.';
comment on table public.stamp_event_daily_missions is
  'One predefined mission per event-local calendar day.';
