# CA Clover Phase E: Windows one-command private DB backup and restore audit

**Status:** staged operator tool in Draft PR #141, tested with synthetic GitHub CI only. **Do not claim the owner's actual backup has been taken or restored.**

## Prerequisites (before command)

- Windows PC, Docker Desktop and 7-Zip installed. Keep adequate local disk space for the raw dump, encrypted copy, and new container database.
- Download or clone the complete `scripts/recovery` directory from this **exact safety branch**, preserving filenames side by side. When using Git, clone `Kaityo1221/ca-clover` with branch `safety/ca-master-final-integration-off-20261013`, then open PowerShell in its `scripts/recovery` folder. Do **not** run from `pages` or `main`, where these tools are not released.
- Obtain the latest **Connect** settings from the project's Supabase dashboard. Supported: `db.wgiittrvgtiosogyhfcl.supabase.co` with `postgres`, or the official Session Pooler `*.pooler.supabase.com` with `postgres.wgiittrvgtiosogyhfcl`, always port 5432.
- Choose a secure Windows desktop session. Passwords are entered interactively on the operator PC. They must not be sent to chat, public GitHub, CI or logs.

## Run once in PowerShell

Open PowerShell in the folder containing all four `.ps1` / `.sql` files (or supply the absolute path). For direct connection:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\Start-CA-Clover-PhaseE-OneShot.ps1" -DbHost "db.wgiittrvgtiosogyhfcl.supabase.co" -DbUser "postgres"
```

For the **Session Pooler**, use the actual project-specific host shown in Supabase Connect, not a guessed server:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\Start-CA-Clover-PhaseE-OneShot.ps1" -DbHost "<EXACT_SESSION_POOLER_HOST_FROM_SUPABASE_CONNECT>" -DbUser "postgres.wgiittrvgtiosogyhfcl"
```

Supply the production database password **only at the local private prompt**, followed by 7-Zip password entry.

## Exactly what happens

1. New ACL-restricted directory under `C:\CA-Clover-Backup-Latest`. Existing backups are untouched.
2. PostgreSQL 17 `pg_dump -Fc` reads production; script validates catalog, SHA-256, encrypts into new `7z` archive, tests archive.
3. Rechecks just-written private SHA-256 manifest. Creates a new randomly named `public.ecr.aws/supabase/postgres:17.11.0.004` local container with `--network none`; no host ports, no production URL passed to this stage.
4. Makes a brand-new local `ca_master_restore_qa` DB, runs `pg_restore --exit-on-error`. **If Supabase platform object, extension, role or pg_cron compatibility fails: STOP.** Never skip errors or treat an incomplete restore as PASS.
5. Executes READ-ONLY audit for CA-master gate OFF, 2099 stop, validated RESTRICT FK, orphan checks and twelve relation volumes/fingerprints. Old snapshot 6 identities/13 medals/19 exchanges intentionally fails.

## Interpreting the result

- `[PASS] PHASE_E_LATEST_BACKUP_AND_ISOLATED_DB_RESTORE` means **fresh database backup and isolated database restoration/audit passed**, not that OAuth, Edge functions, secrets, Storage **bytes** or Cron are recoverable.
- `[STOP] PHASE_E_ONESHOT_FAILED_AT_...` means fail closed. Private detailed log and all backup files are left on PC for diagnosis.
- Raw database snapshots exist in the local working directory **and** restored Docker container. Protect them from unauthorized users; never upload to GitHub or share in chat. Do not destroy old encrypted v4 backup.
- **No production restore, no CA-master sync restart, no schema migration, no PR merge, no private-repository split.**

**Known limitation:** a live/current per-row hash comparison and complete application recovery test remain separate release gates.
