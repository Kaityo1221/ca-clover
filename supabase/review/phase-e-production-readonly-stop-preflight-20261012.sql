-- CA Clover 2026-10-12: SAFE PRODUCTION READ-ONLY preflight.
-- This file does not update, reset, deploy or restart anything.
-- Never interpret this report as authorization to resume CA master sync.
-- Run only by an authorized operator; return counts/states, not personal IDs.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY;

WITH checks AS (
 SELECT 'state/master_emergency_pause'::text AS check_name,
        CASE WHEN last_ca_master_at > now() + interval '365 days' THEN 'PASS:PAUSED' ELSE 'STOP:NOT_PAUSED' END AS result,
        null::bigint AS observed_count
 FROM public.sync_automation_state WHERE id=1
 UNION ALL
 SELECT 'state/general_campfire_enabled',
        CASE WHEN enabled IS TRUE THEN 'PASS:GENERAL_ENABLED' ELSE 'REVIEW:GENERAL_DISABLED' END,
        null::bigint FROM public.sync_automation_state WHERE id=1
 UNION ALL
 SELECT 'state/dedicated_ca_master_gate',
        CASE WHEN EXISTS(
          SELECT 1 FROM information_schema.columns
          WHERE table_schema='public' AND table_name='sync_automation_state'
          AND column_name='ca_master_sync_enabled'
        ) THEN 'REVIEW:COLUMN_EXISTS_CHECK_OFF' ELSE 'STOP:NOT_INSTALLED' END,
        null::bigint
 UNION ALL
 SELECT 'schema/identity_link_fk',
        CASE c.confdeltype WHEN 'r' THEN 'PASS:RESTRICT' WHEN 'c' THEN 'STOP:CASCADE' ELSE 'STOP:UNKNOWN' END,
        null::bigint
 FROM pg_catalog.pg_constraint c
 WHERE c.conrelid='public.user_ca_identities'::regclass
   AND c.conname='user_ca_identities_community_id_ca_member_id_fkey'
 UNION ALL
 SELECT 'data/verified_baseline',
        CASE WHEN count(*)>0 THEN 'REVIEW:VALIDATE_EACH_BASELINE' ELSE 'STOP:NO_VERIFIED_BASELINE' END,
        count(*) FROM public.sync_runs
 WHERE source='ca-master-verified-baseline' AND status='success'
 UNION ALL
 SELECT 'data/orphan_identity_links',
        CASE WHEN count(*)=0 THEN 'PASS:ZERO' ELSE 'STOP:ORPHAN_IDENTITIES' END,
        count(*)
 FROM public.user_ca_identities i
 LEFT JOIN public.community_ca_members l
   ON l.ca_member_id=i.ca_member_id AND l.community_id=i.community_id
 WHERE l.id IS NULL
 UNION ALL
 SELECT 'data/ca_members','SNAPSHOT', count(*) FROM public.ca_members
 UNION ALL
 SELECT 'data/communities','SNAPSHOT', count(*) FROM public.communities
 UNION ALL
 SELECT 'data/ca_community_links','SNAPSHOT', count(*) FROM public.community_ca_members
 UNION ALL
 SELECT 'data/ca_identities','SNAPSHOT', count(*) FROM public.user_ca_identities
 UNION ALL
 SELECT 'data/medals','SNAPSHOT', count(*) FROM public.stamp_collections
 UNION ALL
 SELECT 'data/medal_designs','SNAPSHOT', count(*) FROM public.stamp_collection_designs
 UNION ALL
 SELECT 'data/exchange_sessions','SNAPSHOT', count(*) FROM public.stamp_exchange_sessions
 UNION ALL
 SELECT 'data/reunions','SNAPSHOT', count(*) FROM public.stamp_reunions
)
SELECT check_name, result, observed_count FROM checks ORDER BY check_name;

COMMIT;
