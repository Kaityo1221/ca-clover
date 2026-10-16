-- CA Clover 2026-10-13: SAFE PRODUCTION READ-ONLY protection preflight, refreshed against current gate and FK.
-- This file does not update, reset, deploy or restart anything.
-- Never interpret this report as authorization to resume CA master sync.
-- Run only by an authorized operator; return counts/states, not personal IDs.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY;

WITH checks AS (
 SELECT 'state/master_emergency_pause'::text AS check_name,
        CASE WHEN last_ca_master_at::date = date '2099-01-01' AND last_ca_master_at > now() + interval '365 days' THEN 'PASS:PAUSED_2099' ELSE 'STOP:SENTINEL_MISMATCH' END AS result,
        null::bigint AS observed_count
 FROM public.sync_automation_state WHERE id=1
 UNION ALL
 SELECT 'state/general_campfire_enabled',
        CASE WHEN enabled IS TRUE THEN 'PASS:GENERAL_ENABLED' ELSE 'REVIEW:GENERAL_DISABLED' END,
        null::bigint FROM public.sync_automation_state WHERE id=1
 UNION ALL
 SELECT 'state/dedicated_ca_master_gate',
        CASE WHEN ca_master_sync_enabled IS FALSE THEN 'PASS:MASTER_OFF' ELSE 'STOP:MASTER_ENABLED' END,
        null::bigint FROM public.sync_automation_state WHERE id=1
 UNION ALL
 SELECT 'schema/identity_link_fk',
        CASE WHEN c.confdeltype='r' AND c.convalidated IS TRUE AND c.condeferrable IS FALSE THEN 'PASS:RESTRICT_VALIDATED_NONDEFERRABLE' ELSE 'STOP:FK_NOT_STRICT_RESTRICT' END,
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
 UNION ALL
 SELECT 'data/storage_metadata_objects','SNAPSHOT', count(*) FROM storage.objects
 UNION ALL
 SELECT 'data/auth_users','SNAPSHOT', count(*) FROM auth.users
 UNION ALL
 SELECT 'integrity/orphan_ca_links',
        CASE WHEN count(*)=0 THEN 'PASS:ZERO' ELSE 'STOP:ORPHAN_CA_LINKS' END,
        count(*)
 FROM public.community_ca_members l
 LEFT JOIN public.ca_members m ON m.id=l.ca_member_id
 LEFT JOIN public.communities c ON c.id=l.community_id
 WHERE m.id IS NULL OR c.id IS NULL
 UNION ALL
 SELECT 'integrity/orphan_medal_owners_or_groups',
        CASE WHEN count(*)=0 THEN 'PASS:ZERO' ELSE 'STOP:ORPHAN_MEDAL_REFERENCES' END,
        count(*)
 FROM public.stamp_collections s
 LEFT JOIN auth.users u ON u.id=s.owner_user_id
 LEFT JOIN public.ca_members m ON m.id=s.stamp_ca_member_id
 LEFT JOIN public.communities c ON c.id=s.community_id
 WHERE u.id IS NULL OR m.id IS NULL OR c.id IS NULL
 UNION ALL
 SELECT 'integrity/orphan_medal_designs',
        CASE WHEN count(*)=0 THEN 'PASS:ZERO' ELSE 'STOP:ORPHAN_DESIGN' END,
        count(*)
 FROM public.stamp_collection_designs d
 LEFT JOIN public.stamp_collections s ON s.id=d.collection_id
 WHERE s.id IS NULL
 UNION ALL
 SELECT 'integrity/duplicate_primary_ca_identity',
        CASE WHEN count(*)=0 THEN 'PASS:ZERO' ELSE 'STOP:DUPLICATE_PRIMARY_IDENTITY' END,
        count(*)
 FROM (
  SELECT user_id FROM public.user_ca_identities
  WHERE is_primary IS TRUE
  GROUP BY user_id HAVING count(*)>1
 ) duplicates
 UNION ALL
 SELECT 'integrity/unvalidated_public_auth_storage_fk',
        CASE WHEN count(*)=0 THEN 'PASS:ZERO' ELSE 'REVIEW:UNVALIDATED_FK' END,
        count(*)
 FROM pg_catalog.pg_constraint
 WHERE contype='f'
   AND connamespace IN ('public'::regnamespace,'auth'::regnamespace,'storage'::regnamespace)
   AND convalidated IS NOT TRUE
)
SELECT check_name, result, observed_count FROM checks ORDER BY check_name;

COMMIT;
