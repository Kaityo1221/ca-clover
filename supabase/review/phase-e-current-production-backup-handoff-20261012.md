# CA Clover | Latest production backup handoff (2026-10-12 JST)

## CURRENT STATE: latest backup NOT YET TAKEN, CA MASTER SYNC STOP

This document coordinates the **existing encrypted original v4 archive** with the next *new* backup and isolated restore. It is not an instruction to merge, deploy, apply migration, edit the Sheet or re-enable a sync.

### Live production read-only inventory (2026-10-12)

| Object | Observed | Previous private restored snapshot (2026-10-11) |
| --- | ---: | ---: |
| PostgreSQL major/minor | 17.6 | 17.11 local |
| CA members | 200 | 200 |
| Communities | 155 | 155 |
| Community/CA links | 196 | 196 |
| Auth users | **7** | **6** |
| Google Auth identities | **7** | **6** |
| Profiles | **7** | **6** |
| CA identities | **7** | **6** |
| Collected medals | **14** | **13** |
| Medal designs | **14** | **13** |
| Exchange sessions | **20** | **19** |
| Storage metadata objects | **418** | **418** |
| Storage buckets | 2 | 2 |

Storage buckets are **148 archived icon objects + 270 thumbnail objects**. Production `max(updated_at)` is 2026-10-03 for both buckets, earlier than the verified 2026-10-11 Storage download with **418/418 SHA-256 matching objects**. This is **strong evidence that the existing Storage byte archive may be reusable**, not a substitute for name+byte/hash-by-hash comparison. Three files were not decodable as images despite matching Storage API bytes; keep this `REVIEW`.

**Edge Function inventory comparison:** As of the same read-only production check, **all 32 deployed Edge Functions** have an `updated_at` earlier than 2026-10-11, with the most recent change 2026-10-09. This suggests the preexisting 32-function source backup can also be reused **after exact source/version/hash verification**. No source code or secrets were exported in this audit; deployment timestamps alone are not byte-for-byte backup proof.

**NO LOSS RULE:** the existing 2026-10-11 old snapshot is **not current**. The new live Identity and medal must never be overwritten or deleted by a restore, diff sync or release.

### Backup execution on operator's Windows PC (not on ChatGPT cloud)

A no-overwrite, fail-closed capture script is prepared in:

`scripts/recovery/Backup-CA-Clover-Production-Latest.ps1`

It:
- Requires the actual production **PostgreSQL 17 session-pooler or direct** hostname, username, and prompts privately for a password. Never place passwords in chat.
- Pins the target project by project ref and database name `postgres`.
- Uses Docker PostgreSQL 17 `pg_dump -Fc` over an authenticated SSL connection. **This query only reads production; it does not run any migrations or alter CA master controls.**
- Verifies the archive catalog contains essential `auth`, `storage`, `public.user_ca_identities` and medal tables; checks archive existence and hashes.
- Encrypts a **new** 7z AES archive with an interactive password prompt, checks its integrity. The original `C:\CA-Clover-Backup` and the previously encrypted v4 archive must remain untouched.

On the operator PC (PowerShell, in a suitable working folder with the script downloaded), the generic invocation is:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\Backup-CA-Clover-Production-Latest.ps1" -DbHost "<Supabase Connect Session pooler HOST>" -DbUser "<Supabase Connect USER>"
```

**The command is an operator action, not executed here**. If `pg_dump`, catalog listing or encryption fails, stop without claiming success; check the terminal privately. Ask for the **PASS/STOP lines only**, never connection passwords, content of the raw dump or Auth/Storage identities.

**Important:** a raw PostgreSQL dump includes Storage **metadata** but not Storage **object bytes**, and it does not export Edge Function deployment secrets or Google OAuth provider configuration. Hence this is an **encrypted fresh DB archive**, not yet a complete project recovery proof. See Supabase official Database Backups and CLI backup/restore docs for scope.

### Complete backup checklist (keep private)

- [ ] Encrypted new raw Postgres archive passes `pg_restore --list` and contains 7 Auth identities and the latest 7 CA identities/14 medals; compare real restored rows, not counts only.
- [ ] Current Storage API 418 keys, byte SHA-256 signatures and bucket policies verified against the 2026-10-11 Storage manifest; re-download any changed object. Old Storage full check 418/418 PASS does **not** prove today's unchanged metadata without a comparison.
- [ ] Edge Function **deployed source/version** saved privately, especially active `sync-campfire-auto` **v10** and dangerous `sync-ca-master` **v4** (do not call v4).
- [ ] Secrets and OAuth configuration preserved in private operator-managed vault, **not** GitHub or public archive.
- [ ] Current Cron schedule/state, DB roles/RLS, triggers, functions, extensions and `pg_constraint` captured.
- [ ] Hash manifest and encrypted archive independently copied to controlled off-device storage; test decrypt/archive integrity. Never erase 2026-10-11 v4 archive.
- [ ] Fresh isolated local restore: validate 7 Auth, 7 CA identities, 14 medals, 14 designs, 20 exchange sessions, 418 objects, FK validity, sequences and original per-key Identity/medal connections. Confirm no deletes or swapped mappings.
- [ ] Full OAuth, live Edge functions, actual user login, Storage image decode and safe Cron app E2E marked `PASS` or honestly `NOT_TESTED`, not inferred from backup restore.

### Already completed automatically, no operator input needed

- PR #128/#130/#131 CI passed previously, including synthetic PostgreSQL restore safety and HTTP rejection tests.
- The current read-only SQL report `phase-e-production-readonly-stop-preflight-20261012.sql` was executed without changing production.
- Emergency sentinel 2099 = active, general Campfire cron = enabled, orphan CA Identity links = **0**.
- Dedicated CA master switch = **not installed**, FK `ON DELETE CASCADE` = **still unsafe**, verified master baseline = **0**. This is a **hard STOP** on all master sync entry points.

### After latest backup and local proof

Require **separate informed release approval** for any production schema/Edge changes. Deploy protection **with gate OFF and emergency sentinel intact**. Validate all legacy/admin/manual/cron paths blocked. Only later approve one protected, verified-source, no-delete sync and separately approve recurrent automation. The source-only corrections H60/H94/H116 remain proposals until Google Sheet owner gives explicit update authorization. All other mismatches need protected review before automatic link repair.
