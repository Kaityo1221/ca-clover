-- REVIEW ONLY. DO NOT EXECUTE IN PRODUCTION.
-- Designed to be applied only after:
--   1) sync_automation_state.ca_master_sync_enabled BOOLEAN DEFAULT FALSE exists
--   2) user_ca_identities->community_ca_members composite FK is ON DELETE RESTRICT
--   3) production deployment explicitly approved.
-- 1 RPC call = 1 database transaction for link insert/delete/reconcile.
-- Other CA-master metadata writes made before this RPC are NOT part of this transaction.

create or replace function public.internal_reconcile_ca_master_links(
  p_desired_links jsonb,
  p_managed_ca_ids uuid[],
  p_owner uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
declare
  v_enabled boolean;
  v_safe_fk boolean;
  v_protected jsonb := '[]'::jsonb;
  v_deleted integer := 0;
  v_expected_count integer := 0;
begin
  if p_desired_links is null or jsonb_typeof(p_desired_links) <> 'array'
     or p_managed_ca_ids is null or array_position(p_managed_ca_ids, null) is not null then
    raise exception 'CA_MASTER_INVALID_LINK_PLAN' using errcode = '22023';
  end if;

  -- Serialize link reconciliations with each other. Locking the flag row also
  -- serializes a concurrent flag update with this *link reconciliation*.
  -- This does not serialize earlier HTTP operations from the Edge Function.
  select ca_master_sync_enabled into v_enabled
    from public.sync_automation_state
    where id=1 for update;
  if v_enabled is distinct from true
     or p_owner is null
     or not exists (
       select 1 from public.sync_automation_state
       where id=1 and ca_master_lease_owner=p_owner
         and ca_master_lease_expires_at>clock_timestamp()
     ) then
    raise exception 'CA_MASTER_PAUSED_OR_LEASE_LOST' using errcode='55000';
  end if;

  -- Guard against deploying this function before the cascade FK is made safe.
  select exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid='public.user_ca_identities'::regclass
      and confrelid='public.community_ca_members'::regclass
      and conname='user_ca_identities_community_id_ca_member_id_fkey'
      and contype='f' and confdeltype='r'
  ) into v_safe_fk;
  if not v_safe_fk then
    raise exception 'CA_MASTER_UNSAFE_FK' using errcode='55000';
  end if;

  -- Reject missing/foreign identities in expected records instead of silently
  -- pruning the source and deleting links for affected CA members.
  if exists (
    select 1 from jsonb_to_recordset(p_desired_links)
      as d(community_id uuid,ca_member_id uuid)
    where d.community_id is null or d.ca_member_id is null
      or not (d.ca_member_id = any(p_managed_ca_ids))
  ) then
    raise exception 'CA_MASTER_INVALID_DESIRED_LINK' using errcode='22023';
  end if;

  select count(*) into v_expected_count from (
    select distinct d.community_id,d.ca_member_id
      from jsonb_to_recordset(p_desired_links)
      as d(community_id uuid,ca_member_id uuid)
  ) distinct_links;

  -- Every managed CA needs at least one desired link. Failing closed here
  -- protects against partially resolved Community IDs or malformed master data.
  if exists (
    select 1 from unnest(p_managed_ca_ids) m(ca_member_id)
    where not exists (
      select 1 from jsonb_to_recordset(p_desired_links)
        as d(community_id uuid,ca_member_id uuid)
      where d.ca_member_id=m.ca_member_id
    )
  ) then
    raise exception 'CA_MASTER_INCOMPLETE_LINK_PLAN' using errcode='22023';
  end if;

  -- Add desired links before pruning, preserving existing link IDs.
  insert into public.community_ca_members(community_id,ca_member_id)
  select distinct d.community_id,d.ca_member_id
    from jsonb_to_recordset(p_desired_links)
      as d(community_id uuid,ca_member_id uuid)
  on conflict (community_id,ca_member_id) do nothing;

  -- A verified old assignment is retained and reported for admin review.
  select coalesce(jsonb_agg(jsonb_build_object(
       'community_id', l.community_id,
       'ca_member_id', l.ca_member_id
     )), '[]'::jsonb) into v_protected
    from public.community_ca_members l
   where l.ca_member_id=any(p_managed_ca_ids)
     and not exists (
       select 1 from jsonb_to_recordset(p_desired_links)
         as d(community_id uuid,ca_member_id uuid)
        where d.community_id=l.community_id and d.ca_member_id=l.ca_member_id
     )
     and exists (
       select 1 from public.user_ca_identities i
       where i.community_id=l.community_id and i.ca_member_id=l.ca_member_id
     );

  -- If an Identity appears concurrently, ON DELETE RESTRICT raises 23503
  -- and Postgres rolls back *all* changes made by this RPC.
  delete from public.community_ca_members l
   where l.ca_member_id=any(p_managed_ca_ids)
     and not exists (
       select 1 from jsonb_to_recordset(p_desired_links)
         as d(community_id uuid,ca_member_id uuid)
        where d.community_id=l.community_id and d.ca_member_id=l.ca_member_id
     )
     and not exists (
       select 1 from public.user_ca_identities i
        where i.community_id=l.community_id and i.ca_member_id=l.ca_member_id
     );
  get diagnostics v_deleted = row_count;

  return jsonb_build_object(
    'desired_links', v_expected_count,
    'protected_stale_identity_links', v_protected,
    'removed_stale_links', v_deleted
  );
end;
$fn$;

-- public schema is API-exposed: the function is strictly service-role-only.
revoke all on function public.internal_reconcile_ca_master_links(jsonb, uuid[], uuid) from public;
revoke all on function public.internal_reconcile_ca_master_links(jsonb, uuid[], uuid) from anon;
revoke all on function public.internal_reconcile_ca_master_links(jsonb, uuid[], uuid) from authenticated;
grant execute on function public.internal_reconcile_ca_master_links(jsonb, uuid[], uuid) to service_role;
