-- REVIEW ONLY: isolated, synthetic PostgreSQL tests before release.
-- This is NOT a migration and must NOT be executed in production.
-- Prerequisite: ca_master_sync_enabled BOOLEAN NOT NULL DEFAULT FALSE.

alter table public.sync_automation_state
  add column if not exists ca_master_lease_owner uuid,
  add column if not exists ca_master_lease_expires_at timestamptz;

-- Ten minutes exceeds Supabase's documented paid worker wall-clock
-- maximum of 400 seconds. An expired lock is NOT automatically reclaimed:
-- a worker crash can leave partial metadata writes, requiring human review.
-- The lease is NOT a transaction across separate REST requests.
create or replace function public.internal_begin_ca_master_lease(p_owner uuid)
returns boolean
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  v_enabled boolean;
  v_owner uuid;
  v_expires timestamptz;
begin
  if p_owner is null then return false; end if;

  -- Serialize requests and flag changes in one DB transaction. A stale lease
  -- means the previous worker could have died after a partial REST write.
  select ca_master_sync_enabled,ca_master_lease_owner,ca_master_lease_expires_at
    into v_enabled,v_owner,v_expires
    from public.sync_automation_state where id=1 for update;
  if not found or v_enabled is distinct from true then return false; end if;

  -- Inconsistent lease state is also unsafe. Stop ONLY CA-master, never the
  -- independent 15-minute Campfire / icon sync.
  if (v_owner is not null and
     (v_expires is null or v_expires<=clock_timestamp()))
     or (v_owner is null and v_expires is not null) then
    update public.sync_automation_state
       set ca_master_sync_enabled=false
     where id=1;
    return false;
  end if;

  if v_owner is not null then return false; end if;

  update public.sync_automation_state
     set ca_master_lease_owner=p_owner,
         ca_master_lease_expires_at=clock_timestamp()+interval '10 minutes'
   where id=1;
  return true;
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
