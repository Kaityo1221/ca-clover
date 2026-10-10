-- REVIEW ONLY: DO NOT execute or apply on production without explicit approval.
-- This is not a Supabase migration. Generate the versioned file via Supabase CLI.
--
-- Admin-only fallback: the Campfire creator is verified as an Ambassador,
-- but the Japanese CA master has no row yet. A human ADMIN must separately
-- verify and choose 1st/2nd (the purple badge alone cannot determine it).
--
-- The function runs all local record updates in ONE PostgreSQL transaction,
-- including the existing auto-own-medal identity trigger. Failure rolls back
-- CA record, link, role, membership, identity, claim and medal together.
-- The Edge Function MUST recheck the Campfire creator and purple CA badge
-- immediately before calling this service_role-only RPC.
--
-- Temporary CA rows are LOCAL to CA Clover. NEVER write Google Sheets.
-- On the next master sync the same normalized source_key can be taken over
-- by the official master row. The integrated CA-master protections
-- in PR #121/#127 must be deployed before this workflow is enabled.

create or replace function public.internal_approve_unlisted_ca_claim(
  p_request_id uuid,
  p_admin_user_id uuid,
  p_confirmed_ca_level text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.community_access_requests%rowtype;
  v_profile public.profiles%rowtype;
  v_ca public.ca_members%rowtype;
  v_identity text;
  v_existing_primary_count integer;
  v_other_owner_count integer;
begin
  if p_confirmed_ca_level not in ('1st','2nd') or p_confirmed_ca_level is null then
    raise exception 'Admin must confirm 1st or 2nd CA level'
      using errcode='22023';
  end if;

  if not exists (
    select 1 from public.profiles p
     where p.id=p_admin_user_id and p.role='admin'
  ) then
    raise exception 'admin required' using errcode='42501';
  end if;

  select * into v_request from public.community_access_requests r
   where r.id=p_request_id for update;
  if not found then
    raise exception 'request not found' using errcode='P0002';
  end if;

  if v_request.status <> 'pending'
      or v_request.request_source <> 'meetup_share'
      or v_request.ca_map_status <> 'not_listed'
      or v_request.creator_ca_badge_verified is distinct from true
      or v_request.creator_username_matches_profile is distinct from true
      or v_request.is_ca_meetup is distinct from true
      or v_request.campfire_meetup_id is null then
    raise exception 'fallback claim is not eligible' using errcode='42501';
  end if;

  select * into v_profile from public.profiles p
   where p.id=v_request.user_id for update;
  if not found or v_profile.role not in ('pending','ca') then
    raise exception 'requester profile is not eligible' using errcode='42501';
  end if;

  v_identity:=lower(regexp_replace(btrim(coalesce(v_profile.niantic_id,'')),'^@+',''));
  if v_identity=''
      or v_identity is distinct from
         lower(regexp_replace(btrim(coalesce(v_request.niantic_id_snapshot,'')),'^@+',''))
      or v_identity is distinct from
         lower(regexp_replace(btrim(coalesce(v_request.creator_username,'')),'^@+','')) then
    raise exception 'requester identity changed' using errcode='42501';
  end if;

  -- Take a row lock if this candidate has now appeared in the master.
  select * into v_ca from public.ca_members ca
   where ca.source_key=v_identity for update;
  if found then
    if v_ca.status<>'active' or v_ca.ca_level<>p_confirmed_ca_level then
      raise exception 'existing CA master record conflicts with manual level'
        using errcode='23514';
    end if;
  else
    insert into public.ca_members
      (source_key,trainer_name,ca_level,prefecture,status)
    select v_identity,
           regexp_replace(btrim(coalesce(v_profile.niantic_id,'')),'^@+',''),
           p_confirmed_ca_level,
           c.prefecture,
           'active'
      from public.communities c where c.id=v_request.community_id
    returning * into v_ca;
    if not found then
      raise exception 'Community not found' using errcode='23503';
    end if;
  end if;

  -- Never displace another account or a different primary CA identity.
  select count(*) into v_existing_primary_count
    from public.user_ca_identities i
   where i.user_id=v_request.user_id and i.is_primary
     and (i.ca_member_id<>v_ca.id or i.community_id<>v_request.community_id);
  if v_existing_primary_count>0 then
    raise exception 'primary identity conflict' using errcode='23505';
  end if;

  select count(*) into v_other_owner_count
    from public.user_ca_identities i
   where i.ca_member_id=v_ca.id and i.community_id=v_request.community_id
     and i.user_id<>v_request.user_id;
  if v_other_owner_count>0 then
    raise exception 'CA identity already owned by another account'
      using errcode='23505';
  end if;

  insert into public.community_ca_members (community_id,ca_member_id)
  values (v_request.community_id,v_ca.id)
  on conflict (community_id,ca_member_id) do nothing;

  if v_profile.role='pending' then
    update public.profiles set role='ca' where id=v_request.user_id;
  end if;

  insert into public.community_memberships (user_id,community_id)
  values (v_request.user_id,v_request.community_id)
  on conflict (user_id,community_id) do nothing;

  -- Existing trigger stamp_auto_own_medal_after_identity inserts the user's
  -- own medal once. The unique stamp collection key makes retries safe.
  insert into public.user_ca_identities (
    user_id,ca_member_id,community_id,is_primary,
    verification_source,verified_at,verified_by
  ) values (
    v_request.user_id,v_ca.id,v_request.community_id,true,
    'campfire_unlisted_admin_verified',now(),p_admin_user_id
  )
  on conflict (user_id,ca_member_id,community_id) do update
     set is_primary=true,
         verification_source=excluded.verification_source,
         verified_at=excluded.verified_at,
         verified_by=excluded.verified_by;

  -- Do not report success if the expected own medal is missing.
  -- stamp_auto_own_medal_after_identity should have inserted this row in
  -- the same transaction. A misconfigured trigger must roll everything back.
  if not exists (
    select 1 from public.stamp_collections sc
     where sc.owner_user_id=v_request.user_id
       and sc.stamp_ca_member_id=v_ca.id
       and sc.community_id=v_request.community_id
  ) then
    raise exception 'own medal was not granted; approval rolled back'
      using errcode='P0001';
  end if;

  update public.community_access_requests
     set status='approved',reviewed_at=now(),reviewed_by=p_admin_user_id
   where id=v_request.id;

  return jsonb_build_object(
    'ok',true,'status','approved',
    'accountRole','ca',
    'communityId',v_request.community_id,
    'caMemberId',v_ca.id,
    'ownMedalStatus','verified'
  );
end;
$$;

revoke all on function public.internal_approve_unlisted_ca_claim(uuid,uuid,text)
  from public, anon, authenticated;
grant execute on function public.internal_approve_unlisted_ca_claim(uuid,uuid,text)
  to service_role;

-- Read-only verification after approved migration:
-- select has_function_privilege('anon',
--  'public.internal_approve_unlisted_ca_claim(uuid,uuid,text)','EXECUTE') anon_exec,
-- has_function_privilege('authenticated',
--  'public.internal_approve_unlisted_ca_claim(uuid,uuid,text)','EXECUTE') user_exec,
-- has_function_privilege('service_role',
--  'public.internal_approve_unlisted_ca_claim(uuid,uuid,text)','EXECUTE') service_exec;
-- Expected: false, false, true.
--
-- Staging QA:
-- 1. Purple-badge CA, but no 1st/2nd confirmation: reject without writes.
-- 2. ADMIN-confirmed 1st or 2nd: role, membership, CA, link,
--    primary identity, self medal and claim status committed together.
-- 3. Force a stamp insert failure: entire transaction rolls back.
-- 4. Concurrent submissions of the same CA identity: only one owner.
-- 5. The president's medal is NEVER granted to newly registered CAs.
-- 6. Later master import of same source_key keeps CA id, identity,
--    owned medals and QR exchange valid (requires PR #117).
-- 7. Rejected claims and non-CAs cannot call the RPC.
-- 8. Confirm ALL pre-release identities and medals are unchanged by ID,
--    not just row counts (read-only baseline currently 6 identities / 13 medals).
--
-- Rollback must be planned before production. Do not drop local CA rows
-- or owned stamp records when disabling the feature.
