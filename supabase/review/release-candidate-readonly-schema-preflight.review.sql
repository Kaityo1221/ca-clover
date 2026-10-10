-- CA Clover / production readiness observation only.
-- SELECT statements exclusively. Safe to run while CA-master sync is paused.
-- No personal identifiers, CSV contents, access tokens or PII are returned.
-- Apply ZERO DDL/DML from this document.

with fk as (
  select c.confdeltype
  from pg_constraint c
  where c.conrelid='public.user_ca_identities'::regclass
    and c.conname='user_ca_identities_community_id_ca_member_id_fkey'
),
catalog as (
  select
    exists(select 1 from information_schema.columns
      where table_schema='public' and table_name='sync_automation_state'
        and column_name='ca_master_sync_enabled') as has_master_gate,
    exists(select 1 from information_schema.columns
      where table_schema='public' and table_name='sync_automation_state'
        and column_name='ca_master_lease_owner') as has_lease_owner,
    exists(select 1 from information_schema.columns
      where table_schema='public' and table_name='sync_automation_state'
        and column_name='ca_master_lease_expires_at') as has_lease_expiry,
    (select confdeltype from fk limit 1) as identity_fk_action,
    exists(select 1 from pg_constraint
      where conrelid='public.community_ca_members'::regclass
        and contype='u'
        and pg_get_constraintdef(oid) like '%(community_id, ca_member_id)%')
        as has_unique_ca_link,
    exists(select 1 from pg_constraint
      where conrelid='public.stamp_collections'::regclass
        and contype='u'
        and pg_get_constraintdef(oid) like '%(owner_user_id, stamp_ca_member_id, community_id)%')
        as has_unique_medal,
    to_regprocedure('public.internal_begin_ca_master_lease(uuid)') is not null
        as has_begin_lease_rpc,
    to_regprocedure('public.internal_reconcile_ca_master_links(jsonb,uuid[],uuid)') is not null
        as has_atomic_link_rpc,
    to_regprocedure('public.internal_approve_unlisted_ca_claim(uuid,uuid,text)') is not null
        as has_unlisted_medal_rpc,
    to_regprocedure('private.stamp_ensure_own_medal(uuid)') is not null
        as has_real_self_medal_function,
    exists(
      select 1 from pg_trigger tg join pg_proc p on p.oid=tg.tgfoid
      where tg.tgrelid='public.user_ca_identities'::regclass
        and p.proname='stamp_auto_own_medal_after_identity'
        and tg.tgenabled in ('O','A')
    ) as has_active_self_medal_trigger,
    (select bool_and(c.relrowsecurity)
      from pg_class c
      where c.oid in (
        'public.ca_members'::regclass,
        'public.community_ca_members'::regclass,
        'public.user_ca_identities'::regclass,
        'public.stamp_collections'::regclass,
        'public.community_access_requests'::regclass
      )) as protected_tables_have_rls
)
select
  now() as observed_at,
  case when (select last_ca_master_at from public.sync_automation_state where id=1)
      > now()+interval '365 days'
    then 'auto_paused_by_future_sentinel' else 'sentinel_not_confirmed' end
    as temporary_master_pause,
  (select enabled from public.sync_automation_state where id=1)
    as general_cron_enabled,
  (select count(*) from public.user_ca_identities) as identities,
  (select count(*) from public.stamp_collections) as medals,
  (select count(*) from public.community_memberships) as memberships,
  (select count(*) from public.user_ca_identities i
    left join public.community_ca_members m
      on i.community_id=m.community_id and i.ca_member_id=m.ca_member_id
    where m.id is null) as orphan_identities,
  case identity_fk_action
    when 'r' then 'RESTRICT_READY'
    when 'c' then 'CASCADE_UNSAFE_NOT_READY'
    else 'UNKNOWN_STOP'
  end as identity_fk_state,
  (has_master_gate and has_lease_owner and has_lease_expiry
    and has_begin_lease_rpc and has_atomic_link_rpc
    and identity_fk_action='r') as database_master_protection_installed,
  has_master_gate,has_lease_owner,has_lease_expiry,
  has_begin_lease_rpc,has_atomic_link_rpc,has_unlisted_medal_rpc,
  has_unique_ca_link,has_unique_medal,
  has_real_self_medal_function,has_active_self_medal_trigger,
  protected_tables_have_rls
from catalog;
