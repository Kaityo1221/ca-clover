-- CA Clover Phase D / restored-local-only integrity audit.
-- READ ONLY. Never run against production, staging, or other shared services.
-- Run with docker exec -i <RESTORE_DB_CONTAINER> psql -X -v ON_ERROR_STOP=1
-- from inside the restored Docker Postgres container using its Unix socket.
-- Prints aggregate counts and statuses only. Never exports account IDs or PII.
\set ON_ERROR_STOP on
\pset pager off
\echo 'CA CLOVER PHASE D | LOCAL RESTORE AUDIT | NO WRITES'
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY;

-- Fail closed unless this is a Unix-socket connection *inside* the local
-- restore database container. Production connections over TCP are refused.
SELECT 1 / CASE WHEN inet_server_addr() IS NULL THEN 1 ELSE 0 END
  AS local_unix_socket_required;

WITH checks AS (
  SELECT 'restore/auth_users'::text AS item,
    (SELECT count(*) FROM auth.users)::bigint AS observed,
    6::bigint AS expected,
    'snapshot'::text AS mode
  UNION ALL
  SELECT 'restore/google_identities',
    (SELECT count(*) FROM auth.identities WHERE provider='google'),6,'snapshot'
  UNION ALL
  SELECT 'restore/profiles',(SELECT count(*) FROM public.profiles),6,'snapshot'
  UNION ALL
  SELECT 'restore/ca_identities',(SELECT count(*) FROM public.user_ca_identities),6,'snapshot'
  UNION ALL
  SELECT 'restore/medals',(SELECT count(*) FROM public.stamp_collections),13,'snapshot'
  UNION ALL
  SELECT 'restore/medal_designs',(SELECT count(*) FROM public.stamp_collection_designs),13,'snapshot'
  UNION ALL
  SELECT 'restore/storage_metadata',(SELECT count(*) FROM storage.objects),418,'snapshot'
  UNION ALL
  SELECT 'integrity/orphan_ca_identities',(
    SELECT count(*) FROM public.user_ca_identities i
    LEFT JOIN public.community_ca_members l
      ON i.community_id=l.community_id AND i.ca_member_id=l.ca_member_id
    WHERE l.id IS NULL
  ),0,'zero'
  UNION ALL
  SELECT 'integrity/duplicate_primary_users',(
    SELECT count(*) FROM (
      SELECT user_id FROM public.user_ca_identities WHERE is_primary IS TRUE
      GROUP BY user_id HAVING count(*)>1
    ) duplicated
  ),0,'zero'
  UNION ALL
  SELECT 'integrity/verified_own_medal_missing',(
    SELECT count(*) FROM public.user_ca_identities i
      JOIN public.profiles p ON p.id=i.user_id
      JOIN public.ca_members m ON m.id=i.ca_member_id
    WHERE i.is_primary IS TRUE
      AND p.role IN ('ca','admin')
      AND m.status='active'
      AND m.ca_level IN ('1st','2nd')
      AND NOT EXISTS (
        SELECT 1 FROM public.stamp_collections s
        WHERE s.owner_user_id=i.user_id
          AND s.stamp_ca_member_id=i.ca_member_id
          AND s.community_id=i.community_id
      )
  ),0,'zero'
  UNION ALL
  SELECT 'integrity/unvalidated_foreign_keys',(
    SELECT count(*) FROM pg_catalog.pg_constraint
    WHERE contype='f'
      AND connamespace IN ('public'::regnamespace,'auth'::regnamespace,'storage'::regnamespace)
      AND convalidated IS NOT TRUE
  ),0,'zero'
  UNION ALL
  SELECT 'restore/foreign_keys',(
    SELECT count(*) FROM pg_catalog.pg_constraint
    WHERE contype='f'
      AND connamespace IN ('public'::regnamespace,'auth'::regnamespace,'storage'::regnamespace)
  ),98,'snapshot'
)
SELECT item,observed,expected,
  CASE WHEN observed=expected THEN 'PASS' ELSE 'REVIEW' END AS verdict
FROM checks ORDER BY item;

SELECT 'state/general_campfire_cron' AS item,
  CASE WHEN enabled IS TRUE THEN 'ENABLED' ELSE 'NOT_ENABLED' END AS observed,
  CASE WHEN enabled IS TRUE THEN 'PASS' ELSE 'REVIEW' END AS verdict
FROM public.sync_automation_state WHERE id=1;

SELECT 'state/2099_master_pause' AS item,
  CASE WHEN last_ca_master_at > now()+interval '365 days'
       THEN 'FUTURE_SENTINEL' ELSE 'NOT_CONFIRMED' END AS observed,
  CASE WHEN last_ca_master_at > now()+interval '365 days'
       THEN 'PASS' ELSE 'REVIEW' END AS verdict
FROM public.sync_automation_state WHERE id=1;

SELECT 'schema/identity_fk_delete_action' AS item,
  CASE c.confdeltype WHEN 'c' THEN 'CASCADE_OLD_BASELINE'
     WHEN 'r' THEN 'RESTRICT_PROTECTED' ELSE 'OTHER' END AS observed,
  CASE c.confdeltype WHEN 'r' THEN 'PROTECTION_READY'
    ELSE 'NOT_PROTECTED_DO_NOT_SYNC' END AS verdict
FROM pg_constraint c
WHERE c.conrelid='public.user_ca_identities'::regclass
  AND c.conname='user_ca_identities_community_id_ca_member_id_fkey';

SELECT 'schema/master_dedicated_gate' AS item,
  CASE WHEN exists(
     SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='sync_automation_state'
       AND column_name='ca_master_sync_enabled'
  ) THEN 'COLUMN_PRESENT' ELSE 'NOT_APPLIED' END AS observed,
  'INFORMATION_ONLY' AS verdict;

SELECT 'sync/verified_baseline_count' AS item,
  count(*) AS observed,
  'MUST_BE_EXPLICITLY_REVIEWED_BEFORE_SYNC' AS verdict
FROM public.sync_runs
WHERE source='ca-master-verified-baseline' AND status='success';

SELECT 'counts/ca_members' AS item,count(*) AS observed FROM public.ca_members
UNION ALL SELECT 'counts/communities',count(*) FROM public.communities
UNION ALL SELECT 'counts/ca_links',count(*) FROM public.community_ca_members
UNION ALL SELECT 'counts/primary_identities',count(*) FROM public.user_ca_identities WHERE is_primary IS TRUE
UNION ALL SELECT 'counts/memberships',count(*) FROM public.community_memberships
ORDER BY item;

COMMIT;
\echo 'END LOCAL RESTORE READ-ONLY AUDIT'
