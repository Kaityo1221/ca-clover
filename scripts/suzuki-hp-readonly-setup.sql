-- Review-only SQL. DO NOT run on production before explicit DB-change approval.
-- This provisions a narrowly scoped PostgreSQL login that can retrieve ONLY
-- the public prefecture aggregates. Password/login is enabled separately.
-- Run in a controlled, approved migration after reviewing existing privileges.
BEGIN;

CREATE ROLE suzuki_hp_reader NOLOGIN NOINHERIT
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;

-- This schema is not exposed through Supabase's REST Data API.
-- Expose no base-table SELECT privileges to the daily HP reader.
CREATE OR REPLACE FUNCTION private.suzuki_hp_snapshot()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
  WITH totals AS (
    SELECT c.prefecture,
           COUNT(*)::integer AS communities,
           SUM(c.member_count)::bigint AS hp
    FROM public.communities AS c
    WHERE c.prefecture IS NOT NULL
      AND c.member_count IS NOT NULL AND c.member_count > 0
    GROUP BY c.prefecture
  )
  SELECT jsonb_build_object(
    'version', 1,
    'source', 'CA Clover stored community member totals, prefecture aggregate',
    'snapshotReady', true,
    'generatedAt', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'prefectures', jsonb_object_agg(
      prefecture,jsonb_build_object('hp',hp,'communities',communities)
    )
  ) FROM totals;
$function$;

REVOKE ALL ON FUNCTION private.suzuki_hp_snapshot() FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO suzuki_hp_reader;
GRANT EXECUTE ON FUNCTION private.suzuki_hp_snapshot() TO suzuki_hp_reader;
-- The role must not get USAGE on other schemas or direct SELECT on public.communities.
COMMIT;

-- AFTER explicit GO only:
-- 1) Set a strong password and LOGIN for suzuki_hp_reader in an approved
--    secret-safe channel. Do not commit password or paste it in a PR/issue.
-- 2) Validate has_table_privilege('suzuki_hp_reader','public.communities','SELECT')=false.
-- 3) Validate only private.suzuki_hp_snapshot() can be called.
-- 4) Set SUZUKI_HP_READONLY_DATABASE_URL in GitHub Actions repository secrets.
-- 5) Test one manual dry-run with no Pages changes, then approve scheduling.
