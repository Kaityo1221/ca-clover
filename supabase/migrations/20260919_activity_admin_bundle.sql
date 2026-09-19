alter table public.profiles
  add column if not exists email text;

update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id
  and p.email is distinct from u.email;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles(id, email, role)
  values(new.id, new.email, 'pending')
  on conflict (id) do update
    set email = excluded.email;
  return new;
end;
$$;

alter table public.meetups
  add column if not exists event_url text,
  add column if not exists details text,
  add column if not exists accepted_count integer,
  add column if not exists declined_count integer,
  add column if not exists campfire_live_event_name text;

create index if not exists meetups_starts_at_idx
  on public.meetups(starts_at desc);

create index if not exists meetups_community_starts_at_idx
  on public.meetups(community_id, starts_at desc);

create or replace function public.community_activity_summary(
  p_community_id uuid,
  p_days integer default 30
)
returns table(
  meetup_count bigint,
  ca_meetup_count bigint,
  rsvp_count bigint,
  checkin_count bigint,
  last_event_at timestamptz
)
language sql
stable
set search_path = public, pg_temp
as $$
  select
    count(*)::bigint,
    count(*) filter (where coalesce(m.is_ca_meetup, false))::bigint,
    coalesce(sum(m.rsvp_count), 0)::bigint,
    coalesce(sum(m.checkin_count), 0)::bigint,
    max(m.starts_at)
  from public.meetups m
  where m.community_id = p_community_id
    and m.starts_at >= now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 3650)));
$$;

grant execute on function public.community_activity_summary(uuid, integer) to authenticated;

create or replace function public.community_monthly_activity(
  p_community_id uuid,
  p_months integer default 12
)
returns table(
  month date,
  meetup_count bigint,
  rsvp_count bigint,
  checkin_count bigint
)
language sql
stable
set search_path = public, pg_temp
as $$
  select
    date_trunc('month', m.starts_at)::date as month,
    count(*)::bigint as meetup_count,
    coalesce(sum(m.rsvp_count), 0)::bigint as rsvp_count,
    coalesce(sum(m.checkin_count), 0)::bigint as checkin_count
  from public.meetups m
  where m.community_id = p_community_id
    and m.starts_at >= date_trunc('month', now())
      - make_interval(months => greatest(0, least(coalesce(p_months, 12), 120) - 1))
  group by date_trunc('month', m.starts_at)
  order by month asc;
$$;

grant execute on function public.community_monthly_activity(uuid, integer) to authenticated;

create or replace function public.admin_set_user_role(
  p_user_id uuid,
  p_role public.app_role
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if not private.is_admin() then
    raise exception 'admin required' using errcode = '42501';
  end if;

  update public.profiles
  set role = p_role
  where id = p_user_id;

  if not found then
    raise exception 'profile not found';
  end if;
end;
$$;

revoke all on function public.admin_set_user_role(uuid, public.app_role) from public;
grant execute on function public.admin_set_user_role(uuid, public.app_role) to authenticated;

create or replace function public.admin_set_membership(
  p_user_id uuid,
  p_community_id uuid,
  p_assigned boolean
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if not private.is_admin() then
    raise exception 'admin required' using errcode = '42501';
  end if;

  if p_assigned then
    insert into public.community_memberships(user_id, community_id)
    values(p_user_id, p_community_id)
    on conflict (user_id, community_id) do nothing;
  else
    delete from public.community_memberships
    where user_id = p_user_id
      and community_id = p_community_id;
  end if;
end;
$$;

revoke all on function public.admin_set_membership(uuid, uuid, boolean) from public;
grant execute on function public.admin_set_membership(uuid, uuid, boolean) to authenticated;
