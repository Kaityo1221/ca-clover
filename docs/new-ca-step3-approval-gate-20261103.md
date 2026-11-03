# STEP 3 isolated approval gate and atomic commit verification (2026-11-03)

## Implemented
- `src/app/api/new-ca/approve/route.js` as a preview-only HTTP POST endpoint.
- Required layers: isolated bridge branch/DB guard, extra approval write gate `NEW_CA_ISOLATED_APPROVAL_ENABLED`, same Origin, JSON-only exact two-field body, bearer, Supabase Auth `getUser` and fresh `profiles.role=admin`, fresh Discord member role check.
- No CA activation or SQL write occurs in the new HTTP route. The approval write gate is **unset and closed**, and absence of trusted Campfire / pending-user validators stops all requests. Turning flags on alone can never activate a CA; the route explicitly returns `ATOMIC_FINALIZER_NOT_CONNECTED`.
- `src/components/new-ca-preflight-panel.tsx` provides a clearly labeled approval gate diagnostic, with official approval visibly locked.

## Validation
- In-memory HTTP mock: closed approval gate 503, cross-origin 403, invalid request 400, live Discord unavailable 409: **4/4 PASS**.
- Vercel preview deployment built successfully.
- Live isolated Neon SQL transaction (SAVEPOINT, then rollback): matching verified synthetic CA link first approval `isolated_finalized`, repeat `already_finalized`, exactly one finalization + audit; after rollback finalized=0 and links=0. No persistent changes.

## Critical blockers
- STEP1 pending Google applicant real-account E2E not performed.
- STEP2 Discord bot current-role authorization is not configured; verified Campfire resolver has not been implemented.
- The HTTP route is intentionally **not connected** to the isolated finalizer. A server-owned immutable trusted evidence pipeline and revocation/competition tests must precede this.
- Production schema RPC candidate remains review-only, not deployed or verified against isolated Supabase Auth.
- No production CA role, Community, medals, Meetup, or identities have been modified.

**STEP3: HTTP authorization gate implemented and tested, isolated SQL finalizer tested; end-to-end official admin approval not completed. Production NO-GO.**
