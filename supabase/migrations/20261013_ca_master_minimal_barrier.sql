-- CA Clover: minimal production CA master barrier.
-- RELEASE CANDIDATE ONLY; do not run until approved release window.
-- Deploy retired legacy Edge writer guards BEFORE this migration.
-- This migration makes no user or medal row changes. On error transaction rolls back.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $guard$
DECLARE original_fk pg_constraint%ROWTYPE;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.sync_automation_state
    WHERE id=1 AND last_ca_master_at='2099-01-01T00:00:00Z'::timestamptz
  ) THEN
    RAISE EXCEPTION 'STOP: 2099 CA-master emergency pause is not intact';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='sync_automation_state'
      AND column_name='ca_master_sync_enabled'
  ) THEN
    RAISE EXCEPTION 'STOP: dedicated gate already exists; review deployment state';
  END IF;

  IF has_table_privilege('anon','public.sync_automation_state','UPDATE') OR
     has_table_privilege('authenticated','public.sync_automation_state','UPDATE') THEN
    RAISE EXCEPTION 'STOP: public/authenticated update grant on sync_automation_state';
  END IF;

  SELECT * INTO original_fk
  FROM pg_catalog.pg_constraint
  WHERE conrelid='public.user_ca_identities'::regclass
    AND confrelid='public.community_ca_members'::regclass
    AND conname='user_ca_identities_community_id_ca_member_id_fkey';

  IF NOT FOUND OR original_fk.contype<>'f'
    OR original_fk.confdeltype<>'c'
    OR NOT original_fk.convalidated
    OR original_fk.condeferrable THEN
    RAISE EXCEPTION 'STOP: unexpected original FK, cannot safely replace';
  END IF;

  IF original_fk.conkey <> ARRAY[
    (SELECT attnum FROM pg_attribute
      WHERE attrelid=original_fk.conrelid AND attname='community_id' AND NOT attisdropped),
    (SELECT attnum FROM pg_attribute
      WHERE attrelid=original_fk.conrelid AND attname='ca_member_id' AND NOT attisdropped)
  ]::smallint[]
  OR original_fk.confkey <> ARRAY[
    (SELECT attnum FROM pg_attribute
      WHERE attrelid=original_fk.confrelid AND attname='community_id' AND NOT attisdropped),
    (SELECT attnum FROM pg_attribute
      WHERE attrelid=original_fk.confrelid AND attname='ca_member_id' AND NOT attisdropped)
  ]::smallint[] THEN
    RAISE EXCEPTION 'STOP: expected composite FK columns differ';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_ca_identities i
    LEFT JOIN public.community_ca_members l
      ON i.community_id=l.community_id AND i.ca_member_id=l.ca_member_id
    WHERE l.id IS NULL
  ) THEN
    RAISE EXCEPTION 'STOP: orphaned CA Identity references present';
  END IF;
END
$guard$;

-- The default is OFF and existing singleton row inherits OFF atomically.
ALTER TABLE public.sync_automation_state
  ADD COLUMN ca_master_sync_enabled boolean NOT NULL DEFAULT false;

-- DB backstop: no existing verified Identity can disappear via CA link deletion.
ALTER TABLE public.user_ca_identities
  DROP CONSTRAINT user_ca_identities_community_id_ca_member_id_fkey;
ALTER TABLE public.user_ca_identities
  ADD CONSTRAINT user_ca_identities_community_id_ca_member_id_fkey
  FOREIGN KEY (community_id, ca_member_id)
  REFERENCES public.community_ca_members(community_id, ca_member_id)
  ON DELETE RESTRICT NOT DEFERRABLE;

DO $verify$
BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM pg_catalog.pg_constraint
   WHERE conrelid='public.user_ca_identities'::regclass
     AND confrelid='public.community_ca_members'::regclass
     AND conname='user_ca_identities_community_id_ca_member_id_fkey'
     AND contype='f' AND confdeltype='r'
     AND convalidated AND NOT condeferrable
 ) THEN RAISE EXCEPTION 'STOP: RESTRICT constraint not validated'; END IF;

 IF NOT EXISTS (
   SELECT 1 FROM information_schema.columns
   WHERE table_schema='public' AND table_name='sync_automation_state'
     AND column_name='ca_master_sync_enabled'
     AND data_type='boolean' AND is_nullable='NO'
 ) THEN RAISE EXCEPTION 'STOP: missing NOT NULL boolean master gate'; END IF;

 IF NOT EXISTS (
   SELECT 1 FROM public.sync_automation_state
   WHERE id=1 AND ca_master_sync_enabled IS FALSE
     AND last_ca_master_at='2099-01-01T00:00:00Z'::timestamptz
 ) THEN RAISE EXCEPTION 'STOP: gate not OFF or emergency pause altered'; END IF;

 RAISE NOTICE 'CA_MASTER_MINIMAL_BARRIER_VERIFIED';
END
$verify$;
COMMIT;
