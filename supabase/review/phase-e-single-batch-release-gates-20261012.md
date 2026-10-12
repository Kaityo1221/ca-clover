# Phase E | ONE-BATCH CA Master safety disposition (2026-10-12 JST)

**STATUS: SOURCE RECONCILIATION READY FOR APPROVAL / PRODUCTION CA-MASTER SYNC STOP.**  
**Intent:** collapse piecemeal investigation into one evidence-backed review and one guarded release sequence. No user-identifying IDs, Campfire raw URLs, credentials, or screenshots belong in this public file.

## 1. Verified today (live, READ ONLY)

| Check | Result |
| --- | --- |
| Latest CA Sheet rows | 200 CA records, `[new]CA List 20260828` |
| Current production CA records | 200 |
| Current production CA/community relations | 196 |
| Direct matching source Club IDs to current DB relations | **192** |
| Source Club ID unmatched to member's current DB Club | **6 source rows: 7, 13, 60, 94, 100, 116** |
| Source URL missing/unparseable | **2 source rows: 17, 34** |
| Production CA identities | **7** |
| Production medals | **14** |
| Source-only changeable rows with **existing DB matching current operator-confirmed Club IDs** | **H60, H94, H116** |
| If only those three verified source H-cell candidates were applied | Direct matched pairs would rise **192 -> 195** (simulation only) |
| Production CA master dedicated gate | **NOT PRESENT** |
| Production identity composite FK | **ON DELETE CASCADE (unsafe)** |
| Production verified source baseline | **0** |
| Production master emergency sentinel | **2099-01-01, active** |
| Production `sync-ca-master` Edge | **v4 ACTIVE**, do not call |
| Production `sync-campfire-auto` Edge | **v10 ACTIVE**, keep normal Meetup/icon collection separate |
| Synthetic/CI safety test run | PR #128/#130/#131 CI **PASS** |
| Private Windows restored DB baseline | 6 identities / 13 medals, older snapshot than now-live 7 / 14 |

**Scope limitation:** Full live and restored user-by-user identities, Auth OAuth, Media decode for 3 archive objects, Edge and Cron E2E cannot be adjudicated by count-only read queries; none of these are asserted PASS. Source and database matching by Club UUID is not in itself proof of first/second CA role at the event date.

## 2. Single batch decision matrix

All Sheet edits below are **proposals only**. Never type Campfire UUIDs/URLs into public GitHub. The exact previously operator-supplied URLs remain solely in the private approval channel / authorized master document.

| Source rows / field | Case | Batch disposition | Risk classification |
| --- | --- | --- | --- |
| **H60** | Tokushima Anan, operator-confirmed current group link | Replace with independently shared Anan link; **DB already carries this intended Club ID** | **SOURCE_ONLY_READY** (separate explicit owner edit authorization required) |
| **H94** | Hokkaido Higashikagura 1st, confirmed same community as 2nd | Set H94 equal to **H29**; both roles confirmed, DB already carries this Club ID | **SOURCE_ONLY_READY** |
| **H116** | Tokushima city, operator-confirmed current group link | Replace with independently shared Tokushima city link; **DB already carries this intended Club ID** | **SOURCE_ONLY_READY** |
| **G7** | Old Takatsuki group label | Operator-documented rename to AMaGO, same live H7/H115 Club ID; G7 -> G115. J/K only if community-based coordinates verified | **DISPLAY_ONLY_READY; DB relation missing** |
| **H13** | Kobe Night Activity 2nd | Current H13 link already valid; **do not change Sheet**. Need isolated **add-only** protected DB CA relation proof | **DB_RECONCILE_PROTECTED** |
| **H17** | Kagoshima 2nd link absent | H17 <- H128 is supported by 1st source link but current 2nd affiliation must be separately verified; no invented coordinates | **SOURCE_AND_DB_REVIEW** |
| **H34 / I34** | Osaka Night Activity 2nd | Operator-confirmed Osaka CA membership; propose H34 <- H198, I34 <- I198; **DB current relation absent** | **SOURCE_AND_DB_REVIEW** |
| **H175** | Kobe Night Activity 1st | Operator-confirmed this CA currently belongs to Kobe; propose H175 <- H13. DB currently linked elsewhere; **no automatic delete/reassignment** | **SOURCE_AND_DB_REVIEW** |
| **G159 / H159** | Yamato renamed to Sakura Walk; outgoing first CA retirement planned | Community name change operator confirmed (G159 -> G58). H159 currently points to Mahoroba; proposal H159 <- H58 pending current outgoing affiliation & history review. **Do not mark retirement/succession active early** | **SOURCE_AND_DB_REVIEW** |
| **H100** | Chiba | Historical Sheet Club ID stable; different current DB Club linked, old historical alias includes Sheet ID. **Do not edit Sheet or delete DB association** until protected alias / lineage review | **HISTORICAL_ALIAS_REVIEW** |
| **7 / 13 DB relation** | Missing from current DB despite source identities being listed | **Add-only review**, must protect any existing identity, own-medal, historical exchanges | **DB_RECONCILE_PROTECTED** |
| **H29 / H176 / H177 / H144 / H199** | Independently verified current Clubs | Correct as supplied; **leave unchanged** | **NO_CHANGE** |

