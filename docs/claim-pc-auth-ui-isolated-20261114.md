# CA Clover: PC-only Google Auth integration (Draft / NO-GO)

## Purpose and scope

This branch builds **on top of Draft PR #294**, without merging or deploying anything.
It allows the actual CA Clover Next.js UI to use the separate, already-running
PC Supabase Auth lab after an explicit **local development** opt-in.

The successful standalone PC Discord QA is evidence for its own flow only.
It **does not** create the server-issued proof required by Backend PR #74,
which has a fixed cloud-isolated project/preview/Discord-client contract.

## Exact isolation contract

- Next.js must be run with NODE_ENV=development and CA_CLOVER_PC_AUTH_QA=enabled
  on a Windows machine. Any Vercel environment disables this mode.
- Browser origin must be exactly http://127.0.0.1:56490.
- Browser Supabase endpoint must be exactly http://127.0.0.1:56321.
- Only a local-style anon JWT is accepted; service_role and any known hosted
  project ref are rejected. Local anon JWTs can have no project ref.
- /api/* routes always return 503 in this lab.
- Server admin Supabase client **never** accepts localhost.
- Hosted Preview/Production selection and canonical redirects are unchanged.
- No Docker stop/start, SQL, registration, DB write, grant, deployment or
  OAuth code reuse happens inside the launcher.
- The original existing CA login flow is unchanged in hosted environments.

## Run the actual CA Clover UI locally (PC)

Prerequisites: Docker already running and the exact isolated Auth lab
ca-clover-claim-pcqa-20261114 healthy at port 56321; Node >=22 and Git.
The earlier standalone QA server occupying 56490 must first be stopped
(Ctrl+C in **only its node server terminal**). Do not stop Docker.

Clone this separate feature branch to a new directory:

```powershell
Set-Location "$env:USERPROFILE\Downloads"
git clone --branch feature/claim-pc-auth-ui-local-isolated-20261114 --single-branch https://github.com/Kaityo1221/ca-clover.git ca-clover-pcqa-frontend
Set-Location .\ca-clover-pcqa-frontend
npm ci
node .\scripts\qa\launch-local-claim-auth-ui.mjs
```

Alternatively, if already cloned, fetch and switch to the exact branch before
running npm ci and the launcher. Never run this against main or Production.

The launcher reads **only** the exact local lab's Supabase CLI `status --output env`
and keeps the local anon key in process memory; it does not log keys.
It stops if the project id, localhost API URL, key, Git branch,
dependencies, or port are wrong.

Open http://127.0.0.1:56490/login and sign in with Google. Confirm the
local CA Clover login page recognizes the user's session. The Auth provider
must allow the local `http://127.0.0.1:56490` return URL.
Do not share any URL fragments containing OAuth tokens.

## Known BLOCKED gates (do NOT mark PASS)

1. The PC Auth DB currently has Google identity/session; the complete
   public.profiles, user_permissions, Community claims, CA master/Meetup
   and administrator schema has **not** been proven installed.
   As a result /account and /my will safely fail closed until an independent
   migration/restore plan is reviewed.
2. The real Backend PR #74 Edge requires a distinct hosted Supabase ref and a
   pinned HTTPS Preview origin. It does not accept this PC lab or the newly
   created Discord test application. Do not bypass those protections by
   modifying an Edge secret or reusing the standalone QA proof.
3. No native Next frontend -> OAuth Edge -> DB proof / admin approval E2E yet.
4. Existing approved CAs' login must have regression tests before production.
5. Backend SOURCE_MANIFEST SHA protection and actual Safari checks remain.

**Current release gate: NO-GO.** Existing Lab's 15 users, hosted systems,
PRs #293/#294 and Backend #73/#74 are not altered by local launcher execution.
