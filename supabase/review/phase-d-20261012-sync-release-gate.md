# Phase D: isolated restore audit and sync release gate (2026-10-12 JST)

> STATUS: RESTORE INTEGRITY PASS; MASTER SYNC NOT READY. Production change STOP.
> Evidence is from operator's local Windows Docker restore; this file does not certify application disaster recovery.

## Confirmed local-only evidence
- Local container: `supabase_db_CA-Clover-Restore-Test`; transaction READ ONLY, local Unix socket guard verified.
- Restore audit: 12/12 integrity and counts PASS. Auth users 6; Google identities 6; CA identities 6; medal designs 13; medals 13; storage metadata 418; foreign keys 98. No orphan CA identities, duplicate primary users, unvalidated foreign keys, or missing own medals in the audited baseline.
- Independent backup checks from earlier audit: 484 SHA256 source files matched, 418 storage SHA256 objects matched; 415 images decoded, 3 unresolved.
- Master CSV tab `[new]CA List 20260828`, gid `633821294`: 200 unique CA keys, 155 resolved unique Community IDs, 198 resolved CA-ID pairs, unresolved ID rows 17 and 34.
- Restored DB: 200 CA keys, 155 current Community IDs, 196 current CA links, 157 historical ID records (155 active, 2 retired).
- Pair comparison: sheet_ca_missing_in_db=0; db_ca_missing_in_sheet=0; sheet_ids_not_mapped_in_db=1; sheet_pairs_not_mapped_to_db_links=5; db_current_pairs_not_in_sheet=4; result=REVIEW_REQUIRED_SYNC_STOP.
- Difference row IDs (sheet row numbers only): missing CSV pair 7,13,60,94,116; DB-only current pair maps to 94,100,60,116. One missing Community ID shared by rows 60 and 116.
- CSV same Campfire URL but different normalized Community name: 7/115, 60/116, 94/177, 144/159/199, 175/198. Only 175/198 also differ in region.
- Restored DB history: row 13 retired (campfire-public-map), row 100 retired (backfill-current); row 7 active (ca-master-new), row 94 active (manual-hokkaido-repair); rows 60 and 116 absent from both current and historical ID sets.
- Row 7 and 13 CA current link counts 0; row 60,94,100,116 each have one different current link; row 100 CSV ID maps to an alias link for that CA.
- CA identity composite FK remains ON DELETE CASCADE and dedicated `ca_master_sync_enabled` gate not applied. Approved baseline count is 0.

## Interpretation limits
- Matching 200 CA keys is not evidence of correct Community assignments.
- Retired means the local DB's history label, not verified Campfire status.
- Different Community names under one URL do not automatically prove bad data; renamed groups and per-CA descriptions require review.
- Do not create/delete/merge CA or Community rows, rename IDs, or automatically repair links from these findings.
- All 6 identified problem rows require manual disposition, plus unresolved-ID rows 17 and 34 and remaining URL/name conflicts.

## Failure-injection coverage: verified synthetic GitHub QA vs remaining isolated E2E

GitHub Actions on commit `34cf949bc0adebba338166c49d2608fb4ea6f664` completed successfully: CI run `38178471050`, PostgreSQL QA run `38178471073`. Confirmed passing steps include `test-ca-master-failure-injection.mjs`, `ca-master-atomic-rpc-postgres.sql`, `ca-master-multi-transaction-recovery-postgres.sql`, `ca-master-safety-postgres.sql`, RLS regression fixture, retired-HTTP-410 smoke, and synthetic restore-audit fixture. These use synthetic data, *not* the restored Windows backup.

**Verified in synthetic tests:** lease exclusivity, lease owner fencing, stale-lease stop, rejected unsafe CASCADE in actual review RPC, verified Identity and medal surviving link-reconcile failures, all-or-nothing RPC insertion on injected FK failure, preflight/failure pause logic, split REST transaction partial failure with master-only pause, and general Cron toggle independence. No production endpoints or credentials were used.

