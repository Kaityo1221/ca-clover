-- REVIEW-ONLY RELEASE CANDIDATE. DO NOT RUN AGAINST PRODUCTION.
-- Step ②: protect existing verified Identity from a stale CA/Community link DELETE.
-- This file is NOT a Supabase migration and does not grant approval to deploy.
-- Run only against a disposable clone after an operator authorizes preproduction testing.
--
-- Preconditions (fail closed): current 2099 master pause, expected validated
-- composite CASCADE FK, no orphan Identity, safe lock acquisition.
-- The separate CA-master gate, lease and Edge rollout still need approvals.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $guard$
DECLARE c pg_constraint%rowtype;
BEGIN
  -- Never change Identity FK during a possibly active master run.
  IF NOT EXISTS (
    SELECT 1 FROM public.sync_automation_state
    WHERE id = 1 AND last_ca_master_at = '2099-01-01T00:00:00Z'::timestamptz
  ) THEN
    RAISE EXCEPTION 'STOP: emergency CA-master 2099 pause was not confirmed';
  END IF;

  SELECT * INTO c FROM pg_constraint
  WHERE conname = 'user_ca_identities_community_id_ca_member_id_fkey'
    AND conrelid = 'public.user_ca_identities'::regclass
    AND confrelid = 'public.community_ca_members'::regclass;
  IF NOT FOUND OR c.contype <> 'f'
     OR c.confdeltype <> 'c' OR NOT c.convalidated THEN
    RAISE EXCEPTION 'STOP: original validated CASCADE FK differs from reviewed baseline';
  END IF;
  IF c.conkey <> ARRAY[
    (SELECT attnum FROM pg_attribute WHERE attrelid=c.conrelid AND attname='community_id' AND NOT attisdropped),
    (SELECT attnum FROM pg_attribute WHERE attrelid=c.conrelid AND attname='ca_member_id' AND NOT attisdropped)
  ]::smallint[]
  OR c.confkey <> ARRAY[
    (SELECT attnum FROM pg_attribute WHERE attrelid=c.confrelid AND attname='community_id' AND NOT attisdropped),
    (SELECT attnum FROM pg_attribute WHERE attrelid=c.confrelid AND attname='ca_member_id' AND NOT attisdropped)
  ]::smallint[] THEN
    RAISE EXCEPTION 'STOP: original FK column signature differs from expected composite link';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_ca_identities i
    LEFT JOIN public.community_ca_members l
      ON l.community_id=i.community_id AND l.ca_member_id=i.ca_member_id
    WHERE l.community_id IS NULL
  ) THEN
    RAISE EXCEPTION 'STOP: orphan Identity detected before FK change';
  END IF;
END
$guard$;

CREATE TEMPORARY TABLE ca_master_fk_before ON COMMIT DROP AS
SELECT count(*)::bigint AS identities FROM public.user_ca_identities;

ALTER TABLE public.user_ca_identities
  DROP CONSTRAINT user_ca_identities_community_id_ca_member_id_fkey;
ALTER TABLE public.user_ca_identities
  ADD CONSTRAINT user_ca_identities_community_id_ca_member_id_fkey
  FOREIGN KEY (community_id, ca_member_id)
  REFERENCES public.community_ca_members(community_id, ca_member_id)
  ON DELETE RESTRICT NOT DEFERRABLE;

DO $verify$
DECLARE c pg_constraint%rowtype;
BEGIN
  SELECT * INTO c FROM pg_constraint
  WHERE conname='user_ca_identities_community_id_ca_member_id_fkey'
    AND conrelid='public.user_ca_identities'::regclass
    AND confrelid='public.community_ca_members'::regclass;
  IF NOT FOUND OR c.contype<>'f' OR c.confdeltype<>'r'
    OR NOT c.convalidated OR c.condeferrable THEN
    RAISE EXCEPTION 'STOP: FK was not installed as validated, NOT DEFERRABLE RESTRICT';
  END IF;
  IF (SELECT identities FROM ca_master_fk_before) <>
     (SELECT count(*) FROM public.user_ca_identities) THEN
    RAISE EXCEPTION 'STOP: Identity count changed during FK replacement';
  END IF;
  RAISE NOTICE 'PHASE_D_IDENTITY_FK_RESTRICT_CONTRACT_PASS';
END
$verify$;
COMMIT;