**Critical rule:** do **not** apply all proposed H-cell changes as a blind Google Sheet batch. When a current DB association is absent or points to a different Club, a correct source cell could cause a naive differential updater to attempt deletions. The source-only three-cell step is separable precisely because those three proposed Club IDs already match live DB relations.

## 3. Restore is important but no longer today's exact baseline

- Private Windows/PostgreSQL restore proved structure, the FK inventory, owned sequence adjustment, and core Auth/Storage objects can be restored. Retain original SHA-256 backup manifest and encrypted archive. Do not erase either.
- Restored snapshot contains **6** CA identities and **13** medals. Production now has **7** and **14** respectively. **Do not roll production back to the older snapshot.**
- Latest live backup must include complete relational identity joins, not only counts: Auth identities, profiles, ownership, medal designs, exchanges/reunions, CA links/alias IDs, schemas/roles/RLS/triggers, Storage and deployed Edge/Cron state.
- Three undecodable images and full Google OAuth/real Edge/Storage/Cron E2E remain separately documented review points. Inability to execute the user's private Windows Docker restore from this cloud connector is **not** a PASS.
- A one-shot **READ ONLY** aggregated production preflight is supplied in `phase-e-production-readonly-stop-preflight-20261012.sql`. It captures current gate, sentinel, FK, baseline, orphan identity and mutable collection counts. It is **not** a backup and never resumes sync.

## 4. Shortest safe release sequence (single decision packet)

1. **Freeze/protect latest production data privately**. Compare current live identities/medals to the older locally restored snapshot; prepare a reversible, verified copy of the *new* data before any writes. Per-person keys should be compared in a private location only.
2. **Approve and perform three isolated source-only URL changes H60, H94, H116**. Re-read the authoritative source and verify each target existing DB group UUID matches. The other source/DB cases remain in isolated manual review. This is a **separate Sheet-owner authorization** and is **not** performed here.
3. **Run protected isolated local rehearsal** against fresh restored dataset: gate OFF; FK RESTRICT; current code; authorized add-only CA links; identity/medal/design/exchange no-loss; partial-failure rollback and intentional-stop checks; complete OAuth/Edge/Storage/Cron E2E or explicitly accept the corresponding residual as STOP.
4. **Prepare production protection with emergency sentinel retained**. After independent review and separate production-change authorization only: dedicated gate OFF default, FK RESTRICT, protected RPC/leases, legacy endpoints 410, Edge gate deployment that preserves existing Campfire auto v10 logic; all direct, admin, cron, Next.js paths fail closed. Never restart v4.
5. **Approve verified baseline from reviewed current source+DB pairs**, never a guessed `success` sync run; audited one-time targeted master sync only after an independent authorization. Check that deleted/moved identity-linked keys, medals, and exchanges all equal zero. Do not treat "counts equal" as per-user no-loss proof.
6. **Resume recurring master sync** only after a second, explicit review and authorization. The 2099 sentinel is retained until that point.

### STOP / mandatory approvals

- **STOP at present**: steps 1-3 have not fully passed, source still has unresolved history, production dedicated gate absent, FK still CASCADE and verified baseline absent.
- **No automatic actions**: do not modify master Sheet, production Supabase, Edge, Cron, sentinel, auth, user identities, medals, or merge safety PRs from this document.
- UI-only independent changes do not clear the CA-master release gate.
- Final approvals should be **batched at safety gate milestones**, never for each row or screenshot. Stop only where human ownership/production data change has genuine risk.

**Source audit**: 2026-10-12 read-only Google Sheet tab, current production SQL by key/Club group, historical CA List/CA MAP tabs, prior operator group-link/rename confirmation, and PR #131 `phase-d-ca-master-human-review-20261012.md`. No unverified enrollment/migration is presented as done.
