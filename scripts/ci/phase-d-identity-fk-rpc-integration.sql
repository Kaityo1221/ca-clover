-- STEP ② / disposable PostgreSQL only. No real CA records, keys or Supabase connection.
-- This tests the EXACT reviewed FK deployment SQL and ACTUAL reviewed master RPC together.
-- The workflow makes an ephemeral database named ca_clover_identity_fk_qa.
\set ON_ERROR_STOP on
DO $guard$
BEGIN
 IF current_database() <> 'ca_clover_identity_fk_qa'
    OR inet_server_addr() IS NULL
 THEN RAISE EXCEPTION 'STOP: dedicated synthetic CI PostgreSQL TCP database required'; END IF;
END
$guard$;

CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;

CREATE TABLE public.sync_automation_state(
  id smallint PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  ca_master_sync_enabled boolean NOT NULL DEFAULT false,
  last_ca_master_at timestamptz
);
CREATE TABLE public.communities(id uuid PRIMARY KEY);
CREATE TABLE public.ca_members(id uuid PRIMARY KEY);
CREATE TABLE public.community_ca_members(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
 ca_member_id uuid NOT NULL REFERENCES public.ca_members(id) ON DELETE CASCADE,
 UNIQUE (community_id,ca_member_id)
);
CREATE TABLE public.user_ca_identities(
 user_id text NOT NULL, community_id uuid NOT NULL, ca_member_id uuid NOT NULL,
 is_primary boolean NOT NULL DEFAULT false,
 PRIMARY KEY (user_id, community_id, ca_member_id),
 CONSTRAINT user_ca_identities_community_id_ca_member_id_fkey
 FOREIGN KEY(community_id,ca_member_id)
 REFERENCES public.community_ca_members(community_id,ca_member_id)
 ON DELETE CASCADE
);
CREATE TABLE public.stamp_collections(id text PRIMARY KEY, owner_user_id text NOT NULL);
CREATE TABLE public.exchange_sessions(id text PRIMARY KEY, owner_user_id text NOT NULL);

INSERT INTO public.sync_automation_state(id,last_ca_master_at)
VALUES (1,'2099-01-01T00:00:00Z');
INSERT INTO public.communities(id) VALUES
 ('10000000-0000-4000-8000-000000000001'),
 ('10000000-0000-4000-8000-000000000002'),
 ('10000000-0000-4000-8000-000000000003');
INSERT INTO public.ca_members(id) VALUES
 ('20000000-0000-4000-8000-000000000001'),
 ('20000000-0000-4000-8000-000000000002');
INSERT INTO public.community_ca_members(community_id,ca_member_id) VALUES
 ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001'),
 ('10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002');
INSERT INTO public.user_ca_identities(user_id,community_id,ca_member_id,is_primary)
VALUES('fake-user','10000000-0000-4000-8000-000000000001',
       '20000000-0000-4000-8000-000000000001',true);
INSERT INTO public.stamp_collections VALUES('fake-medal','fake-user');
INSERT INTO public.exchange_sessions VALUES('fake-exchange','fake-user');

-- THIS FILE IS REVIEW ONLY, read into a disposable CI DB.
\ir ../../supabase/review/phase-d-identity-fk-restrict.review.sql
\ir ../../supabase/review/ca-master-exclusive-lease.review.sql
\ir ../../supabase/review/ca-master-atomic-link-reconcile.review.sql

BEGIN;
CREATE TEMP TABLE phase_d_integrity_before ON COMMIT DROP AS SELECT
  (SELECT md5(coalesce(string_agg(to_jsonb(t)::text, E'\n' ORDER BY to_jsonb(t)::text),''))
      FROM public.user_ca_identities t) identity_hash,
  (SELECT md5(coalesce(string_agg(to_jsonb(t)::text, E'\n' ORDER BY to_jsonb(t)::text),''))
      FROM public.stamp_collections t) medal_hash,
  (SELECT md5(coalesce(string_agg(to_jsonb(t)::text, E'\n' ORDER BY to_jsonb(t)::text),''))
      FROM public.exchange_sessions t) exchange_hash,
  (SELECT id FROM public.community_ca_members
    WHERE community_id='10000000-0000-4000-8000-000000000001'::uuid
      AND ca_member_id='20000000-0000-4000-8000-000000000001'::uuid) protected_link_id;

DO $test$
DECLARE blocked_link boolean:=false;
        blocked_ca boolean:=false;
        blocked_community boolean:=false;
        fk pg_constraint%rowtype;