**Not established:** full restored-schema failure-injection in a disposable clone, content-fingerprint equality for all medals/exchanges/memberships, direct main/admin/Cron gate integration, Google OAuth + actual secrets, scheduled job/notification flow, and full app recovery. Existing fixture `ca-master-safety-postgres.sql` does delete an unverified link as a deliberately isolated FK demonstration; do not misconstrue this as permission for the sync: the Phase C actual reconcile RPC refuses automatic deletion of *any* stale link.

## Remaining isolated failure-injection test matrix (NOT YET FULLY EXECUTED)
1. Abort after reading CSV and before writes: no table changes or side effects.
2. Abort after CA upsert but before Community mapping: transaction rollback or safe resumability, no loss of existing CA links.
3. Abort between Community staging and link resolution: preserve previous current and historical IDs.
4. Simultaneous two sync requests: exclusive guard permits at most one writer; other request returns safe conflict/no-op.
5. Invalid CSV, missing columns, 0 rows, missing IDs, changed status tokens, large count drop: refuse synchronization without mutation.
6. Force exceptions during linked-record processing: CA identities, profiles, medals, medal designs, exchanges and membership rows unchanged (counts AND canonical content fingerprints).
7. Attempt to delete a CA with attached identity under isolated fixture: synchronization code must never issue delete, even if legacy FK cascade would permit it.
8. Retry the same approved fixture twice: second pass idempotent; audit counts and hashes stable.
9. Test emergency 2099 pause and dedicated gate independently: both must prevent writes. Never lift actual production pause.
10. Verify public Campfire refresh and unrelated icon/notification processing remain unaffected in isolated harness.

For each test retain before/after counts, deterministic row/hash checks, exit status, run timestamp, and redacted evidence. Never use real credentials or production endpoints.

## Release and rollback approval gates (NOT COMPLETED)
- Complete and pass all injected failure tests against isolated fixtures, not the user's production records.
- Verify Google OAuth, secrets restoration process, Edge Functions invocation, RLS, Cron and notifications in a secure isolated environment.
- Resolve the five sheet-to-DB pair mismatches; record approved CA master source snapshot and baseline count, distinguish renamed and retired IDs.
- Confirm identity FK protection and dedicated sync gate are installed in a preproduction clone and verified with negative tests.
- Produce reviewed versioned SQL/Edge artifacts plus a reversible migration and tested rollback.
- Preserve immutable original backup and separate encrypted archive, provide SHA256 manifest and point-in-time restoration plan.
- Explicit approval separately required for (a) production changes, (b) first limited sync and (c) removal of 2099 emergency pause.
- No merge to pages, production SQL, Edge deploy, Cron adjustment, legacy sync invocation, or backup deletion under current authorization.

## Current verdict
RESTORE_DB_AUTH_STORAGE_INTEGRITY=PASS
FULL_APPLICATION_RECOVERY=NOT_TESTED
MASTER_SYNC_PREFLIGHT=REVIEW_REQUIRED_SYNC_STOP
PRODUCTION_APPLY=STOP

## 2026-10-12 independent real-backup fault-lab addendum (operator-reported evidence)

**Scope:** isolated offline Docker `ca-clover-fault-lab`, database `ca_clover_fault_lab_v2`, PostgreSQL 17.11, network=none, Unix socket only. This is evidence reported from the operator's completed local run, **not an execution by CI or GitHub**. Original restore database, original backup and encrypted v4 archive were left untouched.

- Fifteen restored tables: auth users=6, profiles=6, CA=200, communities=155, CA links=196, memberships=6, icon versions=150, CA identities=6, medals=13, medal designs=13, exchange sessions=19, exchange transactions=0, reunions=0.
- 24 relevant FKs in the isolated subset; 0 unvalidated; 0 orphan CA identities; 0 orphan medals.
- Content comparison: 14 of 15 tables exact. In `public.communities`, 2 records showed 3 latitude/longitude floating-point differences; maximum absolute difference `3.41060513164848e-13` degrees, below tolerance `1e-9` degrees. **Not byte-identical**; this is a bounded semantic comparison only.
- Existing composite FK `user_ca_identities_community_id_ca_member_id_fkey` used `ON DELETE CASCADE`. Deleting an identity-linked CA association in the disposable lab resulted in **CA Identity count 6 → 5**. Transaction **ROLLBACK** followed.
- In a separate lab transaction, switching the composite FK to **ON DELETE NO ACTION** blocked the same deletion: `PROTECTION_PASS: Identity-linked deletion blocked`. **ROLLBACK** restored the original schema.
- Final verification: Identity=6, CA links=196, medals=13, designs=13, exchange sessions=19. Operator output `STEP_22_23_LOCAL_PASS`. No production protection was installed.

