-- CA Clover: give each approved, verified CA their own medal once.
-- Approval means role ca/admin PLUS an admin-verified primary CA identity,
-- never merely a Google login or an editable SCOPELY EXPLORE ID.
-- All historic collections, transaction receipts, reunions and designs stay intact.
-- 'self' is a distinct provenance, not an exchange event.

ALTER TABLE public.stamp_collections
  DROP CONSTRAINT stamp_collections_acquisition_source_check;
ALTER TABLE public.stamp_collections
  ADD CONSTRAINT stamp_collections_acquisition_source_check
  CHECK (acquisition_source IN ('normal','event','bulk','admin','import','self'));

CREATE OR REPLACE FUNCTION private.stamp_ensure_own_medal(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, private, pg_temp
AS $function$
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.stamp_collections (
    owner_user_id, stamp_ca_member_id, community_id,
    role_at_acquisition, acquisition_source
  )
  SELECT i.user_id, i.ca_member_id, i.community_id, m.ca_level, 'self'
  FROM public.user_ca_identities i
  JOIN public.profiles p ON p.id=i.user_id
  JOIN public.ca_members m ON m.id=i.ca_member_id
  JOIN public.community_ca_members l
    ON l.ca_member_id=i.ca_member_id AND l.community_id=i.community_id
  WHERE i.user_id=p_user_id
    AND i.is_primary IS TRUE
    AND p.role IN ('ca','admin')
    AND m.status='active'
    AND m.ca_level IN ('1st','2nd')
  ON CONFLICT (owner_user_id,stamp_ca_member_id,community_id) DO NOTHING;
END;
$function$;

REVOKE ALL ON FUNCTION private.stamp_ensure_own_medal(uuid)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.stamp_auto_own_medal_after_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, private, pg_temp
AS $function$
BEGIN
  IF NEW.is_primary IS TRUE THEN
    PERFORM private.stamp_ensure_own_medal(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.stamp_auto_own_medal_after_identity()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER stamp_auto_own_medal_after_identity
  AFTER INSERT OR UPDATE OF is_primary,ca_member_id,community_id
  ON public.user_ca_identities
  FOR EACH ROW
  EXECUTE FUNCTION private.stamp_auto_own_medal_after_identity();

CREATE OR REPLACE FUNCTION private.stamp_auto_own_medal_after_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, private, pg_temp
AS $function$
BEGIN
  IF NEW.role IN ('ca','admin') THEN
    PERFORM private.stamp_ensure_own_medal(NEW.id);
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.stamp_auto_own_medal_after_role()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER stamp_auto_own_medal_after_role
  AFTER UPDATE OF role
  ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION private.stamp_auto_own_medal_after_role();

-- Backfill only already verified primary identities.
-- Previously awarded self medals (e.g. admin grants) are not overwritten.
DO $backfill$
DECLARE v_user uuid;
BEGIN
  FOR v_user IN
    SELECT DISTINCT user_id
    FROM public.user_ca_identities
    WHERE is_primary IS TRUE
  LOOP
    PERFORM private.stamp_ensure_own_medal(v_user);
  END LOOP;
END;
$backfill$;
