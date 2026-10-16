-- CA Clover Phase E: operator local-only restored data verification.
-- Not a restore command. Reads local Unix socket, never production or public CI data.
\set ON_ERROR_STOP on
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY;
DO $guard$
BEGIN
 IF current_database() NOT IN ('postgres','ca_master_restore_qa')
 OR inet_server_addr() IS NOT NULL
 OR current_setting('server_version_num')::integer / 10000 <> 17
 THEN RAISE EXCEPTION 'STOP: PostgreSQL17 local socket+allowed restored DB required'; END IF;
 IF NOT EXISTS (
  SELECT 1 FROM pg_constraint
  WHERE conrelid='public.user_ca_identities'::regclass
    AND conname='user_ca_identities_community_id_ca_member_id_fkey'
    AND confdeltype='r' AND convalidated AND NOT condeferrable)
 THEN RAISE EXCEPTION 'STOP: composite Identity RESTRICT missing or unvalidated'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.sync_automation_state
  WHERE id=1 AND enabled IS TRUE AND ca_master_sync_enabled IS FALSE
   AND last_ca_master_at::date = date '2099-01-01')
 THEN RAISE EXCEPTION 'STOP: master gate or 2099 sentinel unsafe'; END IF;
 IF EXISTS (
  SELECT 1 FROM public.user_ca_identities i
  LEFT JOIN public.community_ca_members l
   ON l.ca_member_id=i.ca_member_id AND l.community_id=i.community_id
  WHERE l.id IS NULL)
 THEN RAISE EXCEPTION 'STOP: orphaned Identity'; END IF;
 IF EXISTS (
  SELECT 1 FROM public.stamp_collections s
  LEFT JOIN auth.users u ON u.id=s.owner_user_id
  LEFT JOIN public.ca_members m ON m.id=s.stamp_ca_member_id
  LEFT JOIN public.communities c ON c.id=s.community_id
  WHERE u.id IS NULL OR m.id IS NULL OR c.id IS NULL)
 THEN RAISE EXCEPTION 'STOP: orphaned medal owner/CA/community'; END IF;
 IF EXISTS (
  SELECT 1 FROM public.stamp_collection_designs d
  LEFT JOIN public.stamp_collections s ON s.id=d.collection_id
  WHERE s.id IS NULL)
 THEN RAISE EXCEPTION 'STOP: orphaned medal design'; END IF;
 IF EXISTS (
  SELECT 1 FROM public.user_ca_identities
  WHERE is_primary IS TRUE GROUP BY user_id HAVING count(*)>1)
 THEN RAISE EXCEPTION 'STOP: duplicated primary Identity'; END IF;
 IF EXISTS (
  SELECT 1 FROM pg_constraint
  WHERE contype='f' AND connamespace IN (
    'public'::regnamespace,'auth'::regnamespace,'storage'::regnamespace)
    AND convalidated IS NOT TRUE)
 THEN RAISE EXCEPTION 'STOP: unvalidated FK'; END IF;
 RAISE NOTICE 'PROTECTION_PASS: OFF + 2099 + RESTRICT + relationships';
END $guard$;
DO $count_check$
BEGIN
 IF (SELECT count(*) FROM auth.users) <> 7 THEN RAISE EXCEPTION 'STOP: auth_users expected 7'; END IF;
 IF (SELECT count(*) FROM auth.identities) <> 7 THEN RAISE EXCEPTION 'STOP: auth_identities expected 7'; END IF;
 IF (SELECT count(*) FROM public.profiles) <> 7 THEN RAISE EXCEPTION 'STOP: profiles expected 7'; END IF;
 IF (SELECT count(*) FROM public.ca_members) <> 200 THEN RAISE EXCEPTION 'STOP: ca_members expected 200'; END IF;
 IF (SELECT count(*) FROM public.communities) <> 155 THEN RAISE EXCEPTION 'STOP: communities expected 155'; END IF;
 IF (SELECT count(*) FROM public.community_ca_members) <> 196 THEN RAISE EXCEPTION 'STOP: ca_links expected 196'; END IF;
 IF (SELECT count(*) FROM public.user_ca_identities) <> 7 THEN RAISE EXCEPTION 'STOP: ca_identities expected 7'; END IF;
 IF (SELECT count(*) FROM public.stamp_collections) <> 14 THEN RAISE EXCEPTION 'STOP: medals expected 14'; END IF;
 IF (SELECT count(*) FROM public.stamp_collection_designs) <> 14 THEN RAISE EXCEPTION 'STOP: designs expected 14'; END IF;
 IF (SELECT count(*) FROM public.stamp_exchange_sessions) <> 20 THEN RAISE EXCEPTION 'STOP: exchanges expected 20'; END IF;
 IF (SELECT count(*) FROM public.sync_automation_state) <> 1 THEN RAISE EXCEPTION 'STOP: sync_state expected 1'; END IF;
 IF (SELECT count(*) FROM storage.objects) <> 418 THEN RAISE EXCEPTION 'STOP: storage_metadata expected 418'; END IF;
 RAISE NOTICE 'COUNT_PASS: 12 current-volume checks passed';
