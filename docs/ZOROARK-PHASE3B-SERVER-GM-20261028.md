# CA Clover | Zoroark GM CA Authorization Design (Phase 3B)

Date: 2026-10-28 JST
State: **DRAFT / NOT PRODUCTION APPROVED**

This is a stacked, isolated security PR based on `feat/zoroark-local-gm-ui-20261028`, not the default branch.
The Phase 3A UI-only PR remains draft and is not modified.

## What this branch does

- Add `POST /api/zoroark/round`, creating each round **only after** checking a Supabase Auth access token and current `profiles.role` via the existing row-level security.
- Accept `ca` or `admin`; deny `pending`, logged-out, malformed, expired and revoked roles. Unavailable authorization returns an error (fail closed).
- Use the frontend's **public publishable key** and a per-request user token, **never** `service_role`, Vault, or a privileged database connection.
- Store the 42-pair question bank and round generation on the server side of Next.js; remove generation from client imports.
- Require successful API response for new GM rounds; preserve local one-device play, GM assistance, two conversation modes, pointing votes and reveal animation.
- Read-only self-profile query. No data writes, table creation, RLS modifications, cron, Supabase Edge deployment or storage changes.
- Request shape: `{count:3..12,difficulty:"all"|"easy"|"normal"|"hard",recent:string[0..6]}`.
- Auth header: bearer access token returned from existing `supabase.auth.getSession()`.
- No cache, limited JSON body length, origin-restricted CORS including the existing GitHub Pages origin.

## Important trust limitations

1. This secures **official API access to new rounds**, not the ability to imitate a game. The source repository is public, so a third party could fork or reproduce game logic. No public web app can fully prevent that.
2. GM's phone receives the whole round (prompts, pair and minority index) after authentication. This prototype relies on GM trust and on one-at-a-time hidden UI; it is **not cryptographic secrecy against a malicious GM or browser developer tools**. Strict secrecy requires server-held state and an API for one-card reveal, beyond the current single-device prototype.
3. Current UI `useAuthProfile` uses the existing `profiles` and `user_permissions` tables. The new API separately verifies token and live role. Server-side query depends on the existing `profiles` self-read RLS policy staying operational.
4. The public raw.githack demo remains independently usable and **is not CA restricted**. Do not distribute it as the official CA-only service.
5. GitHub Pages cannot host a Next.js API endpoint itself. On Pages, authenticated requests are directed to the existing Vercel Next.js origin; preview deployments use their own same-origin API.
6. No automatic session renewal is implemented specifically for this game. If the token expires before creating a round, fail closed with login guidance.
7. No persistence, scoreboard, registration of trainers, nor remote multiplayer. No data is sent other than the bearer token and validated gameplay parameters.

## Security and regression test matrix

- Runtime: valid admin and CA => 200 with one minority; pending => 403; no token => 401; fake/expired token => 401; permission-read DB issue => 503; newly revoked CA => 403; cross-origin disallowed => 403; unauthorized request must reveal zero question content.
- Inputs: malformed body => 400; count under 3/over 12 => 400; invalid difficulty/history => 400; JSON over limit => 413.
- Smoke test: game cannot start if API missing or unreachable; successive rounds still work for CA; local voting and reveal remain correct.
- Build: `npm run build`, `npm test`.
- Unit: `node --experimental-strip-types scripts/test-zoroark-engine.ts`.
- The existing `npm test` chain now executes `scripts/test-zoroark-engine.ts` as part of PR CI; verify its result before final PASS.

## No-go and next approval gate

**No-go for production** until: isolated CI passes, independent AUTH / JWT / RLS integration tests run against an approved disposable environment, CA/ADMIN/guest/pending/revoked/expired roles are verified, Safari is tested from real CA Clover origin, and the owner explicitly approves merging / deployment.

Do not use or modify Phase E backups, containers, proofs or production Supabase data. Do not change the existing ADMIN/backend PRs or deploy any migrations, Edge Functions or secrets. Never output access tokens to logs.

## 2026-10-28 Synthetic HTTP verification evidence

- Tested commit: `d27e3abaf2dcd671038014d3564e009b84c6059d` (before this report-only change).
- GitHub Actions CI run: `40656811707` **SUCCESS**, `npm test` (including policy and isolated HTTP checks) **PASS**, `npm run build` **PASS**.
- Public/Private Boundary run: `40656811842` **SUCCESS**.
- Production user data: **not read**. All Auth and REST responses came from a locally spawned synthetic HTTP service using fake identity `00000000-0000-4000-8000-000000000001` and fake tokens.
- Actual `Next.js` API route `POST /api/zoroark/round` was exercised end to end with synthetic Supabase. Test confirms: absent JWT and invalid JWT => 401; CA and ADMIN => 200; pending/revoked/missing role => 403; Auth failure => 401; database failure => 503; forbidden Origin => 403; malformed size/difficulty and oversized body => 400/413; attempted role injection is denied; no secret round included on failures.
- Verified mock received a bearer JWT for authenticated profile reads, queried only the authenticated user's profile, and observed zero database writes.
- This is **not** a real Supabase Auth/RLS/PostgreSQL environment. The real JWT, policy, user revocation, CORS from deployed origin and real iPhone Safari integration have **not been proved**. Final release remains **NO-GO**.
- No migrations, secrets, deploy configuration, protected backup state, or existing PRs modified.

