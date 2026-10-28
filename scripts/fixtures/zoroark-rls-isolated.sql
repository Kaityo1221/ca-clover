-- Zoroark synthetic PostgreSQL fixture. Ephemeral self-created cluster ONLY.
-- Contract based on existing deployed-candidate migrations, not a production dump.
\set ON_ERROR_STOP on

CREATE ROLE authenticated NOLOGIN;
CREATE ROLE anon NOLOGIN;
CREATE SCHEMA auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
GRANT USAGE ON SCHEMA auth TO authenticated, anon;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated, anon;

CREATE TABLE public.profiles (
 id uuid PRIMARY KEY,
 role text NOT NULL DEFAULT 'pending',
 niantic_id text
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT SELECT ON public.profiles TO authenticated, anon;
-- The migration 20260919_restrict_profile_updates... restricts updates to this column.
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (niantic_id) ON public.profiles TO authenticated;
CREATE SCHEMA private;
REVOKE ALL ON SCHEMA private FROM public;
GRANT USAGE ON SCHEMA private TO authenticated;
CREATE OR REPLACE FUNCTION private.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
 SELECT EXISTS (
   SELECT 1 FROM public.profiles p
   WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'
 );
$$;
GRANT EXECUTE ON FUNCTION private.is_admin() TO authenticated;
CREATE POLICY "profiles self or admin read"
ON public.profiles FOR SELECT TO authenticated
USING (id=(SELECT auth.uid()) OR private.is_admin());
CREATE POLICY "profiles self update"
ON public.profiles FOR UPDATE TO authenticated
USING (id=(SELECT auth.uid()))
WITH CHECK (id=(SELECT auth.uid()));

INSERT INTO public.profiles(id,role) VALUES
('00000000-0000-4000-8000-000000000001','ca'),
('00000000-0000-4000-8000-000000000002','admin'),
('00000000-0000-4000-8000-000000000003','pending'),
('00000000-0000-4000-8000-000000000004','ca'),
('00000000-0000-4000-8000-000000000005','pending');

SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';
DO $$
DECLARE seen integer; role_value text;
BEGIN
 SELECT count(*) INTO seen FROM public.profiles;
 IF seen <> 1 THEN RAISE EXCEPTION 'CA must only see own profile, got %',seen; END IF;
 SELECT role INTO role_value FROM public.profiles WHERE id=auth.uid();
 IF role_value IS DISTINCT FROM 'ca' THEN RAISE EXCEPTION 'CA role read failed'; END IF;
 RAISE NOTICE 'ZOROARK_PG_CA_SELF_READ_PASS';
END $$;

-- JWT metadata and requested role do not override the authoritative DB role.
SET request.jwt.claim.role = 'admin';
DO $$
BEGIN
 IF (SELECT count(*) FROM public.profiles) <> 1 THEN
   RAISE EXCEPTION 'A CA must not read foreign profiles from JWT role metadata';
 END IF;
 IF private.is_admin() THEN RAISE EXCEPTION 'Forged JWT claim elevated role'; END IF;
 RAISE NOTICE 'ZOROARK_PG_FORGED_META_DENIED_PASS';
END $$;

-- Column update grant is narrower than row-update RLS: role modification is forbidden.
DO $$
BEGIN
 BEGIN
   UPDATE public.profiles SET role='admin' WHERE id=auth.uid();
   RAISE EXCEPTION 'SELF_ROLE_ESCALATION_POSSIBLE';
 EXCEPTION WHEN insufficient_privilege THEN
   RAISE NOTICE 'ZOROARK_PG_SELF_ROLE_ESCALATION_DENIED_PASS';
 END;
END $$;

-- The approved profile column remains editable to its owner.
UPDATE public.profiles SET niantic_id='synthetic' WHERE id=auth.uid();
DO $$
BEGIN
 IF (SELECT niantic_id FROM public.profiles WHERE id=auth.uid()) IS DISTINCT FROM 'synthetic'
 THEN RAISE EXCEPTION 'Expected niantic_id self update'; END IF;
 RAISE NOTICE 'ZOROARK_PG_SELF_NIANTIC_UPDATE_PASS';
END $$;

SET request.jwt.claim.sub = '00000000-0000-4000-8000-000000000002';
DO $$
BEGIN
 IF (SELECT count(*) FROM public.profiles) <> 5
 THEN RAISE EXCEPTION 'Admin profile read denied'; END IF;
 IF NOT private.is_admin() THEN RAISE EXCEPTION 'Valid admin rejected'; END IF;
 RAISE NOTICE 'ZOROARK_PG_ADMIN_READ_PASS';
END $$;

SET request.jwt.claim.sub = '00000000-0000-4000-8000-000000000003';
DO $$
BEGIN
 IF (SELECT count(*) FROM public.profiles) <> 1
 THEN RAISE EXCEPTION 'Pending must only see own row'; END IF;
 IF EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role IN ('ca','admin'))
 THEN RAISE EXCEPTION 'Pending role unexpectedly authorized'; END IF;
 RAISE NOTICE 'ZOROARK_PG_PENDING_DENIED_PASS';
END $$;

SET request.jwt.claim.sub = '00000000-0000-4000-8000-000000000004';
DO $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role='ca')
 THEN RAISE EXCEPTION 'Revocation setup failed'; END IF;
END $$;
RESET ROLE;
-- Only the isolated cluster owner changes the role; user token remains identical.
UPDATE public.profiles SET role='pending'
WHERE id='00000000-0000-4000-8000-000000000004';
SET ROLE authenticated;
DO $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role IN ('ca','admin'))
 THEN RAISE EXCEPTION 'Revoked user retained CA authorization'; END IF;
 RAISE NOTICE 'ZOROARK_PG_LIVE_REVOCATION_PASS';
END $$;

SET request.jwt.claim.sub = '00000000-0000-4000-8000-000000000005';
DO $$
BEGIN
 IF (SELECT count(*) FROM public.profiles) <> 1
 THEN RAISE EXCEPTION 'Other user privacy breach'; END IF;
 RAISE NOTICE 'ZOROARK_PG_OTHER_USER_ISOLATION_PASS';
END $$;

RESET ROLE;
SET ROLE anon;
SET request.jwt.claim.sub = '';
DO $$
BEGIN
 IF (SELECT count(*) FROM public.profiles) <> 0
 THEN RAISE EXCEPTION 'Anonymous user can read roles'; END IF;
 RAISE NOTICE 'ZOROARK_PG_ANON_DENIED_PASS';
END $$;
RESET ROLE;
SELECT 'ZOROARK_PG_RLS_ISOLATED_PASS' AS verdict;
