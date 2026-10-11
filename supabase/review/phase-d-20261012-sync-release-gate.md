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

## Phase D final release decision matrix — 2026-10-12 (STEP 5)

**Decision: NO-GO for CA-master sync, production schema/Edge release, and full disaster-recovery certification.** The operator's isolated fault lab is PASS only within its recorded scope. This is a documentation gate, not deployment authorization.

| Gate | Evidence/status | Required to promote | Decision |
| --- | --- | --- | --- |
| Original backup and encrypted archive custody | PASS (prior operator audit; private retained) | Preserve checksum manifest and access control | PASS / retain |
| Restored local DB/Auth/Storage metadata and FK integrity | PASS (scope-specific; 98 FKs in main restored DB; 24 FKs in 15-table disposable lab) | Maintain reports and distinguish these separate counts | PASS / limited |
| Content fidelity | REVIEW (14/15 table comparisons exact; two coordinate records with 3 floating differences, max 3.41060513164848e-13 degrees) | Approve tolerance and document non-byte-identical exception | REVIEW |
| Isolated CASCADE hazard and FK protection negative test | PASS in disposable lab (Identity 6→5 with CASCADE; deletion blocked under NO ACTION; both ROLLBACK) | Choose exact NO ACTION vs RESTRICT migration; prove on production-like disposable clone and test concurrent/rollback paths | PASS / local only |
| Dedicated CA-master pause/lease and source preflight | Synthetic/code review PASS, restored-data E2E NOT TESTED | Prove direct/admin/auto endpoints fail closed, emergency sentinel and dedicated gate independent, other tasks unaffected | BLOCKED |
| Master source cross-check | REVIEW_REQUIRED_SYNC_STOP (200 CA keys match; mappings do not) | Human adjudication of row 7,13,17,34,60,94,100,116 and all grouped conflicts; signed baseline and source snapshot | BLOCKED |
| Identity/medal/exchange full-content invariants after real workflow failure | Limited local FK test PASS; master sync failure E2E NOT TESTED | Isolated end-to-end injection with private canonical hashes, no data exported | BLOCKED |
| OAuth, secrets restoration, active Edge/Cron/notifications, image decode 3 unresolved | NOT TESTED / REVIEW | Secure isolated E2E and investigation; do not use production credentials in public CI | BLOCKED |
| Combined release build and branch review | Draft PR #130/#131, no merge | Review branch divergence, merge conflicts and production source parity; fresh CI after review updates | BLOCKED |
| Production FK and gate apply | NOT APPLIED | Explicit separate approval, versioned migration, preflight snapshots, rollback rehearsal | STOP |
| First limited master sync | NOT PERFORMED | Separate explicit approval **after** all prerequisites and source reconciliation | STOP |
| 2099 emergency pause removal / automatic sync resume | NOT AUTHORIZED | Separate explicit approval only after controlled sync and invariants pass | STOP |

### Mandatory release order and rollback/stop criteria

1. Keep the 2099 sentinel and dedicated gate OFF. Do not run legacy or manual CA-master sync, edit production SQL/Edge/Cron, or merge PRs.
2. Resolve source discrepancies privately and record each human decision with dated evidence. Re-run deterministic per-pair comparisons; require zero unexplained reassignment/deletion and explicitly attested baseline. No auto-fix.
3. In *disposable*, production-like environment, verify exact FK migration semantics and every direct/admin/auto master entry point. Exercise missing gate, false gate, future sentinel, invalid source, concurrent requests, failure after intermediate REST writes, idempotent retry and unrelated automation continuity. Retain redacted logs and content fingerprints.
4. Verify application recovery beyond DB: OAuth, secrets provisioning process, Edge invocations, RLS, Cron, Storage objects, image decoding, notifications and related UI. Verify source parity with deployed version separately.
5. Obtain human review of full release artifacts, rollback procedures, CI and branch divergence; **do not merge just because CI is green**.
6. Seek separate approvals for (A) production schema/Edge protection, (B) controlled first CA-master sync, (C) 2099 stop release and automation resume. Approval for one does not imply the others.
7. At any error, missing expected FK/gate, unexpected Identity/primary/medal/exchange changes, source inconsistency or degraded unrelated automation: **STOP, preserve forensic evidence, keep master paused**. Transaction failures use rollback; post-commit issues require a separately approved recovery procedure, not an automatic reversion to CASCADE.

