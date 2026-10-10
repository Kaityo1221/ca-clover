-- REVIEW-ONLY SQL. This file is NOT a migration and is NOT automatically deployed.
-- When approved, generate a versioned migration using the Supabase CLI.
-- Deployment ORDER: (1) DB triggers; (2) verify with isolated test account;
-- (3) deploy admin-manage Edge Function; (4) publish docs/admin.html.
-- Do not run against production without the owner's explicit approval.
--
-- Invariants:
--   - Moving profiles.role to pending revokes all community memberships.
--   - A pending profile can never acquire a new community membership.
--   - Role transition + revocation are one Postgres transaction.
--   - CA identity, medal collections, reunions and event history are untouched.

create or replace function private.revoke_community_memberships_on_pending()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  delete from public.community_memberships
   where user_id = new.id;
  return new;
end;
$$;

revoke all on function private.revoke_community_memberships_on_pending()
  from public, anon, authenticated;

drop trigger if exists revoke_community_memberships_on_pending on public.profiles;
create trigger revoke_community_memberships_on_pending
after update of role on public.profiles
for each row
when (old.role is distinct from new.role and new.role = 'pending')
execute function private.revoke_community_memberships_on_pending();

-- Lock the owning profile row to serialize membership writes with role changes.
-- Either an INSERT completes before the demotion and is deleted in that same
-- demotion transaction, or it sees pending and is rejected. No stale grants.
create or replace function private.require_approved_ca_for_membership()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_role public.app_role;
begin
  if new.user_id is null then
    raise exception 'community membership user_id required'
      using errcode = '23502';
  end if;

  select p.role into v_role
    from public.profiles p
   where p.id = new.user_id
   for update;

  if not found then
    raise exception 'community membership profile not found'
      using errcode = '23503';
  end if;

  if v_role not in ('ca', 'admin') then
    raise exception 'community membership requires CA approval'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function private.require_approved_ca_for_membership()
  from public, anon, authenticated;

drop trigger if exists require_approved_ca_for_membership on public.community_memberships;
create trigger require_approved_ca_for_membership
before insert or update on public.community_memberships
for each row
execute function private.require_approved_ca_for_membership();

-- REVIEW-ONLY, read-only deployment verification queries:
--
-- select tgname, pg_get_triggerdef(oid)
--   from pg_trigger
--  where tgrelid in ('public.profiles'::regclass,
--                   'public.community_memberships'::regclass)
--    and not tgisinternal
--  order by tgname;
--
-- select count(*) as pending_with_membership
--   from public.community_memberships m
--   join public.profiles p on p.id = m.user_id
--  where p.role = 'pending';
--
-- Staging QA: use disposable CA fixtures; no production account demotions.
-- Verify pending cannot be assigned, an approved CA can, and downgrading
-- CA/ADMIN to pending removes memberships while preserving owned medals.
-- Test forced rollback and concurrent assignment/demotion in staging.
--
-- Rollback for *triggers only* (do not run on production without approval):
-- drop trigger if exists require_approved_ca_for_membership
--   on public.community_memberships;
-- drop trigger if exists revoke_community_memberships_on_pending
--   on public.profiles;
-- drop function if exists private.require_approved_ca_for_membership();
-- drop function if exists private.revoke_community_memberships_on_pending();