BEGIN
  SELECT * INTO fk FROM pg_constraint
   WHERE conrelid='public.user_ca_identities'::regclass
    AND conname='user_ca_identities_community_id_ca_member_id_fkey';
  IF fk.confdeltype <> 'r' OR NOT fk.convalidated OR fk.condeferrable THEN
    RAISE EXCEPTION 'Invalid FK release shape';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.sync_automation_state
    WHERE id=1 AND ca_master_sync_enabled=false AND enabled=true
      AND last_ca_master_at='2099-01-01T00:00:00Z'::timestamptz) THEN
    RAISE EXCEPTION 'Migration changed scheduler state / 2099 pause';
  END IF;
  BEGIN DELETE FROM public.community_ca_members
    WHERE community_id='10000000-0000-4000-8000-000000000001';
  EXCEPTION WHEN foreign_key_violation THEN blocked_link:=true; END;
  BEGIN DELETE FROM public.ca_members
    WHERE id='20000000-0000-4000-8000-000000000001';
  EXCEPTION WHEN foreign_key_violation THEN blocked_ca:=true; END;
  BEGIN DELETE FROM public.communities
    WHERE id='10000000-0000-4000-8000-000000000001';
  EXCEPTION WHEN foreign_key_violation THEN blocked_community:=true; END;
  IF NOT (blocked_link AND blocked_ca AND blocked_community) THEN
    RAISE EXCEPTION 'RESTRICT failed to stop link/CA/Community CASCADE deletion';
  END IF;
  RAISE NOTICE 'PASS: reviewed FK blocks direct and parent-cascade deletes; scheduler untouched';
END $test$;

-- Synthetic ONLY: model the first separately approved master run.
UPDATE public.sync_automation_state SET ca_master_sync_enabled=true WHERE id=1;
DO $test$
BEGIN
 IF public.internal_begin_ca_master_lease(
    '30000000-0000-4000-8000-000000000001'::uuid) IS DISTINCT FROM true THEN
   RAISE EXCEPTION 'Failed to acquire synthetic master lease';
 END IF;
END $test$;

-- Incompatible NO ACTION must fail closed, even though it prevents deletes.
SAVEPOINT fk_variant;
ALTER TABLE public.user_ca_identities
 DROP CONSTRAINT user_ca_identities_community_id_ca_member_id_fkey;
ALTER TABLE public.user_ca_identities
 ADD CONSTRAINT user_ca_identities_community_id_ca_member_id_fkey
 FOREIGN KEY(community_id,ca_member_id)
 REFERENCES public.community_ca_members(community_id,ca_member_id)
 ON DELETE NO ACTION NOT DEFERRABLE;
DO $test$
DECLARE rejected boolean:=false;
BEGIN
 BEGIN
  PERFORM public.internal_reconcile_ca_master_links(
  '[{"community_id":"10000000-0000-4000-8000-000000000001","ca_member_id":"20000000-0000-4000-8000-000000000001"}]'::jsonb,
  ARRAY['20000000-0000-4000-8000-000000000001'::uuid],
  '30000000-0000-4000-8000-000000000001'::uuid);
 EXCEPTION WHEN sqlstate '55000' THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'NO ACTION was improperly accepted as reviewed RESTRICT'; END IF;
 RAISE NOTICE 'PASS: RPC rejects NO ACTION variant';
END $test$;
ROLLBACK TO SAVEPOINT fk_variant;

-- Unvalidated RESTRICT must ALSO fail closed.
SAVEPOINT fk_unvalidated;
ALTER TABLE public.user_ca_identities
 DROP CONSTRAINT user_ca_identities_community_id_ca_member_id_fkey;
ALTER TABLE public.user_ca_identities
 ADD CONSTRAINT user_ca_identities_community_id_ca_member_id_fkey
 FOREIGN KEY(community_id,ca_member_id)
 REFERENCES public.community_ca_members(community_id,ca_member_id)
 ON DELETE RESTRICT NOT VALID;
DO $test$
DECLARE rejected boolean:=false;
BEGIN
 BEGIN
  PERFORM public.internal_reconcile_ca_master_links(
  '[{"community_id":"10000000-0000-4000-8000-000000000001","ca_member_id":"20000000-0000-4000-8000-000000000001"}]'::jsonb,
  ARRAY['20000000-0000-4000-8000-000000000001'::uuid],
  '30000000-0000-4000-8000-000000000001'::uuid);
 EXCEPTION WHEN sqlstate '55000' THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'NOT VALID FK passed the safety contract'; END IF;
 RAISE NOTICE 'PASS: RPC rejects unvalidated RESTRICT FK';
END $test$;
ROLLBACK TO SAVEPOINT fk_unvalidated;