**Release verdict variables**

```text
STEP_5_DOCUMENTATION_GATE=COMPLETE
LOCAL_ISOLATED_FAULT_LAB=PASS_LIMITED
CA_MASTER_SOURCE=REVIEW_REQUIRED_SYNC_STOP
PROTECTED_SYNC_REAL_DATA_E2E=NOT_TESTED
FULL_APPLICATION_RECOVERY=NOT_TESTED
PRODUCTION_FK_PROTECTION=NOT_APPLIED
PRODUCTION_SYNC=STOP
PHASE_D_RELEASE=NO_GO
```

## 2026-10-12 follow-up: draft-branch-only QA assets and review queue

- Added `scripts/ci/phase-d-fk-no-action-vs-restrict-postgres.sql`: synthetic-only PostgreSQL transaction, guarded to run only against the disposable `ca_master_safety` DB over TCP, reproducing the CASCADE loss and testing both **NO ACTION NOT DEFERRABLE** and **RESTRICT** deletion blocks, followed by transaction rollback. This has **NOT** been run against the operator's restored private backup.
- Updated `.github/workflows/ca-master-safety-postgres.yml` to exercise this synthetic scenario for the Phase D branch. **The new workflow execution result is not yet independently verified; do not mark this addition PASS based solely on the file commit.**
- Added `supabase/review/phase-d-ca-master-human-review-20261012.md` with P0/P1 row-level anonymous discrepancy triage and evidence/approval requirements. All human dispositions remain pending. No CA source Sheet or DB data has been modified.
- The existing reconciliation RPC checks PostgreSQL `confdeltype='r'` (RESTRICT only). A local `NO ACTION` constraint has `confdeltype='a'` and therefore will **not** satisfy the existing RPC's guard. **Select a single consistent implementation and demonstrate it in a disposable production-like clone before production approval**; do not silently treat the two FK definitions as interchangeable.
- GitHub commit combined-status observations on follow-up commits included a `Vercel` failure pointing to a build-rate-limit/upgrade URL. This is **not** a PostgreSQL test failure and **not** proof the new QA passed. No deployment was attempted by these review actions.

**Phase D remains NO-GO. Production writes/deploys, first CA-master sync, 2099 pause removal, and PR merge remain prohibited.**

## Phase D continued CI: 2026-10-12 synthetic FK and fail-closed wiring evidence

- Linked `scripts/ci/phase-d-fk-no-action-vs-restrict-postgres.sql` into the **active** `release-candidate-db-qa.yml` synthetic PostgreSQL job. CI step **"Phase D / Reproduce CASCADE and verify NO ACTION vs RESTRICT (synthetic only)" PASS** on run **38184165738**, and integrated workflow run **38184165738** finished **success** (commit `4c4d144098dc9bac90b0595b19662ef9ac61ec84`). A later release-candidate workflow run **38184289659** also finished **success**.
- Added `scripts/test-phase-d-master-gate-contract.mjs` and wired it into regular CI. On run **38184289665**, the dedicated **"Phase D direct/admin/scheduler master-pause static contract"** step is **PASS**. This covers source-code ordering and gate isolation only; it is *not* an HTTP/Edge E2E test. Do not upgrade the overall synchronization release decision based on a static test.
- 2026-10-12 read-only reinspection of the exact 20260828 Sheet tab confirmed the five same-URL/conflicting-name groups, missing URL and coordinates on row 17, and an additional source prefecture/geography inconsistency for row 34. Details without private identity data are in `phase-d-ca-master-human-review-20261012.md`.
- **RESTRICT remains the candidate for alignment with existing reviewed reconciliation RPC** (`confdeltype='r'`); both RESTRICT and non-deferrable NO ACTION reject deleting verified links in isolated synthetic tests. A migration using either is not approved until preproduction integration and rollback review.

