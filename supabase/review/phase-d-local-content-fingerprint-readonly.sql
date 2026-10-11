-- Phase D / privacy-preserving content fingerprints.
-- READ ONLY, LOCAL RESTORE ONLY. NO IDs, names, row content or hash salts printed.
-- Do not execute against production or shared staging.
\set ON_ERROR_STOP on
\pset pager off
\echo 'PHASE D | LOCAL CONTENT FINGERPRINTS | NO WRITES'
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY;
SELECT 1/CASE WHEN inet_server_addr() IS NULL THEN 1 ELSE 0 END AS local_unix_socket_required;

-- Count + order-independent SHA-256 of the canonical row-level MD5 values.
-- This supports before/after comparisons on the SAME isolated DB.
-- It does not independently attest that data is correct or immutable.
CREATE TEMP TABLE phase_d_fingerprints(table_name text, row_count bigint, digest text) ON COMMIT DROP;
DO $audit$
DECLARE item text; cnt bigint; fp text;
BEGIN
  FOREACH item IN ARRAY ARRAY[
    'public.user_ca_identities',
    'public.community_ca_members',
    'public.stamp_collections',
    'public.stamp_collection_designs',
    'public.community_memberships',
    'public.profiles',
    'public.ca_members',
    'public.communities'
  ] LOOP
    EXECUTE format(
      'SELECT count(*), md5(coalesce(string_agg(rowhash, '','' ORDER BY rowhash), '''')) FROM (SELECT md5(to_jsonb(t)::text) AS rowhash FROM %s t) x',
      item
    ) INTO cnt, fp;
    INSERT INTO phase_d_fingerprints VALUES (item,cnt,fp);
  END LOOP;
END $audit$;
SELECT table_name,row_count,digest FROM phase_d_fingerprints ORDER BY table_name;

-- Discover exchange/reunion tables by catalog metadata only. The operator must
-- review exact names before expanding fingerprint coverage.
SELECT table_name
FROM information_schema.tables
WHERE table_schema='public'
  AND table_type='BASE TABLE'
  AND (table_name ILIKE '%exchange%' OR table_name ILIKE '%reunion%')
ORDER BY table_name;
COMMIT;
\echo 'END LOCAL FINGERPRINT AUDIT'
