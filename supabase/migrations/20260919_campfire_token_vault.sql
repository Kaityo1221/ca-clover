create table if not exists public.campfire_connection_state(
  id smallint primary key default 1 check (id = 1),
  status text not null default 'missing' check (status in ('missing','ready','expiring','expired','error')),
  token_email text,
  expires_at timestamptz,
  last_validated_at timestamptz,
  last_sync_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now()
);

insert into public.campfire_connection_state(id,status)
values(1,'missing')
on conflict (id) do nothing;

alter table public.campfire_connection_state enable row level security;

drop policy if exists "admin reads campfire connection state" on public.campfire_connection_state;
create policy "admin reads campfire connection state"
on public.campfire_connection_state
for select
to authenticated
using(private.is_admin());

revoke all on public.campfire_connection_state from anon, authenticated;
grant select on public.campfire_connection_state to authenticated;

create or replace function public.internal_set_campfire_token(
  p_token text,
  p_email text,
  p_expires_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, vault
as $$
declare
  v_id uuid;
begin
  select id into v_id
  from vault.decrypted_secrets
  where name = 'ca_clover_campfire_token'
  limit 1;

  if v_id is null then
    perform vault.create_secret(
      p_token,
      'ca_clover_campfire_token',
      'CA Clover Campfire bearer token',
      null
    );
  else
    perform vault.update_secret(
      v_id,
      p_token,
      'ca_clover_campfire_token',
      'CA Clover Campfire bearer token',
      null
    );
  end if;

  insert into public.campfire_connection_state(
    id,status,token_email,expires_at,last_validated_at,last_error,updated_at
  )
  values(
    1,'ready',p_email,p_expires_at,now(),null,now()
  )
  on conflict(id) do update
    set status='ready',
        token_email=excluded.token_email,
        expires_at=excluded.expires_at,
        last_validated_at=excluded.last_validated_at,
        last_error=null,
        updated_at=now();
end;
$$;

create or replace function public.internal_get_campfire_token()
returns text
language sql
security definer
set search_path = pg_catalog, vault
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name='ca_clover_campfire_token'
  limit 1;
$$;

create or replace function public.internal_clear_campfire_token()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, vault
as $$
begin
  delete from vault.secrets
  where name='ca_clover_campfire_token';

  update public.campfire_connection_state
  set status='missing',
      token_email=null,
      expires_at=null,
      last_validated_at=null,
      last_sync_at=null,
      last_error=null,
      updated_at=now()
  where id=1;
end;
$$;

revoke all on function public.internal_set_campfire_token(text,text,timestamptz) from public, anon, authenticated;
revoke all on function public.internal_get_campfire_token() from public, anon, authenticated;
revoke all on function public.internal_clear_campfire_token() from public, anon, authenticated;

grant execute on function public.internal_set_campfire_token(text,text,timestamptz) to service_role;
grant execute on function public.internal_get_campfire_token() to service_role;
grant execute on function public.internal_clear_campfire_token() to service_role;

create or replace function public.activity_summary(
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
    count(*) filter (where coalesce(m.is_ca_meetup,false))::bigint,
    coalesce(sum(m.rsvp_count),0)::bigint,
    coalesce(sum(m.checkin_count),0)::bigint,
    max(m.starts_at)
  from public.meetups m
  where m.starts_at >= now() - make_interval(days => greatest(1,least(coalesce(p_days,30),3650)));
$$;

grant execute on function public.activity_summary(integer) to authenticated;

create or replace function public.activity_monthly(
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
    date_trunc('month',m.starts_at)::date,
    count(*)::bigint,
    coalesce(sum(m.rsvp_count),0)::bigint,
    coalesce(sum(m.checkin_count),0)::bigint
  from public.meetups m
  where m.starts_at >= date_trunc('month',now())
    - make_interval(months => greatest(0,least(coalesce(p_months,12),120)-1))
  group by date_trunc('month',m.starts_at)
  order by 1;
$$;

grant execute on function public.activity_monthly(integer) to authenticated;