The first attempt failed due to the synthetic test's localhost Origin not matching Next's inferred request origin. The HTTP harness was corrected to use the known GitHub Pages origin, and the subsequent run passed. This should not be misreported as a real Auth validation failure.


## 2026-10-28 Actual disposable PostgreSQL RLS verification

**Result: 10/10 PASS in real PostgreSQL (isolated)**. This does NOT prove production configuration or genuine Supabase Auth.

- Evidence commit: \`c42e6dc0a3d15f2a5f0d30d6f707101832f07aaf\`
- GitHub Actions CI run \`40665405153\`: **success**; includes \`npm test\` and \`npm run build\`.
- Public/Private Boundary CI run \`40665405215\`: **success**.
- Vercel check: **success** (build/deployment status only, no real Safari/JWT authorization claim).
- Fixture: \`scripts/fixtures/zoroark-rls-isolated.sql\`; runner: \`scripts/test-zoroark-pg-isolated.mjs\`.
- Runner creates a *new local PostgreSQL instance* under a temporary directory, with \`listen_addresses=''\` and a private Unix socket; deletes the cluster after checking. No production DB connection, real users, JWT signing key, service-role secret, or live data.
- Role / ACL / policy assertions (10): CA self-read; fake JWT metadata cannot elevate privileges; \`authenticated\` cannot self-update \`profiles.role\`; permitted \`niantic_id\` update; admin read; pending denied; live revocation from \`ca\` to \`pending\` respected without changing the user session claim; other-user profile isolation; anonymous denied; final PASS marker.
- Fixture is modeled on source migrations \`20260918_harden_rls_and_ca_identity.sql\` and \`20260919_restrict_profile_updates_and_ca_visibility.sql\`. It is deliberately *not* a clone, dump, or perfect reproduction of the live Supabase project.
- CI also confirms the pre-existing synthetic \`getUser\` + PostgREST HTTP matrix passed and did not call actual Supabase.

**Remaining NO-GO criteria:** independent nonproduction Supabase Auth with real signed JWT and PostgREST/RLS (not only a synthetic web mock); verification that current live-role restrictions and column ACLs match what is intended (read-only audit with explicit permission); authenticated Pages-origin iPhone Safari round trip with CA/admin/pending/expired/revoked and failure modes; separate approval to merge/deploy.

No real Supabase resources, backend PRs or production configuration were changed for this phase.


## 2026-10-28 Genuine local Supabase Auth / JWT integration evidence

**PASS (real local Auth, ES256 JWT, PostgREST and RLS); production release remains NO-GO.**

- Verified code commit: `4853eede9cc12a689eb0d4d3ed85576c537dd8d0`.
- CI: <https://github.com/Kaityo1221/ca-clover/actions/runs/40671570480>. The GitHub Actions `npm test` step and `npm run build` both PASS. The concurrent Public/Private Boundary CI must be checked separately.
- The isolated runner `scripts/test-zoroark-real-auth-local.mjs` starts a new Supabase CLI `v2.122.0` stack in a temporary directory with distinct project ID, local API and DB endpoints only, and a short 60-second JWT expiry. It creates **synthetic accounts**, never uses production credentials or accounts, and calls the actual Next.js `POST /api/zoroark/round`.
- Real Supabase Auth issued ES256-signed JWTs, validated by actual GoTrue `auth.getUser`; actual PostgREST applied row-level-security to `profiles`. CA/admin received rounds, pending/guest/invalid-signature/forged user metadata and unauthorized self-role changes were rejected. After the synthetic CA role was changed to pending in the disposable DB, the same previously valid signed JWT was denied. After the JWT expired naturally, the API returned HTTP 401. No question payload was present in denied responses.
- Explicit profile queries using user JWTs confirmed self-only RLS visibility. The test verified `profiles.role` could not be written by the client role.
- Test cleanup stopped the isolated Supabase stack without a backup. No project was created on the Supabase cloud service, and no existing project, secret, Phase E backup, backend PR or real user record was accessed or modified.
- The first two CI attempts caught **test harness mistakes**, not verified application vulnerabilities: a profile client missing a bearer token and an assumption of HS256 signing. Both were corrected; the final actual ES256-expiry test passed. Do not count a failed harness attempt as a security pass.
- To avoid routinely launching many Docker images on every ordinary PR, the slow integration is preserved as explicit `npm run test:zoroark-real-auth-local`, separate from the fast default `npm test`. It is intended to run only in a fresh unlinked Linux GitHub Actions environment. No `.github/workflows` changes were made.

### Remaining release gates

1. Confirm the *actual deployed* Supabase project's profile column ACL / RLS policies match reviewed source, through an authorized read-only inspection. No production SQL write, migrations or role changes.
2. Run authenticated iPhone Safari in CA Clover's intended entrypoint and verify CA/ADMIN/guest/pending/session expiry and correct game pass-and-play UX.
3. Explicitly approve rollout. Keep Draft PR #187 and Draft PR #188 unmerged, with no automatic production deployment.
4. Treat standalone raw.githack prototype as a public demo only; it remains bypassable and not CA-authorized.

**This completes disposable real-auth technical verification, not the production authorization and deployment review.**
