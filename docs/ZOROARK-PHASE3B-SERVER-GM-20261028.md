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
