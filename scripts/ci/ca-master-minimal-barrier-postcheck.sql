-- Disposable PostgreSQL post-migration checks.
\set ON_ERROR_STOP on
DO $post$
DECLARE blocked boolean := false;
BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM information_schema.columns
   WHERE table_schema='public' AND table_name='sync_automation_state'
     AND column_name='ca_master_sync_enabled'
     AND data_type='boolean' AND is_nullable='NO'
 ) THEN RAISE EXCEPTION 'STOP: expected dedicated gate is missing'; END IF;

 IF NOT EXISTS(
  SELECT 1 FROM public.sync_automation_state
  WHERE id=1 AND ca_master_sync_enabled IS FALSE
    AND last_ca_master_at='2099-01-01T00:00:00Z'::timestamptz
 ) THEN RAISE EXCEPTION 'STOP: gate not OFF or emergency sentinel modified'; END IF;

 IF NOT EXISTS (
   SELECT 1 FROM pg_constraint
   WHERE conrelid='public.user_ca_identities'::regclass
     AND conname='user_ca_identities_community_id_ca_member_id_fkey'
     AND confdeltype='r' AND convalidated AND NOT condeferrable
 ) THEN RAISE EXCEPTION 'STOP: FK not RESTRICT and validated'; END IF;

 BEGIN
   DELETE FROM public.community_ca_members
   WHERE ca_member_id='00000000-0000-4000-8000-000000000002'::uuid;
 EXCEPTION WHEN foreign_key_violation THEN
   blocked := true;
 END;
 IF NOT blocked THEN RAISE EXCEPTION 'STOP: deletion of identity-linked CA link succeeded'; END IF;
 IF (SELECT count(*) FROM public.user_ca_identities) <> 1 OR
    (SELECT count(*) FROM public.community_ca_members) <> 1
 THEN RAISE EXCEPTION 'STOP: data loss during FK rejection'; END IF;

 IF has_table_privilege('anon','public.sync_automation_state','UPDATE') OR
    has_table_privilege('authenticated','public.sync_automation_state','UPDATE')
 THEN RAISE EXCEPTION 'STOP: public update grant'; END IF;

 RAISE NOTICE 'SYNTHETIC_MINIMAL_BARRIER_PASS';
END
$post$;
