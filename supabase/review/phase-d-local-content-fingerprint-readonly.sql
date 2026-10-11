-- Phase D: local restore only, read-only content fingerprint check.
-- Prints aggregated hashes and counts ONLY, no UUIDs, names or personal rows.
-- Re-run to compare same isolated database before/after a controlled test.
\set ON_ERROR_STOP on
\pset pager off
\echo 'PHASE D LOCAL CONTENT FINGERPRINT | NO WRITES'
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY;
SELECT 1/CASE WHEN inet_server_addr() IS NULL THEN 1 ELSE 0 END AS local_unix_socket_required;
SELECT 'public.user_ca_identities'::text AS table_name, count(*) AS row_count,
       md5(coalesce(string_agg(md5(to_jsonb(t)::text), ',' ORDER BY md5(to_jsonb(t)::text)),'')) AS content_digest
FROM public.user_ca_identities t
UNION ALL
SELECT 'public.community_ca_members'::text AS table_name, count(*) AS row_count,
       md5(coalesce(string_agg(md5(to_jsonb(t)::text), ',' ORDER BY md5(to_jsonb(t)::text)),'')) AS content_digest
FROM public.community_ca_members t
UNION ALL
SELECT 'public.stamp_collections'::text AS table_name, count(*) AS row_count,
       md5(coalesce(string_agg(md5(to_jsonb(t)::text), ',' ORDER BY md5(to_jsonb(t)::text)),'')) AS content_digest
FROM public.stamp_collections t
UNION ALL
SELECT 'public.stamp_collection_designs'::text AS table_name, count(*) AS row_count,
       md5(coalesce(string_agg(md5(to_jsonb(t)::text), ',' ORDER BY md5(to_jsonb(t)::text)),'')) AS content_digest
FROM public.stamp_collection_designs t
UNION ALL
SELECT 'public.community_memberships'::text AS table_name, count(*) AS row_count,
       md5(coalesce(string_agg(md5(to_jsonb(t)::text), ',' ORDER BY md5(to_jsonb(t)::text)),'')) AS content_digest
FROM public.community_memberships t
UNION ALL
SELECT 'public.profiles'::text AS table_name, count(*) AS row_count,
       md5(coalesce(string_agg(md5(to_jsonb(t)::text), ',' ORDER BY md5(to_jsonb(t)::text)),'')) AS content_digest
FROM public.profiles t
UNION ALL
SELECT 'public.ca_members'::text AS table_name, count(*) AS row_count,
       md5(coalesce(string_agg(md5(to_jsonb(t)::text), ',' ORDER BY md5(to_jsonb(t)::text)),'')) AS content_digest
FROM public.ca_members t
UNION ALL
SELECT 'public.communities'::text AS table_name, count(*) AS row_count,
       md5(coalesce(string_agg(md5(to_jsonb(t)::text), ',' ORDER BY md5(to_jsonb(t)::text)),'')) AS content_digest
FROM public.communities t
UNION ALL
SELECT 'public.stamp_exchange_sessions'::text AS table_name, count(*) AS row_count,
       md5(coalesce(string_agg(md5(to_jsonb(t)::text), ',' ORDER BY md5(to_jsonb(t)::text)),'')) AS content_digest
FROM public.stamp_exchange_sessions t
UNION ALL
SELECT 'public.stamp_exchange_transactions'::text AS table_name, count(*) AS row_count,
       md5(coalesce(string_agg(md5(to_jsonb(t)::text), ',' ORDER BY md5(to_jsonb(t)::text)),'')) AS content_digest
FROM public.stamp_exchange_transactions t
UNION ALL
SELECT 'public.stamp_reunions'::text AS table_name, count(*) AS row_count,
       md5(coalesce(string_agg(md5(to_jsonb(t)::text), ',' ORDER BY md5(to_jsonb(t)::text)),'')) AS content_digest
FROM public.stamp_reunions t
ORDER BY table_name;

-- Metadata discovery only: identify exchange/reunion tables for future audit.
SELECT table_name FROM information_schema.tables
WHERE table_schema='public' AND table_type='BASE TABLE'
  AND (table_name ILIKE '%exchange%' OR table_name ILIKE '%reunion%')
ORDER BY table_name;
COMMIT;
\echo 'END LOCAL CONTENT FINGERPRINT'
