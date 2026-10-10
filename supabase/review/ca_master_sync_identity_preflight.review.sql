-- CA Clover pre/post CA-master sync integrity checks (READ-ONLY).
-- This is a verification script, NOT a DB migration.
-- Run before and after deploying/testing the updated Edge Function.
-- Never run the legacy master sync as a verification test on production.

-- 1. Approved CA identity count and original medal count.
select
 (select count(*) from public.profiles) as profiles,
 (select count(*) from public.community_memberships) as memberships,
 (select count(*) from public.user_ca_identities) as identities,
 (select count(*) from public.user_ca_identities where is_primary) as primary_identities,
 (select count(*) from public.stamp_collections) as owned_medals;

-- 2. Integrity: must return 0 rows.
select i.user_id, i.ca_member_id, i.community_id
from public.user_ca_identities i
left join public.community_ca_members link
  on link.ca_member_id=i.ca_member_id
 and link.community_id=i.community_id
where link.id is null;

-- 3. Auto-owned self medals for verified primaries.
select
  count(*) as primaries,
  count(*) filter (
    where exists (
      select 1 from public.stamp_collections sc
      where sc.owner_user_id=i.user_id
        and sc.stamp_ca_member_id=i.ca_member_id
        and sc.community_id=i.community_id
    )
  ) as primaries_with_own_medal
from public.user_ca_identities i
where i.is_primary=true;

-- 4. Latest CA master sync; check whether it reports partial conflicts.
select status,finished_at,
  details->>'source_rows' as source_rows,
  details->>'links' as desired_links,
  details->>'protected_stale_identity_links' as protected_links
from public.sync_runs where source='ca_members_map'
order by finished_at desc limit 3;

-- 5. Next automatic refresh is 24h after last_ca_master_at, on the
-- first active ca-clover-auto-sync-15m run following this threshold.
select last_ca_master_at,
       last_ca_master_at + interval '24 hours' as earliest_next_ca_master_sync
from public.sync_automation_state where id=1;
