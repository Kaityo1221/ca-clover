# CA Clover 2026-10-13 | Minimal master-safety release candidate

**REVIEW-ONLY DRAFT**. Nothing in this branch authorizes production writes, merging,
Edge deployment, Cron changes, enabling the CA master switch, or removing the
2099 emergency sentinel. This first release intentionally does **not** restart CA
master sync; resumption needs a later, protected reconciliation release.

## Scope (5 runtime artifacts plus tests)

From current \`pages\` (not the 74-file stacked Phase D branch):
- \`supabase/migrations/20261013_ca_master_minimal_barrier.sql\`: add
  \`sync_automation_state.ca_master_sync_enabled boolean not null default false\`,
  and change only the composite Identity-to-CA-link FK from CASCADE to RESTRICT.
  Fail on absent 2099 pause, anomalous old FK, orphan Identities, gate already
  installed or client UPDATE privileges. Transactional DDL; no identity or medal
  rows modified.
- \`sync-ca-master\` and \`sync-ca-master-coordinates\`: after existing cron
  secret authorization, fail closed on absent/OFF gate; when gate is ON, return
  410 before reaching legacy CSV fetch or mutation code. The old code remains
  in file behind a runtime function returning true to minimize source churn;
  it is *not* approved for future execution.
- \`sync-ca-master-admin\`: validate admin token/role as before, then deny
  missing/OFF master gate before forwarding.
- \`sync-campfire-auto\`: preserve **exact** currently deployed v11 source
  (same as commit \`bc7ad70582e219c69fbe512d0c30dad3c4e1ad81\` from
  source-preservation branch) except the master-only
  \`state.ca_master_sync_enabled===true\` condition. Public Meetups, hot scans,
  icons, claim notifications, and event calendars should remain unchanged.
  Need runtime regression smoke after actual release.

## Baseline verified read-only 2026-10-13

Emergency CA master 2099 pause PAUSED, general Campfire enabled, gate MISSING,
Identity composite FK CASCADE, verified CA-master baseline MISSING. Counts:
Auth 7, linked Identity 7, medals 14, medal designs 14, exchange sessions 20,
Storage metadata 418; orphan Identity and medal references 0.
2026-10-12 latest private encrypted backup and restored clone passed core counts.
An isolated SQL transaction changed FK to RESTRICT, rejected deletion of a
referenced CA link, then rolled back with dependent counts intact.

## Tests

GitHub Actions \`CA Master Minimal Production Barrier QA\`:
1. Disposable Postgres 17 fixture, apply *actual migration file* and verify
   validated RESTRICT, OFF gate, no client UPDATE grant and refused referenced
   link DELETE with no lost Identity.
2. Static check: both legacy writers retained a permanent retirement guard
   before fetch/write; ADMIN checks OFF gate before request. Auto source must
   byte-match the known deployed version except the one intended gate change.
These tests **do not** prove Deno Edge deployment, true RLS behavior,
complete app recovery, full cron integration or production release safety.

## Separate approval milestones and safest release order

Before authorization: review this PR and CI, compare current live deployed
source hashes, verify owner/baseline invariants, private pre/post content
fingerprints for 7 Identities, 14 medals, 20 exchanges, and confirm current
emergency sentinel. Confirm no competing migrations/sync.
Use an operator-approved maintenance window.

1. **Separate explicit user approval required** for production safety changes.
2. Deploy \`sync-ca-master\` and \`sync-ca-master-coordinates\` as retired
   fail-closed wrappers, retaining existing \`verify_jwt\` configuration.
   Both return unauthorized for missing/bad cron secret and do not fetch CA
   master. This blocks direct callers before any schema change.
3. Deploy \`sync-ca-master-admin\` and exact-preserved \`sync-campfire-auto\`
   with master gate OFF/absent. Do not alter Cron state or other Edge code.
4. Execute versioned migration in a transaction; STOP on any precondition
   mismatch. Verify OFF switch, 2099 sentinel, RESTRICT validated, Auth and
   CA Identity/medal/exchange fingerprints unchanged.
5. Smoke: direct secret-authorized legacy endpoints 423 while gate OFF,
   ADMIN authorized request 423 while OFF, unauthorized 401/403; verify
   general Campfire tasks continue without master invocation.
6. Keep 2099 sentinel and dedicated gate OFF after release. Record audit
   evidence and label first-stage safety protection achieved, sync still STOP.

**Rollback/incident principle**: on SQL error rollback is automatic.
On an Edge deploy issue, revert *only* the affected Edge function from preserved
source after reviewing whether that reintroduces the unsafe legacy writer.
Prefer leaving retired writer endpoints and keeping emergency pause active.
Never automatically revert the FK to CASCADE or enable the master gate.
Any rollback of committed safety protection requires a separate plan and
approval; do not deploy known unsafe writers as an incident workaround.

## Work deferred until separately reviewed

- Resolve outstanding CA master Sheet-to-DB pairs (rows 7, 13, 17, 34, 60,
  94, 100, 116 and related name/role histories); no Sheet changes here.
- Review additive-only CA link reconciliation/lease, verified source baseline,
  partial write failures, API paths and full isolated Edge E2E.
- Approve one manual protected sync separately, compare exact user-linked
  fingerprints, then separately approve recurring schedule and remove 2099 pause.

This scope split enables unrelated visual/frontend work to proceed without
implicitly enabling CA-master writes.