**Gate outcome unchanged: LOCAL_SYNTHETIC_QA=PASS (specified tests); MANUAL_SOURCE_RECONCILIATION=PENDING; RESTORED-DATA_SYNC_E2E=NOT_TESTED; PRODUCTION_SYNC=STOP; PHASE_D_RELEASE=NO_GO.**

## 2026-10-12: isolated Edge HTTP fail-closed test (mock-backed) 

Added `scripts/test-phase-d-master-edge-http-isolated.mjs` and wired it into `.github/workflows/ci.yml` on the existing Draft PR #131 branch.

**Verified PASS:** The CI step **"Phase D / isolated Edge HTTP stop gate and unrelated scheduler flow"** in GitHub Actions run **38185258444** completed successfully, using real Deno Edge entrypoints and local fake Supabase REST/Auth/Functions endpoints. The first attempt failed only because a strict network permission prevented Deno from listening on its standard `0.0.0.0:8000` port. The permission was corrected to allow the local listener while the Edge subprocess remained restricted to local mock access. No production secret or service endpoint was configured.

Negative HTTP cases exercised:
- Direct master: invalid secret 401, dedicated gate OFF 423, missing gate schema 503, 2099 future sentinel 423, refusal of writer lease 409. No CA metadata mutation.
- Admin wrapper: absent bearer 401, non-admin 403, dedicated gate OFF 423, missing gate schema 503, enabled wrapper forwarding to **local refusal stub** only. No CA metadata mutation.
- Automatic scheduler: dedicated gate OFF, flag absent, and 2099 sentinel with flag ON all skip CA master, while mock public Meetup sync, icon updates, Meetup notifications, claim notifications, and normal run accounting continue.
- **Isolation:** Deno Edge subprocess is net-restricted to loopback backend and test listener; test data, credentials and IDs are synthetic; no real Google Sheet CSV download, production Supabase URL, Docker restore DB, or real Campfire API calls.

**Limitation:** The fake PostgREST/Auth handlers return controlled data and synthetic responses. This is a **mock-backed HTTP entrypoint E2E PASS**, not a restored-real-data master sync E2E, full production-schema E2E, deployed-Edge compatibility verification, or approval to write in production. Real OAuth, Cron scheduling, historical Community reconciliation and partially committed write recovery remain separately gated.

**Gate outcome:** `ISOLATED_EDGE_HTTP_NEGATIVE_QA=PASS_MOCK_BACKEND`; `RESTORED_REAL_DATA_MASTER_SYNC_E2E=NOT_TESTED`; `CA_MASTER_SOURCE=REVIEW_REQUIRED_SYNC_STOP`; `PRODUCTION_SYNC=STOP`; `PHASE_D_RELEASE=NO_GO`.

## Step ② complete: Identity composite FK release-candidate decision (2026-10-12)

**STEP_2_DESIGN_AND_SYNTHETIC_INTEGRATION=PASS.  PRODUCTION_FK_CHANGE=NOT_APPLIED.**

**Selected contract:** `public.user_ca_identities(community_id, ca_member_id)` → `public.community_ca_members(community_id, ca_member_id)` must be a **validated, NOT DEFERRABLE, ON DELETE RESTRICT** foreign key named `user_ca_identities_community_id_ca_member_id_fkey`. PostgreSQL catalog `confdeltype='r'`. This intentionally differs from the operator's prior disposable real-backup `NO ACTION` success; `NO ACTION` protects deletion in that local trial but does **not** satisfy this reviewed reconcile RPC contract.

