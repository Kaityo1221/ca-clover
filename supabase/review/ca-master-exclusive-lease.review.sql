-- REVIEW ONLY: isolated, synthetic PostgreSQL tests before release.
-- This is NOT a migration and must NOT be executed in production.
-- Prerequisite: ca_master_sync_enabled BOOLEAN NOT NULL DEFAULT FALSE.

alter table public.sync_automation_state
  add column if not exists ca_master_lease_owner uuid,
  add column if not exists ca_master_lease_expires_at timestamptz;

-- Ten minutes exceeds Supabase's current maximum paid worker wall-clock
-- lifetime (400 seconds), but is a conservative recovery interval.
-- The lease is NOT a DB transaction across separate REST calls.
create or replace function public.internal_begin_ca_master_lease(p_owner uuid)
returns boolean
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare v_claimed boolean := false;
begin
  if p_owner is null then return false; end if;
  update public.sync_automation_state
     set ca_master_lease_owner=p_owner,
         ca_master_lease_expires_at=clock_timestamp()+interval '10 minutes'
   where id=1
     and ca_master_sync_enabled is true
     and (
       ca_master_lease_owner is null
       or ca_master_lease_expires_at <= clock_timestamp()
     )
  returning true into v_claimed;
  return coalesce(v_claimed,false);
end;
$fn$;

create or replace function public.internal_check_ca_master_lease(p_owner uuid)
returns boolean
language sql stable
security invoker
set search_path = public, pg_temp
as $fn$
  select coalesce(
    (select ca_master_sync_enabled is true
       and ca_master_lease_owner=p_owner
       and ca_master_lease_expires_at>now()
      from public.sync_automation_state where id=1),false
  );
$fn$;

create or replace function public.internal_finish_ca_master_lease(p_owner uuid)
returns boolean
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare v_released boolean := false;
begin
  if p_owner is null then return false; end if;
  update public.sync_automation_state
     set ca_master_lease_owner=null,ca_master_lease_expires_at=null
   where id=1 and ca_master_lease_owner=p_owner
  returning true into v_released;
  return coalesce(v_released,false);
end;
$fn$;

-- Exposed public RPCs remain exclusively callable with service-role creds.
revoke all on function public.internal_begin_ca_master_lease(uuid) from public,anon,authenticated;
revoke all on function public.internal_check_ca_master_lease(uuid) from public,anon,authenticated;
revoke all on function public.internal_finish_ca_master_lease(uuid) from public,anon,authenticated;
grant execute on function public.internal_begin_ca_master_lease(uuid) to service_role;
grant execute on function public.internal_check_ca_master_lease(uuid) to service_role;
grant execute on function public.internal_finish_ca_master_lease(uuid) to service_role;
