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
