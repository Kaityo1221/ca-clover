# CA Clover Phase C | Source baseline / deployment gate (REVIEW ONLY)

**Current status: Draft PR #130. Production GO = STOP.**  
No production SQL, Edge deploy, Cron edit, release merge or emergency sentinel change is approved here.

## 1. Explicitly verified baseline (required)

The protected `sync-ca-master` now rejects any write unless the *latest* `sync_runs` entry with `source='ca-master-verified-baseline'` and `status='success'` contains:

- `details.manually_verified = true`
- `details.source_rows`: positive integer, counted from the **actual inspected** CA master CSV excluding header
- `details.unique_ca_members`: positive integer, distinct validated CA source keys

This record is **not created automatically**. Normal `ca_members_map` success/partial rows must never be mistaken for an operator-verified source baseline.

**Operator prerequisite (future, separately approved):** compare real current CSV to the restored non-production database; investigate all missing and renamed CA/Community records, and explicitly document the current counts before attesting a baseline. The expected baseline must not be guessed from older summaries (e.g. approximate CA totals). The human approval/audit workflow remains a release blocker. Do not add or update the baseline in production under this PR.

Preflight stops if a baseline is missing or malformed, if parsed source rows or unique CA keys drop by more than 10% from the reviewed count, or if source rows more than double. These are *initial conservative review thresholds*, not an automatic deletion policy.

## 2. Unknown status, missing fields

If a source status is empty/unrecognized, the previous `active`/`inactive` DB status is retained. For an unrecognized new CA the initial status is `inactive`; it must not auto-grant an active CA identity. Malformed/omitted data rows fail before writes. Missing or invalid coordinates are ignored rather than clearing stored coordinates. Empty Community URLs are not written over good URLs.

## 3. Assignment/Medal preservation

All current community-to-CA links for managed CAs must be represented in the desired link plan; any missing/stale link causes a **pre-write rejection** and dedicated master pause. The reviewed `internal_reconcile_ca_master_links` RPC independently enforces additive-only link changes in one DB transaction. **No automatic link deletions, even when the link is not referenced by a verified Identity.**

Identity, primary assignment, medals, exchanges and reunions are not managed by this sync. These records must be compared unchanged after any isolated rehearsal.

## 4. Emergency stop and access paths

- The 2099 sentinel continues to block the main writer, even if the proposed dedicated gate were mistakenly enabled. Its removal requires separate user authorization.
- `/api/sync/ca-master` (Next.js) always returns HTTP 410.
- `sync-ca-master-coordinates` always returns HTTP 410.
- Regular `sync-ca-master` is the only intended writer (behind dedicated gate + lease + CSV preflight + confirmed baseline).
- The direct Edge endpoint and ADMIN gateway require authorization. The 15-minute Campfire auto-sync must continue independently of the dedicated CA-master stop.
- The source baseline check and REST multi-write sequence do **not** make CA master fully atomic. A network interruption after earlier metadata writes requires dedicated pause, auditing and manual repair before retry.

## 5. QA and STOP requirements

- Test HTTP 410 for both retired endpoints, including direct requests with valid credentials, in disposable deployment only.
- Exercise baseline absent, missing count, 90% threshold, malformed CSV, status missing, duplicate CA, Community reassignment, old link without Identity, and null-coordinate tests.
- Test direct/main ADMIN/Cron gate, race between gate check and REST writes, and failure injection against a fully restored **isolated** schema including composite FK `ON DELETE RESTRICT`, RLS and actual review RPCs.
- Existing synthetic GitHub CI PASS is necessary but never sufficient for production release.
- Preserve backups, SHA256 proof and existing source versions; do not execute any SQL snippet in this document in production.
- Never restore old `DELETE ... community_ca_members` or re-enable the retired writers without a separate audited plan.

**No merge or deployment before explicit approval.**
