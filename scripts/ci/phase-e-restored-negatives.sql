-- Disposable restored DB only; every deliberate modification ROLLBACKs.
\set ON_ERROR_STOP on
DO $guard$
BEGIN
 IF current_database()<>'ca_master_restore_qa'
 OR inet_server_addr() IS NULL
 THEN RAISE EXCEPTION 'STOP: wrong restore database'; END IF;
END $guard$;
BEGIN;
DO $test$
DECLARE blocked boolean:=false; oldhash text; newhash text;
BEGIN
 IF (SELECT ca_master_sync_enabled FROM public.sync_automation_state WHERE id=1) IS DISTINCT FROM false
 OR (SELECT enabled FROM public.sync_automation_state WHERE id=1) IS DISTINCT FROM true
 OR (SELECT last_ca_master_at::date FROM public.sync_automation_state WHERE id=1)<>date '2099-01-01'
 THEN RAISE EXCEPTION 'FAIL: CA master stop missing after restore'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint
  WHERE conrelid='public.user_ca_identities'::regclass
  AND conname='user_ca_identities_community_id_ca_member_id_fkey'
  AND confdeltype='r' AND convalidated AND NOT condeferrable)
 THEN RAISE EXCEPTION 'FAIL: composite RESTRICT FK missing'; END IF;
 IF EXISTS(SELECT 1 FROM public.user_ca_identities i
  LEFT JOIN public.community_ca_members l ON l.community_id=i.community_id AND l.ca_member_id=i.ca_member_id
  WHERE l.id IS NULL) THEN RAISE EXCEPTION 'FAIL: orphan identity'; END IF;
 BEGIN
   DELETE FROM public.community_ca_members WHERE id='fake-link-1';
 EXCEPTION WHEN foreign_key_violation THEN blocked:=true;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'FAIL: linked record deletion allowed'; END IF;
 IF (SELECT count(*) FROM public.user_ca_identities)<>7
 OR (SELECT count(*) FROM public.stamp_collections)<>14
 OR (SELECT count(*) FROM public.stamp_collection_designs)<>14
 OR (SELECT count(*) FROM public.stamp_exchange_sessions)<>20
 THEN RAISE EXCEPTION 'FAIL: restored records missing'; END IF;
 SELECT md5(coalesce(string_agg(to_jsonb(t)::text,E'\n' ORDER BY to_jsonb(t)::text),''))
 INTO oldhash FROM public.stamp_collections t;
 UPDATE public.stamp_collections SET notes='synthetic tamper' WHERE id='fake-medal-1';
 SELECT md5(coalesce(string_agg(to_jsonb(t)::text,E'\n' ORDER BY to_jsonb(t)::text),''))
 INTO newhash FROM public.stamp_collections t;
 IF newhash IS NOT DISTINCT FROM oldhash
 THEN RAISE EXCEPTION 'FAIL: content tamper was not detectable'; END IF;
 RAISE NOTICE 'SYNTHETIC_RESTORE_NEGATIVE_PASS: STOP preserved, FK blocks delete, medal tamper detected';
END $test$;
ROLLBACK;
