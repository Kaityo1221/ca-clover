# CA master dedicated pause gate (REVIEW ONLY, NOT DEPLOYED)

Date: 2026-10-10 JST
Project: CA Clover, production Supabase `wgiittrvgtiosogyhfcl`

## Safety invariant

All CA-master paths require a dedicated `ca_master_sync_enabled=true` flag:
1. `sync-campfire-auto`: when false, skip *only* master sync; retain public Meetups, watch, icons, notifications, calendars and other work.
2. `sync-ca-master-admin`: refuse ADMIN manual sync while false.
3. `sync-ca-master`: enforce server-side after Cron-secret auth and before ANY fetch or write, regardless of caller.

Flag absent, row absent or DB query failure MUST NOT permit CA-master writes.
Do not use `sync_automation_state.enabled`, as that disables unrelated work.

## Proposed isolated-database schema change (DO NOT RUN IN PRODUCTION)

The TypeScript in this draft intentionally fails closed until this column exists.
Apply and test ONLY in a disposable, isolated Supabase branch (subject to cost approval)
or a fully disposable local Postgres database before considering production.

```sql
begin;
alter table public.sync_automation_state
  add column if not exists ca_master_sync_enabled boolean not null default false;

-- Database backstop: prevent a currently referenced CA link from being deleted.
-- Existing FK is ON DELETE CASCADE, which can silently erase user_ca_identities.
alter table public.user_ca_identities
  drop constraint user_ca_identities_community_id_ca_member_id_fkey;
alter table public.user_ca_identities
  add constraint user_ca_identities_community_id_ca_member_id_fkey
  foreign key (community_id, ca_member_id)
  references public.community_ca_members(community_id, ca_member_id)
  on delete restrict;
commit;
```

DB foreign-key change is **proposed only**; do not call `execute_sql`,
`apply_migration`, or any production DDL before isolated verification and explicit authorization.
Before writing a release migration, use `supabase migration new` when a supported CLI is available.
Keep the new flag server-side: no grants for client update, no exposed anonymous update.
Review RLS and grants before any admin UI control is added.

## Current temporary emergency pause

`sync_automation_state.id=1.last_ca_master_at=2099-01-01T00:00:00Z`.
It is a temporary emergency barrier, NOT a flag.
Keep it unchanged until both the dedicated gate and Identity protection pass.

`sync-ca-master` currently runs v4 in production; no code in this draft is deployed.
`sync-campfire-auto` production v10 has 45 additional lines for icon sync and claim notification;
this branch is derived from the production-identical source preservation branch / PR #119.
PR #117 is the separate draft incremental reconciliation change. Both need combined review.

## Review/isolated DB test matrix

| Case | Expected |
| --- | --- |
| New flag missing | master endpoint fail-closed; admin fail-closed; auto skips only master |
| New flag false | master 423 paused, admin 423 paused; all unrelated 15m tasks continue |
| New flag true plus due=false | auto skips master; manual allowed only once PR #117 and FK safeguards pass |
| True, due=true | auto can invoke the protected master |
| Existing CA link unchanged | retain the same Identity and primary state after sync |
| Community assignment changes | protected stale links flagged for manual review, not cascaded |
| New Identity inserted concurrently with a stale-link deletion | FK RESTRICT prevents Identity deletion; error surfaced for review |
| Source fetch returns malformed / missing columns | reject without destructive write |
| Network failure mid-sync | no primary identity loss; partial failure logged; repair plan required |
| 1st and 2nd identity + owned medals + QR exchange | unaffected |
| Disabling during in-flight sync | record limitation: an entry-time gate alone does not abort running transaction; isolate and test extra guard/locking |

Pre/post production data verification must record counts and identity keys without logging private data to CI.
Baseline observed on 2026-10-10: 5 profiles, 5 memberships, 5 identities, 5 primary identities, 12 medals.
Zero orphaned Identity links; all 5 primary identities have their own medal.

## Release sequence (NO steps authorized yet)

1. Check CI and review PR #119 (source preservation), PR #117 (diff sync), this gate draft.
2. Build a disposable isolated DB, seed representative CA/Identity/medal data.
3. Test proposed column default OFF and FK RESTRICT in isolation.
4. Resolve PR #117 concurrency/error handling and compose a single deployable Edge source
   (no regression in icon sync / claim notifications).
5. Obtain explicit user approval for all production migrations/deployments.
6. Set dedicated gate OFF in production; leave 2099 sentinel while deploying/verifying.
7. Deploy tested code with source comparison and smoke tests, preserving unrelated Cron paths.
8. Record pre-sync data snapshot; perform one controlled post-approval master sync, compare.
9. Only then consider re-enabling the automation. In an incident: switch OFF immediately.
10. ADMIN UI state, audit history, and more granular mid-flight cancellation are follow-up work.

**STOP conditions**: any Identity count decrease without an explicitly approved deactivation,
unexpected medal change, missing primary, link orphan, unexpected Edge source difference,
or failure of the admin/direct guard. Roll back the release, leave master paused, investigate.
