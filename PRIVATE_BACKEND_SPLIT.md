# Main branch private-backend split (draft)

## STOP before merge

- Validate a private repository with an exact verified copy of
  `main/supabase/` AND the production `pages/supabase/` tree.
  Do not presume the two branches contain the same revisions.
- Preserve all released CA-master safety protections and 2099 pause.
- Validate private CI, migration checks, Edge deployment workflow
  and rollback procedures outside this public repo.
- Validate Next.js build, auth-routing test, and Pages deployment.
- Review other public refs (pages, tags, PR branches), repository
  history, forks, caches and any exposed secrets separately.

The private repository is not provisioned by this PR.
No database writes, scheduled jobs, token changes, or backend deployments
are executed by the public-source split.