**Integrated and tested artifacts:**
- `supabase/review/phase-d-identity-fk-restrict.review.sql`: review-only, version-controlled candidate SQL. Requires the exact original validated composite CASCADE constraint, an intact source-key signature, no Identity orphans and the exact 2099 emergency stop; bounds DDL waits; replaces constraint and verifies action, validation, deferrability and Identity count within a transaction. This is **not** an approved Supabase migration.
- `supabase/review/ca-master-atomic-link-reconcile.review.sql`: fail-closed catalog guard strengthened to demand validated, nondeferrable, exact-key-pair RESTRICT FK, beyond merely checking its name and action.
- `scripts/ci/phase-d-identity-fk-rpc-integration.sql`: actual reviewed SQL files executed against a **new, disposable synthetic database** `ca_clover_identity_fk_qa`. Exercises direct association DELETE and parent CA/Community cascading DELETE rejection, NO ACTION and NOT VALID RESTRICT mismatch rejection, unchanged-link idempotence, stale unverified-link replacement refusal, safe-additive link reconciliation, original protected association ID preservation and canonical content fingerprints for Identity, medal and exchange-session fixtures.
- `.github/workflows/release-candidate-db-qa.yml`: new isolated Step ② PostgreSQL QA step creates and then drops that disposable synthetic database.

**Verified evidence:** GitHub Actions **Release candidate / Master + Medal PostgreSQL QA run #38185724996 SUCCESS**, including `Phase D Step 2 / exact RESTRICT FK review SQL plus actual reconcile RPC` PASS (commit `37d86cd765a0e9ae128d383f981d4318cfbce721`). This is **synthetic PostgreSQL 16 CI**. The operator's **real-backup PostgreSQL 17.11 lab** previously validated NO ACTION protection; it has not run this exact RESTRICT SQL/RPC combination.

**Boundary:** Step ② is complete **as a reviewed design and disposable integrated regression test**, not as a production migration, full real-data restore E2E or permission to resume CA Master. First separately approved production migration and Edge/schema deploy belong to **step ⑤** after source review and end-to-end restored-data checks. Preserve 2099 sentinel; master source remains `REVIEW_REQUIRED_SYNC_STOP`; Phase D remains **NO-GO**.

## Step ① source review progress: historical evidence collected (2026-10-12)

**Read-only historical triangulation completed**, recorded anonymously in `supabase/review/phase-d-ca-master-human-review-20261012.md`, commit `dc31b730195894efc60b01a0e8c51cd75cf05d42`.

- Current eight P0 rows were cross-checked against June/July 2026 CA lists and April/June/August 2026 Community maps. Row 17 is a 2nd CA missing a URL and coordinates, with same prefecture/name as a pre-existing 1st CA group; row 34 has a short link **without the encoded Community ID**, and this issue has persisted across multiple historical source tabs.
- Other current P0 rows include newly added 2nd CA links whose group names match older map entries but URLs conflict, and source-vs-restored-DB aliases/overlapping URLs among distinct groups. Multiple confusing same-URL/name combinations pre-date the latest sheet and cannot be safely "fixed" merely from proximity or total counts.
- Separate P1 groups `144/159/199` and `175/198` must also be adjudicated before source preflight can PASS; resolving only eight P0 rows is insufficient.
- **No authoritative live Campfire Community-ID confirmation was obtained from group owners**. Therefore no row is recorded as approved for edit, no baseline was created, no mapping was changed, and the `REVIEW_REQUIRED_SYNC_STOP` gate remains active.
- Next safe action: individual owners confirm live Campfire share URL + Community name/prefecture and 1st/2nd assignment; adjudicate privately, then rerun read-only source-to-restored-DB pair comparison and obtain explicit operator sign-off.

**Decision:** `HISTORICAL_SOURCE_TRIAGE=PASS`; `OWNER_CONFIRMATION=PENDING`; `SOURCE_RECONCILIATION=REVIEW_REQUIRED_SYNC_STOP`; `PRODUCTION_MASTER_SYNC=STOP`; `PHASE_D=NO_GO`.