-- Validated, nondeferrable, exact composite RESTRICT: existing links unchanged.
DO $test$
DECLARE result jsonb;
BEGIN
 SELECT public.internal_reconcile_ca_master_links(
 '[{"community_id":"10000000-0000-4000-8000-000000000001","ca_member_id":"20000000-0000-4000-8000-000000000001"},
   {"community_id":"10000000-0000-4000-8000-000000000002","ca_member_id":"20000000-0000-4000-8000-000000000002"}]'::jsonb,
 ARRAY['20000000-0000-4000-8000-000000000001'::uuid,'20000000-0000-4000-8000-000000000002'::uuid],
 '30000000-0000-4000-8000-000000000001'::uuid) INTO result;
 IF (result->>'removed_stale_links')::int <> 0
    OR (SELECT count(*) FROM public.community_ca_members)<>2 THEN
    RAISE EXCEPTION 'Unchanged reviewed-RPC reconciliation was not stable';
 END IF;
 RAISE NOTICE 'PASS: reviewed RPC accepts validated RESTRICT FK and unchanged associations';
END $test$;

-- Non-Identity stale link is still NOT allowed to be pruned without manual review.
DO $test$
DECLARE blocked boolean:=false;
BEGIN
 BEGIN PERFORM public.internal_reconcile_ca_master_links(
 '[{"community_id":"10000000-0000-4000-8000-000000000001","ca_member_id":"20000000-0000-4000-8000-000000000001"},
   {"community_id":"10000000-0000-4000-8000-000000000003","ca_member_id":"20000000-0000-4000-8000-000000000002"}]'::jsonb,
 ARRAY['20000000-0000-4000-8000-000000000001'::uuid,'20000000-0000-4000-8000-000000000002'::uuid],
 '30000000-0000-4000-8000-000000000001'::uuid);
 EXCEPTION WHEN sqlstate '55000' THEN blocked:=true; END;
 IF NOT blocked OR (SELECT count(*) FROM public.community_ca_members) <> 2 THEN
   RAISE EXCEPTION 'Unexpected replacement of unverified old link';
 END IF;
 RAISE NOTICE 'PASS: old association is never pruned automatically';
END $test$;

-- Pure addition allowed, while the original protected association keeps its UUID.
DO $test$
DECLARE result jsonb;
BEGIN
 SELECT public.internal_reconcile_ca_master_links(
 '[{"community_id":"10000000-0000-4000-8000-000000000001","ca_member_id":"20000000-0000-4000-8000-000000000001"},
   {"community_id":"10000000-0000-4000-8000-000000000002","ca_member_id":"20000000-0000-4000-8000-000000000002"},
   {"community_id":"10000000-0000-4000-8000-000000000003","ca_member_id":"20000000-0000-4000-8000-000000000001"}]'::jsonb,
 ARRAY['20000000-0000-4000-8000-000000000001'::uuid,'20000000-0000-4000-8000-000000000002'::uuid],
 '30000000-0000-4000-8000-000000000001'::uuid) INTO result;
 IF (result->>'removed_stale_links')::int <> 0
 OR (SELECT count(*) FROM public.community_ca_members)<>3
 OR (SELECT id FROM public.community_ca_members
     WHERE community_id='10000000-0000-4000-8000-000000000001'::uuid
       AND ca_member_id='20000000-0000-4000-8000-000000000001'::uuid)
     <> (SELECT protected_link_id FROM phase_d_integrity_before)
 THEN RAISE EXCEPTION 'Pure addition did not preserve original protected association'; END IF;
 RAISE NOTICE 'PASS: permitted addition preserves old protected link ID';
END $test$;

DO $verify$
BEGIN
 IF (SELECT identity_hash FROM phase_d_integrity_before) IS DISTINCT FROM
    (SELECT md5(coalesce(string_agg(to_jsonb(t)::text,E'\n' ORDER BY to_jsonb(t)::text),''))
       FROM public.user_ca_identities t)
 OR (SELECT medal_hash FROM phase_d_integrity_before) IS DISTINCT FROM
    (SELECT md5(coalesce(string_agg(to_jsonb(t)::text,E'\n' ORDER BY to_jsonb(t)::text),''))
       FROM public.stamp_collections t)
 OR (SELECT exchange_hash FROM phase_d_integrity_before) IS DISTINCT FROM
    (SELECT md5(coalesce(string_agg(to_jsonb(t)::text,E'\n' ORDER BY to_jsonb(t)::text),''))
       FROM public.exchange_sessions t)
 THEN RAISE EXCEPTION 'FAIL: Identity, medals or exchange fingerprints changed'; END IF;
 RAISE NOTICE 'PHASE_D_STEP_2_FK_RPC_INTEGRATION_PASS: exact FK, blocked deletions, old links, identities, medals and exchanges verified';
END $verify$;
ROLLBACK;
