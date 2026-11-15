-- CA Clover / Zoroark catalog review (2026-11-15)
-- ISOLATED DESIGN ONLY: DO NOT APPLY TO PRODUCTION WITHOUT EXPLICIT GO.
-- Admin current role is checked against public.profiles via auth.uid().
-- This migration is inert in git until it is separately applied in an approved QA DB.

CREATE TABLE IF NOT EXISTS public.zoroark_topic_candidates (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 pair_key text NOT NULL UNIQUE,
 a text NOT NULL,b text NOT NULL,
 a_no text NOT NULL DEFAULT '',b_no text NOT NULL DEFAULT '',
 common text NOT NULL,difference text NOT NULL,
 level text NOT NULL CHECK(level IN ('easy','normal','hard')),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','approved','published','retired')),
 version integer NOT NULL DEFAULT 0 CHECK(version>=0),
 submitted_by uuid NOT NULL,
 submitted_at timestamptz NOT NULL DEFAULT now(),
 reviewed_by uuid,reviewed_at timestamptz,
 published_by uuid,published_at timestamptz,
 retired_by uuid,retired_at timestamptz,
 CHECK (length(pair_key) BETWEEN 3 AND 200),
 CHECK (length(trim(a)) BETWEEN 1 AND 80 AND length(trim(b)) BETWEEN 1 AND 80 AND a<>b),
 CHECK (length(common) BETWEEN 1 AND 500 AND length(difference) BETWEEN 1 AND 500),
 CHECK (a_no='' OR a_no ~ '^\d{1,4}$'),
 CHECK (b_no='' OR b_no ~ '^\d{1,4}$'),
 CHECK (id BETWEEN 1 AND 9999)
);
CREATE SEQUENCE IF NOT EXISTS public.zoroark_topic_catalog_version START 1;
CREATE TABLE IF NOT EXISTS public.zoroark_topic_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 topic_id bigint NOT NULL REFERENCES public.zoroark_topic_candidates(id),
 actor_uid uuid NOT NULL, action text NOT NULL,
 before_status text,after_status text NOT NULL,
 version integer NOT NULL DEFAULT 0,
 occurred_at timestamptz NOT NULL DEFAULT now(),
 CHECK(action IN ('submit','approve','publish','retire'))
);
ALTER TABLE public.zoroark_topic_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zoroark_topic_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.zoroark_topic_candidates FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.zoroark_topic_audit FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.zoroark_topic_candidates TO authenticated;
GRANT SELECT ON public.zoroark_topic_audit TO authenticated;

CREATE OR REPLACE FUNCTION public.zoroark_topic_is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS
  (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role='admin')
$$;
REVOKE ALL ON FUNCTION public.zoroark_topic_is_admin() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.zoroark_topic_is_admin() TO authenticated;

DROP POLICY IF EXISTS zoroark_topic_read ON public.zoroark_topic_candidates;
CREATE POLICY zoroark_topic_read ON public.zoroark_topic_candidates FOR SELECT TO authenticated
USING (
 public.zoroark_topic_is_admin()
 OR (status='published' AND EXISTS
  (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role IN('ca','admin')))
);
DROP POLICY IF EXISTS zoroark_audit_admin_read ON public.zoroark_topic_audit;
CREATE POLICY zoroark_audit_admin_read ON public.zoroark_topic_audit FOR SELECT TO authenticated
USING (public.zoroark_topic_is_admin());