END $count_check$;
SELECT 'DATA|'||label||'|'||n::text||'|'||digest
FROM (
 SELECT 'auth_users' AS label, count(*) AS n,
 encode(sha256(convert_to(coalesce(string_agg(to_jsonb(t)::text,E'\n' ORDER BY to_jsonb(t)::text),''),'UTF8')),'hex') AS digest
 FROM auth.users t
 UNION ALL
 SELECT 'auth_identities' AS label, count(*) AS n,
 encode(sha256(convert_to(coalesce(string_agg(to_jsonb(t)::text,E'\n' ORDER BY to_jsonb(t)::text),''),'UTF8')),'hex') AS digest
 FROM auth.identities t
 UNION ALL
 SELECT 'profiles' AS label, count(*) AS n,
 encode(sha256(convert_to(coalesce(string_agg(to_jsonb(t)::text,E'\n' ORDER BY to_jsonb(t)::text),''),'UTF8')),'hex') AS digest
 FROM public.profiles t
 UNION ALL
 SELECT 'ca_members' AS label, count(*) AS n,
 encode(sha256(convert_to(coalesce(string_agg(to_jsonb(t)::text,E'\n' ORDER BY to_jsonb(t)::text),''),'UTF8')),'hex') AS digest
 FROM public.ca_members t
 UNION ALL
 SELECT 'communities' AS label, count(*) AS n,
 encode(sha256(convert_to(coalesce(string_agg(to_jsonb(t)::text,E'\n' ORDER BY to_jsonb(t)::text),''),'UTF8')),'hex') AS digest
 FROM public.communities t
 UNION ALL
 SELECT 'ca_links' AS label, count(*) AS n,
 encode(sha256(convert_to(coalesce(string_agg(to_jsonb(t)::text,E'\n' ORDER BY to_jsonb(t)::text),''),'UTF8')),'hex') AS digest
 FROM public.community_ca_members t
 UNION ALL
 SELECT 'ca_identities' AS label, count(*) AS n,
 encode(sha256(convert_to(coalesce(string_agg(to_jsonb(t)::text,E'\n' ORDER BY to_jsonb(t)::text),''),'UTF8')),'hex') AS digest
 FROM public.user_ca_identities t
 UNION ALL
 SELECT 'medals' AS label, count(*) AS n,
 encode(sha256(convert_to(coalesce(string_agg(to_jsonb(t)::text,E'\n' ORDER BY to_jsonb(t)::text),''),'UTF8')),'hex') AS digest
 FROM public.stamp_collections t
 UNION ALL
 SELECT 'designs' AS label, count(*) AS n,
 encode(sha256(convert_to(coalesce(string_agg(to_jsonb(t)::text,E'\n' ORDER BY to_jsonb(t)::text),''),'UTF8')),'hex') AS digest
 FROM public.stamp_collection_designs t
 UNION ALL
 SELECT 'exchanges' AS label, count(*) AS n,
 encode(sha256(convert_to(coalesce(string_agg(to_jsonb(t)::text,E'\n' ORDER BY to_jsonb(t)::text),''),'UTF8')),'hex') AS digest
 FROM public.stamp_exchange_sessions t
 UNION ALL
 SELECT 'sync_state' AS label, count(*) AS n,
 encode(sha256(convert_to(coalesce(string_agg(to_jsonb(t)::text,E'\n' ORDER BY to_jsonb(t)::text),''),'UTF8')),'hex') AS digest
 FROM public.sync_automation_state t
 UNION ALL
 SELECT 'storage_metadata' AS label, count(*) AS n,
 encode(sha256(convert_to(coalesce(string_agg(to_jsonb(t)::text,E'\n' ORDER BY to_jsonb(t)::text),''),'UTF8')),'hex') AS digest
 FROM storage.objects t
) t
ORDER BY label;
SELECT 'AUDIT_LOCAL_PASS|12_TABLES|COUNTS_AND_FINGERPRINTS'::text;
COMMIT;
