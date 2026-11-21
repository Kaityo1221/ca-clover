# CA Clover ADMIN Meetup backfill UI isolated rebase (2026-11-17)

**Draft-only, never deployed. No production GO.**

Derived the existing tested backfill screen from Frontend Draft PR #172 (`fa14a090909098bee05c937d6e2aaaa99197575b`) and inserted it into the current `pages/docs/admin.html` without replacing intervening changes. Only the new menu entry, route and backfill function were added. Existing `account-audit` route, updated administration screens and `clover-global-home.js?v=20261113-home1` were preserved byte-for-byte during transformation (old content was reconstructed from transformed content as an explicit static check).

Unlike PR #172, this isolated UI explicitly sets `FRONTEND_BACKFILL_WRITE_GATE=false` and includes it in the `canCommit` predicate. Even if a preview API incorrectly returns `canSave=true` and `readOnly=false`, the candidate's registration button cannot become active. No `admin-meetup-backfill` Edge exists in production as of the read-only check, so a preview request cannot be considered a functioning E2E.

Static checks on a checkout: `node --test scripts/test-meetup-backfill-rebase-20261117.mjs`. This is not Chromium/iPhone/real Auth E2E. A new, explicitly approved release must separately reconcile backend #18 and #21 RPC/ACL guards, authorize real apply, verify production difference and original metrics, and run browser/recovery regression. The candidate must not be merged into `pages` or deployed before an individual owner GO.

Existing Frontend #172/#181 and Clover QA #325 stay untouched. No production DB/Cron/Edge/Pages/Vercel change, no secret access or paid resources.