CREATE OR REPLACE FUNCTION public.zoroark_topic_submit(p_topic jsonb)
RETURNS public.zoroark_topic_candidates
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v public.zoroark_topic_candidates%ROWTYPE; v_actor uuid:=auth.uid();
BEGIN
 IF NOT public.zoroark_topic_is_admin() THEN RAISE EXCEPTION 'admin required' USING ERRCODE='42501'; END IF;
 IF p_topic IS NULL OR jsonb_typeof(p_topic)<>'object' THEN RAISE EXCEPTION 'invalid topic' USING ERRCODE='22023'; END IF;
 IF length(trim(coalesce(p_topic->>'a',''))) NOT BETWEEN 1 AND 80
 OR length(trim(coalesce(p_topic->>'b',''))) NOT BETWEEN 1 AND 80
 OR trim(p_topic->>'a')=trim(p_topic->>'b')
 OR length(trim(coalesce(p_topic->>'common',''))) NOT BETWEEN 1 AND 500
 OR length(trim(coalesce(p_topic->>'difference',''))) NOT BETWEEN 1 AND 500
 OR coalesce(p_topic->>'level','') NOT IN('easy','normal','hard')
 OR length(trim(coalesce(p_topic->>'pair_key',''))) NOT BETWEEN 3 AND 200
 OR coalesce(p_topic->>'aNo','') !~ '^([0-9]{1,4})?$'
 OR coalesce(p_topic->>'bNo','') !~ '^([0-9]{1,4})?$'
 THEN RAISE EXCEPTION 'incomplete topic' USING ERRCODE='22023'; END IF;
 INSERT INTO public.zoroark_topic_candidates
  (pair_key,a,b,a_no,b_no,common,difference,level,submitted_by)
 VALUES (trim(p_topic->>'pair_key'),trim(p_topic->>'a'),trim(p_topic->>'b'),
  coalesce(p_topic->>'aNo',''),coalesce(p_topic->>'bNo',''),trim(p_topic->>'common'),
  trim(p_topic->>'difference'),p_topic->>'level',v_actor)
 RETURNING * INTO v;
 INSERT INTO public.zoroark_topic_audit(topic_id,actor_uid,action,before_status,after_status,version)
 VALUES(v.id,v_actor,'submit',NULL,'pending',0);
 RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.zoroark_topic_submit(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.zoroark_topic_submit(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.zoroark_topic_decide(p_id bigint,p_action text)
RETURNS public.zoroark_topic_candidates
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE v public.zoroark_topic_candidates%ROWTYPE;
 v_actor uuid:=auth.uid(); v_next text; v_version int;
BEGIN
 IF NOT public.zoroark_topic_is_admin() THEN RAISE EXCEPTION 'admin required' USING ERRCODE='42501'; END IF;
 SELECT * INTO v FROM public.zoroark_topic_candidates WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'not found' USING ERRCODE='P0002'; END IF;
 IF p_action='approve' AND v.status='pending' THEN v_next:='approved';
 ELSIF p_action='publish' AND v.status='approved' THEN v_next:='published';
 ELSIF p_action='retire' AND v.status='published' THEN v_next:='retired';
 ELSE RAISE EXCEPTION 'invalid transition' USING ERRCODE='22023'; END IF;
 -- Serialize versioned publication events. Failed transactions leave audit and state intact.
 IF v_next IN ('published','retired') THEN
  PERFORM pg_advisory_xact_lock(8401125);
  v_version:=nextval('public.zoroark_topic_catalog_version'::regclass)::int;
 ELSE v_version:=v.version;
 END IF;
 UPDATE public.zoroark_topic_candidates SET status=v_next,version=v_version,
  reviewed_by=CASE WHEN v_next='approved' THEN v_actor ELSE reviewed_by END,
  reviewed_at=CASE WHEN v_next='approved' THEN now() ELSE reviewed_at END,
  published_by=CASE WHEN v_next='published' THEN v_actor ELSE published_by END,
  published_at=CASE WHEN v_next='published' THEN now() ELSE published_at END,
  retired_by=CASE WHEN v_next='retired' THEN v_actor ELSE retired_by END,
  retired_at=CASE WHEN v_next='retired' THEN now() ELSE retired_at END
 WHERE id=p_id RETURNING * INTO v;
 INSERT INTO public.zoroark_topic_audit(topic_id,actor_uid,action,before_status,after_status,version)
 VALUES(v.id,v_actor,p_action,
  CASE WHEN p_action='approve' THEN 'pending' WHEN p_action='publish' THEN 'approved' ELSE 'published' END,
  v_next,v_version);
 RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.zoroark_topic_decide(bigint,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.zoroark_topic_decide(bigint,text) TO authenticated;
