# CA Clover private backend split: staging checklist

**STATUS: STAGING ONLY. DO NOT MERGE BEFORE PRIVATE BACKUP VALIDATION.**

The public GitHub Pages deployment uses only `docs/` via
`.github/workflows/pages-deploy.yml`.  This candidate removes
Supabase migrations, Edge Functions, backend CI probes, and internal
Campfire authentication research from the public **branch tip**.

## Preconditions (manual, required)
1. Create a **private** backend repository owned by the same account.
2. Copy `supabase/`, the removed server-side CI fixture/scripts and
   `docs/campfire-auth-provider.md` from the frozen public
   `pages` commit `cfd648c43e4cd239ac006ce385f00b0fb4d38cff`.
   Review, **do not copy tokens**. Preserve paths and validate file hashes.
3. Ensure private repo Actions/CI covers migrations, protected CA-master
   STOP/2099 guard, Edge Function deployment and rollback. All existing
   deployed Supabase functions continue to run until deliberately deployed;
   source removal is not deployment.
4. Validate no references to deleted backend sources from the public
   Next build/tests and the GitHub Pages artifact remains unchanged
   (except removal of the internal research markdown).
5. Confirm CA identity integrity, medal exchange, public activity
   display, Campfire auto sync, and rollback/restore evidence are retained.
6. Verify access only for the owner in the backend repository. If sharing
   a sample with YUKISOUL, create a distinct sanitized repo **without**
   privileged server code or live credentials.
7. Review the **main** branch separately. Removing the backend only
   from `pages` does not remove copies in `main`, tags, PR refs, Git
   history, forks, caches or third-party copies.
8. Audit historical commits for secrets, rotate any known-compromised
   secrets, and decide whether to replace the public repository with a
   clean-history, Pages-only repository. History rewriting is a separate
   high-risk operation that needs explicit approval.

## STOP conditions
- Private repository or source backup absent.
- Missing/untested CA-master safety procedures or rollback.
- Any failure in Pages UI/CI or private Edge validation.
- Any action unexpectedly requires live Supabase data or secrets.

This draft does **not** modify any production database, cron schedule,
secret, Edge Function deployment, GitHub Pages deployment or default branch.
