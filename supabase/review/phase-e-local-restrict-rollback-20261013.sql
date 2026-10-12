-- LOCAL ONLY: test ON DELETE RESTRICT without persisting any DDL/DML.
-- Invoke only through controlled Windows runner in isolated restore container.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $before$
BEGIN
 IF current_database() <> 'postgres' OR inet_server_addr() IS NOT NULL
 THEN RAISE EXCEPTION 'STOP: expected isolated local postgres Unix socket'; END IF;
 IF (SELECT count(*) FROM auth.users) <> 7 OR
    (SELECT count(*) FROM public.user_ca_identities) <> 7 OR
    (SELECT count(*) FROM public.stamp_collections) <> 14 OR
    (SELECT count(*) FROM public.stamp_exchange_sessions) <> 20
 THEN RAISE EXCEPTION 'STOP: restored snapshot count mismatch'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.sync_automation_state
    WHERE id=1 AND last_ca_master_at='2099-01-01T00:00:00Z'::timestamptz)
 THEN RAISE EXCEPTION 'STOP: paused sentinel not found'; END IF;
 IF NOT EXISTS (
  SELECT 1 FROM pg_constraint WHERE conrelid='public.user_ca_identities'::regclass
  AND conname='user_ca_identities_community_id_ca_member_id_fkey'
  AND convalidated AND confdeltype='c'
 ) THEN RAISE EXCEPTION 'STOP: baseline FK is not validated CASCADE'; END IF;
 RAISE NOTICE 'LOCAL_INITIAL_SAFETY_PASS';
END
$before$;
ALTER TABLE public.user_ca_identities
DROP CONSTRAINT user_ca_identities_community_id_ca_member_id_fkey;
ALTER TABLE public.user_ca_identities
ADD CONSTRAINT user_ca_identities_community_id_ca_member_id_fkey
FOREIGN KEY (community_id, ca_member_id)
REFERENCES public.community_ca_members(community_id, ca_member_id)
ON DELETE RESTRICT NOT DEFERRABLE;
DO $test$
DECLARE victim bigint; blocked boolean := false;
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM pg_constraint WHERE conrelid='public.user_ca_identities'::regclass
  AND conname='user_ca_identities_community_id_ca_member_id_fkey'
  AND convalidated AND confdeltype='r' AND NOT condeferrable
 ) THEN RAISE EXCEPTION 'STOP: RESTRICT FK not validated'; END IF;
 -- SAVEPOINT-like PL/pgSQL exception subtransaction makes the attempted DELETE atomic.
 BEGIN
   DELETE FROM public.community_ca_members
    WHERE id = (
      SELECT l.id FROM public.community_ca_members l
      JOIN public.user_ca_identities i ON i.community_id=l.community_id AND i.ca_member_id=l.ca_member_id
      ORDER BY l.id LIMIT 1
    );
   IF NOT FOUND THEN RAISE EXCEPTION 'STOP: no protected link to test'; END IF;
 EXCEPTION WHEN foreign_key_violation THEN
   blocked := true;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'STOP: referenced-link deletion was not blocked'; END IF;
 IF (SELECT count(*) FROM public.user_ca_identities)<>7 OR
    (SELECT count(*) FROM public.stamp_collections)<>14 OR
    (SELECT count(*) FROM public.stamp_exchange_sessions)<>20
 THEN RAISE EXCEPTION 'STOP: dependent counts changed'; END IF;
 RAISE NOTICE 'LOCAL_RESTRICT_DELETE_BLOCKED_PASS';
END
$test$;
ROLLBACK;
DO $after$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint
  WHERE conrelid='public.user_ca_identities'::regclass
    AND conname='user_ca_identities_community_id_ca_member_id_fkey'
    AND confdeltype='c' AND convalidated
 ) THEN RAISE EXCEPTION 'STOP: rollback did not restore original FK'; END IF;
 IF (SELECT count(*) FROM public.user_ca_identities)<>7 OR
    (SELECT count(*) FROM public.stamp_collections)<>14 OR
    (SELECT count(*) FROM public.stamp_exchange_sessions)<>20
 THEN RAISE EXCEPTION 'STOP: post-rollback count mismatch'; END IF;
 RAISE NOTICE 'LOCAL_ROLLBACK_VERIFIED_PASS';
END
$after$;
