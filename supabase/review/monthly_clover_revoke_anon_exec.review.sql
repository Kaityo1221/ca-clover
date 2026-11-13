-- REVIEW ONLY. This file is NOT a Supabase migration and is NOT deployed.
-- CA Clover: remove anonymous EXECUTE from the monthly clover refresh RPC.
-- Approval and a CLI-generated migration are required before production use.
--
-- Verified precondition (2026-10-10):
-- function public.refresh_monthly_clover_snapshot(uuid,date)
-- anon EXECUTE = true, authenticated EXECUTE = true, service_role EXECUTE = true.
-- The client at docs/clover-garden.js uses this RPC after login.
--
-- Keep authenticated users and service_role unchanged. No function-body
-- alteration, snapshot deletion, ownership changes or RLS changes.

revoke execute on function public.refresh_monthly_clover_snapshot(uuid, date)
  from anon, public;

-- For approved deployment verification (READ-ONLY query):
-- select
--   has_function_privilege('anon',
--     'public.refresh_monthly_clover_snapshot(uuid,date)', 'EXECUTE') as anon_exec,
--   has_function_privilege('authenticated',
--     'public.refresh_monthly_clover_snapshot(uuid,date)', 'EXECUTE') as authenticated_exec,
--   has_function_privilege('service_role',
--     'public.refresh_monthly_clover_snapshot(uuid,date)', 'EXECUTE') as service_exec;
-- Expected: false / true / true.
--
-- Regression requirements:
-- - Signed-in CA can retrieve and refresh own Community archived months.
-- - Non-member CA receives community_access_denied for other Communities.
-- - Anonymous API call cannot EXECUTE (permission denied).
-- - 3/6/12-month selector, Clover Garden and "今月のクローバー" stay intact.
-- - Existing monthly_clover_snapshots rows remain unchanged.
--
-- Rollback plan (requires explicit approval):
-- grant execute on function public.refresh_monthly_clover_snapshot(uuid,date)
--   to anon;
