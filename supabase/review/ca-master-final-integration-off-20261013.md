# CA master protection integration: staged, OFF (2026-10-13)

## Objective
Resume the owner's *earlier CA-master safety program* before
public/private repository separation. The current Supabase production
must keep its dedicated master gate OFF, 2099 sentinel, Identity FK
ON DELETE RESTRICT, and permanently retired unsafe writers.

## Baseline / provenance
- Public `pages` base: `cfd648c43e4cd239ac006ce385f00b0fb4d38cff`
  (merged minimal safety PR #137).
- Vercel `main`: merged legacy Next route retirement PR #138.
- Pending stacked source branches: #119 > #120 > #121 > #127 > #128
  > #130 > #131. **Do not merge them directly into pages**.
- New integrated branch starts from `pages` and stages ONLY pure
  `ca-master-source-preflight.mjs` and `ca-master-recovery.mjs`
  from Phase D #131, plus an offline no-write contract test.
- The currently deployed `sync-ca-master`,
  `sync-ca-master-coordinates`, `sync-ca-master-admin`, scheduler,
  2099 migration and UI are **byte-for-byte unchanged**.
- These pure functions are intentionally **NOT imported** by the current
  retired Edge entrypoints. Adding helpers does NOT enable synchronization.

## Mandatory compatibility checks
1. Keep `isLegacyMasterWriterRetired() === true` at both old writers.
   Both must abort before the CA master sheet fetch or any mutation.
2. Keep the 2099 emergency sentinel as an *independent* stop, even
   when the dedicated gate exists. Never change gate OFF on production.
3. Preserve public Campfire events/icons/meetups by leaving other auto
   scheduler branches untouched.
4. Preserve validated `user_ca_identities` composite FK RESTRICT.
5. No unreviewed CA/Community deletion, move, overwrite, or status
   activation. Do not infer a verified baseline from prior sync rows.
6. Reject malformed CSV, unresolved communities, duplicate CA
   contradictions, unexpected count shrink/spike before *any* writes.
7. On interrupted write, stop only CA-master; keep operator audit and
   lease locked until confirmed safe.
8. Integrate the PR #128 medal/unlisted Community features separately,
   preserving Identity, medals and exchange_sessions.
9. Run synthetic Postgres and isolated Edge HTTP tests. Separately
   complete actual backed-up local restore/replay and production
   read-only baseline comparison. CI PASS is **not** production GO.
10. Freeze privatization PR #139/#140 until this protection program
    is complete and all new source is copied to the private repo.

## Status & limitations
**STAGED ONLY. No production or active Edge Function changes.**
Later implementation must reconcile PR #131's write-capable master
handler with the production hard-retirement. Do not copy its full
`sync-ca-master/index.ts` over the retired production version.
A separate explicit authorization is mandatory for any plan that would
restore a write-capable master sync, migration, cron, Edge deployment,
public branch merge, or sentinel change.

## 2026-10-13 continuation: Phase D identity-linked FK regression

Ported exact Phase D fixture `scripts/ci/phase-d-fk-no-action-vs-restrict-postgres.sql`
from parent #131 without modifying its content. It has **fake** identities,
medals, exchanges and link records, a disposable-database/TCP guard,
and an outer `BEGIN ... ROLLBACK`. The CI job shows the CASCADE hazard and
requires both NO ACTION and RESTRICT to reject referenced-link removal
while preserving identity/medal/exchange rows.

This is an **isolated demonstration only** and deliberately does not apply
DDL to the production Supabase database. The production composite FK is
already validated RESTRICT from the earlier minimum-protection rollout,
which must remain in place. The replayed test is an extra regression
gate, not permission to revert/reapply that DDL.

Open safety gates remain:
- No manually verified CA-master baseline is recorded in production; master
  must remain OFF/2099, regardless of CI PASS.
- Source/DB Community mismatches require operator-reviewed reconciliation,
  not automatically guessed updates.
- Current backup / full application restore E2E are not certified by CI.
- Pending #128/#130/#131 contains a write-capable candidate master handler.
  Its update logic must not replace the currently retired writer without
  separate independent approval and renewed proof of all guards.

## 2026-10-13 Phase E: imported Phase D CSV evidence tools, without enabling sync

- Confirmed initial #141 HEAD at 5f92e2b271a48d94516858e9b24ac3abb801203d.
- Reused exact blob content from old draft #131 for scripts/phase-d-compare-ca-master-local.ps1 and scripts/ci/test-phase-d-ca-master-local-compare.mjs.
- CI executes the synthetic -CsvPath and -SheetOnly fixture: no live Sheet, production database, network, secrets, or identity data.
- The comparator is operator-only. Its default no-argument behavior downloads a read-only live Sheet CSV; NEVER invoke that mode in CI or unattended tasks. When comparing a restored Docker database, it is fixed to the named local-only container and uses a SELECT-only SQL transaction.
- A CSV-to-DB match is NOT an approved master baseline or a release authorization. No CA links may be deleted, moved, or inferred from these results.
- Historic #131 documents saying gate MISSING / FK CASCADE are earlier-state observations. Current 2026-10-13 reported production protective gate OFF, 2099 sentinel and validated RESTRICT take precedence. Do not copy old master writers.
- Current writers, scheduler, Next route, DB migration, and actual production services remain untouched.
- Pending: current source row review; verified baseline remains 0; fresh private backup/restore and isolated full E2E remain incomplete. Production merge and sync remain STOP.

### 2026-10-13 supplement: recovery helper abnormal-path tests

Copied the **mock-only** failure-injection cases from draft #128 into a new Phase E CI regression, excluding every old assertion that assumes a write-capable Edge entrypoint. Six outcomes cover owner-specific pause success/no-row/error/transport failure and audit DB/transport failure. This remains a test of the staged pure helper, **not evidence that the retired production Edge writer executes that helper**. The old direct and coordinate writers must remain RETIRED and not import recovery code. No real identifiers, Supabase calls or changes to production infrastructure.

## 2026-10-13 safety merge inventory and verification boundaries

| Source draft | Safeguard | Present in #141 | Residual limitation |
| --- | --- | --- | --- |
| #128 | Pure source preflight and fail-pause helpers | YES, staged only | No active Edge writer wiring, no live recovery certification |
| #128 | Unlisted CA own-medal transactional approval and claim event changes | NO | Independent feature; never mix into CA-master safety roll-out without separate scoped review |
| #128 | Synthetic backup/RLS/PostgREST/lease-RPC review suite | Partial synthetic FK + mock fail paths | Old tests depend on an enabled writer, cannot directly run against retired production handler |
| #130 | Atomic add-only link reconciliation and stale-link rejection | REVIEW ONLY | Write-capable RPC and Edge handler deliberately NOT imported |
| #130 | Dangerous Next.js old master update endpoint | Protected via previously merged #138 (HTTP 410 on main) | Do not restore the old API implementation |
| #131 | PowerShell CSV-versus-DB local comparison | YES, source and fake CSV test | Real current Sheet and operator Windows restored DB not compared in this CI |
| #131 | NO ACTION/RESTRICT/CASCADE SQL demonstration | YES, synthetic only | Does not certify full real schema or future writer transaction behavior |
| #131 | Full local restore / Edge HTTP / emergency sentinel and gate | Partial static gate + helper tests | Real private backup, OAuth, deployed Edge/Cron/Storage complete E2E not certified |

### Isolation fixture extension

Added synthetic content fingerprints for linked membership, CA Identity, medals, and exchanges. After CASCADE rollback, NO ACTION rejection, RESTRICT deletion rejection and RESTRICT key-update rejection, every fingerprint must equal the pre-injection snapshot. The fixture itself ends with ROLLBACK. The production Identity RESTRICT FK, dedicated OFF gate, 2099 sentinel, and retired writers remain unchanged.

### Source review and release gate

- Still review six historical direct mismatches: source rows 7, 13, 60, 94, 100, 116; unresolved 17 and 34; related 1st/2nd, rename/retirement and multi-prefecture conflicts require manual evidence.
- Compare against a fresh authoritative read-only Sheet snapshot and current protected database; a 2026-10-12 fixture is not today's signed baseline.
- Approved source baseline still 0; **DO NOT create it automatically**.
- Fresh encrypted production backup and 7 Identity/14 medal/20 exchange local restore remains outstanding; old 6/13/19 restore cannot prove latest data.
- Status: CA master sync OFF, no branch merge, no production SQL/Edge/Cron/Vault edits, no Google Sheet edits, no private-repo migration.

## 2026-10-13 current production audit, read-only evidence (post minimal barriers)

All observations below were obtained via permitted read-only Supabase queries / deployed Edge source reads and Google Sheets range reads, with no production mutations, no Google Sheet edits and no secret / personal record exports to GitHub.

| Observation | Confirmed (2026-10-13) |
| --- | --- |
| General scheduler flag | TRUE |
| Dedicated `ca_master_sync_enabled` | **FALSE** |
| Emergency `last_ca_master_at` | **2099-01-01**; future sentinel |
| Composite Identity FK | **RESTRICT**, VALIDATED, NOT DEFERRABLE |
| CA members / Communities / CA links | **200 / 155 / 196** |
| Auth / Identity / medals / designs / exchanges | **7 / 7 / 14 / 14 / 20** |
| Storage metadata | **418** |
| Orphan verified identities / unvalidated FKs | **0 / 0** |
| Approved master baseline run | **0**, remains hard STOP |
| Normal Campfire public collection | Recent `campfire-public-map` success records exist; CA-master sync was not invoked |
| Deployed master writer | `sync-ca-master` **v6** is retired with hard-stop before CSV fetch |
| Deployed coordinate writer | `sync-ca-master-coordinates` **v5** is retired with hard-stop before CSV fetch |
| Deployed scheduler / admin | `sync-campfire-auto` **v12**, manual master admin gate check present |

### Live Google Sheets versus live DB comparison, SELECT-only

- Source tab `[new]CA List 20260828` (gid 633821294) has **200 rows**, **200 unique CA keys**, **198 parsed CA/Community pairs**, **155 distinct Community IDs**.
- Exact source-to-current DB direct pair matches **192 of 198**.
- Six direct source-vs-DB mismatches are **Sheet rows 7, 13, 60, 94, 100, 116**. One row (**100**) matches an historical alias, so **five remain unmatched even including aliases**.
- Source ID unresolved rows **17 and 34**. Source URL/name-region collision groups observed: **7/115, 60/116, 94/177, 144/159/199, 175/198**. Some cases may be valid rename/multi-area operation; nothing is auto-merged or automatically moved.
- **Four** DB current CA/Community links have no directly matching source pair; **three** are not explained even by the source-to-history alias comparison. These are counts, not deletion candidates.
- No Sheet field was edited. Former proposals for H60/H94/H116 and all other cells remain subject to separate owner approval.

### Phase E stop/restore condition

Created a refreshed strictly READ-ONLY SQL review file and CI static safety validation. Both are artifacts for manual operator audit, NOT permission to modify production. The read-only aggregate check was independently executed during this continuation and returned the states summarized above. Fresh authenticated/encrypted Postgres DB backup **has NOT been verified in this continuation**; old local restore has only 6 identities / 13 medals / 19 exchanges, so it is insufficient for new data.

Still STOP: automated CA-master sync, initial one-time sync, manual source edits, automatic baseline creation, changes to current validated FK, Edge deploy, Cron, Vault, PR merge, and private-repository separation.

## 2026-10-13 latest backup preparation: operator-only, NOT RUN

- Copied `scripts/recovery/Backup-CA-Clover-Production-Latest.ps1` from draft #131 by its unchanged source Git blob; added static no-restore/manifest/encryption contract in offline CI.
- Script requirements: operator's Windows PowerShell, Docker Postgres 17 container, 7-Zip, verified Supabase Connect host/user, password entered privately. It performs `pg_dump` READS (not SQL writes), archive catalog inspection, SHA256 hashing, AES/7z encryption and archive test. Never paste DB credentials into ChatGPT or GitHub.
- It stores a new backup in `C:\CA-Clover-Backup-Latest` with a timestamp. Raw temporary directory contains sensitive plaintext database data and remains on disk after encryption; operator MUST secure local access before execution and handle retention separately. Script does not touch existing original backup or encrypted v4 archive.
- The script itself is NOT a verified backup. No operator local execution, password handling inspection on real Windows, archive file, Storage object bytes, OAuth/Secrets/Edge/Cron recovery or fresh isolated restore was confirmed in this continuation.
- Fresh target remains 7 Auth/CA Identities, 14 medals/designs, 20 exchanges and 418 Storage metadata objects, plus exact per-person link/content verification. No automatic restore to production, and no automatic sync.

## 2026-10-13 Phase E synthetic full-file restore rehearsal: PASS (NOT production proof)

- GitHub Actions run [38416184218](https://github.com/Kaityo1221/ca-clover/actions/runs/38416184218): both `integration-off` and `synthetic-identity-fk` jobs succeeded on commit `21a527cb0a3b0a3d90e6478f0d193a40f9073c2a`. Minimal Production Barrier QA and normal CI also PASS.
- Added three fake-only assets under `scripts/ci/`: `phase-e-synthetic-restore-fixture.sql`, `test-phase-e-synthetic-restore.sh`, and `phase-e-restored-negatives.sql`.
- Test begins only with `PGHOST=127.0.0.1`, `PGPORT=5432`, `PGDATABASE=ca_master_safety`, `PGUSER=postgres`; SQL validates exact synthetic source and target DB names and a TCP PostgreSQL connection. The destination `ca_master_restore_qa` must not preexist. All data is fabricated.
- First isolated test run STOPPED because GitHub runner pg_dump was v16 and service was v17; client was upgraded to an exact PostgreSQL 17 Docker client image with host-only local routing and separate Docker `--network none` catalog inspection. No production endpoints involved.
- `pg_dump -Fc` archive was cataloged and archive SHA-256 verified; then `pg_restore` imported into a fresh synthetic database. Before/after each of 12 table counts and canonical JSON-row SHA-256 digests matched.
- Synthetic counts deliberately mirror current observed production *volumes* only: 7 Auth users, 7 Auth identities, 7 profiles, 200 CAs, 155 Communities, 196 CA links, 7 CA identities, 14 medals, 14 designs, 20 exchanges, 1 automation state, 418 Storage metadata objects.
- The restored fake source retains independent CA-master gate OFF, emergency 2099-01-01 and validated composite Identity FK RESTRICT. Attempted deletion of a linked identity association is rejected; a deliberate medal field tamper is detected; negative test rolls back.
- `postgres:17` synthetic schema is a **limited representative fixture**, not an exact 98-FK Supabase schema or the real Windows restore. It does **not** prove real-current OAuth, Edge source/secrets, Cron, image bytes, actual Storage objects, policies, or future write-capable master sync behavior.
- Current live source mismatch persists (six direct discrepancy rows 7,13,60,94,100,116, two unparseable 17,34, plus name/ID collision review). Production verified baseline 0, no source write, no sync restart.

### Required owner-only continuation before any production release

1. Run operator-only latest production backup on the Windows PC in a protected local workspace. Archive secret is entered privately; do not transmit raw dump, IDs, credentials or hash manifests through public PR.
2. Verify backup catalog and encrypted archive; preserve existing v4 original; ensure plaintext snapshot and its directory are access-controlled. Avoid publishing paths or individual identifiers.
3. Restore this **new** latest archive into an isolated local PostgreSQL instance, never the production project. Inspect actual dependent FK, trigger, policy, grants, sequence and schema coverage, then compare private per-record fingerprints across Auth, links, medals, designs, exchanges and Storage metadata.
4. Confirm exact latest counts (7 identities, 14 medals/designs, 20 exchanges) and zero relationship loss. Compare current live record content inside private protected environment; a match of only counts is not enough.
5. Complete OAuth/Edge/Storage/Cron full E2E separately or retain STOP. Source review and verified baseline remain separate authorization gates. Do not change gate, 2099, identity FK, old retired writers, PR merge, or private split.

**PHASE_E_SYNTHETIC_RESTORE=PASS. FRESH_PRODUCTION_BACKUP=NOT_VERIFIED. FULL_APP_RECOVERY=NOT_TESTED. SOURCE_RECONCILIATION=STOP. PROD_APPLY=STOP.**