### Proposed production-protection change: review plan, NOT authorized

1. Freeze only CA-master writes using both the dedicated fail-closed gate (initial `false`) and the existing 2099 emergency sentinel. Do **not** disable general Campfire automation.
2. In a disposable preproduction schema matching production, inventory FK columns, dependent constraints, grants, concurrent operations and existing orphan counts; rehearse a versioned transaction that replaces only the identity-linked composite FK's `ON DELETE CASCADE` with `ON DELETE NO ACTION` (or `RESTRICT` after documented semantics review). The local successful test specifically used `NO ACTION`; the earlier draft proposal uses `RESTRICT`, so do not call these an identical tested migration.
3. Test existing Identity, medals and exchanges; deletion of an identity-linked association must error, unrelated approved operations must succeed, and all relevant data fingerprints remain unchanged after rejected operations.
4. Establish bounded lock/maintenance controls, pre-change private snapshots and transaction-level verification. On migration failure, **ROLLBACK** and leave both CA-master stops active. Do not automatically restore `CASCADE` merely to permit deletion. Document a separate, approved recovery plan for a failed *post-commit* deployment.
5. Production migration, Edge rollout, first limited CA-master sync and 2099 release each require **separate explicit approvals**. No authorization is inferred from this local PASS.

### Dedicated stop gate: review of repository implementation, not deployed verification

- Draft `sync-ca-master/index.ts` checks `ca_master_sync_enabled`, the 2099 sentinel and an exclusive lease before its metadata writes; source, link-change and approved-baseline preflights can reject writes. The master path rechecks the gate after CSV retrieval. The code notes that some metadata operations use separate REST transactions and failure recovery is therefore safety-critical.
- Draft dedicated-gate design covers the direct master endpoint, admin wrapper and `sync-campfire-auto` so only the CA-master path is paused. A missing flag/query failure must fail closed.
- Synthetic GitHub CI covers portions of the preflight, lease, rejected link deletion and pause behavior. **Restored-real-data sync invocation, current production deployment equivalence, in-flight disable semantics and full end-to-end preservation of unrelated Campfire/icon/notification flows remain unverified.** Do not mark sync gate PASS in production.

### CA-master review queue (anonymous Sheet row numbers only)

- **High priority link mismatch:** rows **7, 13, 60, 94, 100, 116**. Sheet-only pairs: **7,13,60,94,116**; DB-only current pairs mapped to **94,100,60,116**. For each, a reviewer must decide whether the association is active, an approved alias/rename, retired, or erroneous, and record evidence and a proposed non-destructive disposition. Rows 60/116 share one unresolved mapping in DB; rows 13/100 have history marked retired, which alone is not proof of current Campfire status.
- **Missing / unparseable Campfire ID:** rows **17,34**. Resolve through authoritative source or leave blocked; never fabricate an ID.
- **Same URL, conflicting source community identity:** **7/115, 60/116, 94/177, 144/159/199, 175/198** (the last pair also differs in region). Review names, prefectures and historical aliases without automated rewriting.
- **Same prefecture/name across IDs:** **13/175, 17/128, 29/94**. Establish whether rename, duplicate or migration using human review.
- All 200 normalized CA keys agree; that does **not** attest 198 Sheet associations against 196 DB associations. Approved baseline still 0; classification remains `REVIEW_REQUIRED_SYNC_STOP`.
- Resolution worksheet should record: Sheet row ID, discrepancy category, authoritative evidence/date, existing vs proposed mapping (in private storage only), human approver and decision. Never put CA names, UUIDs, private URLs or raw backup content in the public PR.

**Updated status:** independent local fault-lab **PASS** (limited scope); FK protection effectiveness **PASS in disposable lab only**; dedicated sync-gate **CODE REVIEW / synthetic tests only**; source discrepancies **REVIEW**; production apply and master sync **STOP**.
