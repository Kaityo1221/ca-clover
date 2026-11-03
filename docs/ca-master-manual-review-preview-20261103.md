# CA master manual review integration (2026-11-03)

## Decision implemented on preview branch
- Source of truth: original `[APAC] CA in Japan`, sheet `[new]CA List 20260828` (gid `633821294`).
- Immutable point-in-time backup: `[BACKUP 2026-11-03] APAC CA in Japan - 全タブ原本保全`, copied privately to Google Drive, 40/40 tabs verified.
- New ADMIN menu item `/admin/ca-master` and preview-only POST `/api/admin/ca-master/check`.
- Dashboard reads registered/active counts from the current CA master database. **Manual click only** fetches the fixed authoritative source CSV and computes differences.
- Compare full normalized source keys to `public.ca_members.source_key`. Display new candidates, changes, and items missing from source separately. Do not classify missing rows as retirement automatically.
- Source parser requires header schema, limits row count and response size, detects duplicate/invalid/incomplete rows, and preserves raw status metadata.
- Guard: verified Supabase Google session + `profiles.role=admin`, same-origin POST, fixed spreadsheet ID and gid, no arbitrary URLs or request payload, no writable database API, preview branch only.
- **ALL writes disabled**: no ca_members upsert, no Community mutations, no existing identity/medal/Meetup changes, no automatic CA role grant. No scheduled imports or cron.
- Legacy production Edge sync remains *paused and retired*, production `ca_master_sync_enabled=false`. DO NOT switch ON the old writer.

## Read-only comparisons on 2026-11-03
- Google sheet has 203 nonempty trainer names; DB has 200 CA master records.
- Four names in sheet missing from DB: `Gousanch`, `Kpro515029`, `Yubeetle`, `Jackson5103`.
- One existing DB record missing from sheet: `heysuketabito`.
- Note: `Gousanch` source status is Inactive, so source-only is NOT an automatic-add decision.

## Test outcomes
- Pure source-diff mock: source parser and required headers, source duplicate rejection, truncation rejection, missing/new/modified comparison PASS.
- API authentication mock: no token 401, cross-origin 403, invalid session 401; unauthenticated request never fetches source, 3/3 PASS.
- Vercel preview build success.
- NOT TESTED: authenticated end-to-end fetching of original Google CSV through the deployed Vercel function (source access may require credentials); protected real CA addition on test Neon; full existing-Clover production regression. UI must show explicit errors if source unavailable.

## Follow-on before production / C-plan writes
- Implement verified, immutable candidate snapshots and reviewed source provenance in isolated Neon.
- Auto-add **only confirmed new active CA master rows** with exact identity/Community matching, unique/upsert-safe transactional writer; do not infer active from ambiguous status.
- Existing CA updates, identity ownership, Community changes, inactive/deletion always manual admin review.
- Verify per-CA new-user registration and role approval separately, including current Discord and Google account checks, without granting rights from a roster diff.
- Run genuine source access end-to-end in preview; strengthen historical and recovery tests; explicit GO decision after safety audit.

**Production NO-GO remains. This feature is read-only preview UI, not production-activated C-plan synchronization.**
