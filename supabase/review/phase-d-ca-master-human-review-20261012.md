# Phase D — CA master discrepancy review register (2026-10-12 JST)

> **REVIEW ONLY / NO PRODUCTION EDITS / NO MASTER SYNC.**
> Sources: private 2026-10-12 local restored-database comparison (anonymous aggregate/row-number evidence) and `phase-d-live-ca-master-source-snapshot-20261012.md`.
> This is an **operator action register**, not a statement that any sheet row is wrong. Row numbers are 1-based, including header row 1. Never commit personal names, emails, IDs, exact Campfire URLs or private raw comparison data here.

## Quantitative gate

| Check | Evidence |
| --- | --- |
| Normalized CA source keys | 200 Sheet / 200 restored DB, matching |
| Parsed Sheet CA–Community pairs | 198 |
| Current restored DB CA–Community links | 196 |
| Sheet pairs not in DB links | 5 (rows 7, 13, 60, 94, 116) |
| Current DB pairs not in Sheet | 4 (row references 94, 100, 60, 116) |
| Sheet Community ID not found current/history | 1 ID (shared by 60 and 116) |
| Sheet unresolved Campfire ID | rows 17, 34 |
| Approved manually verified baseline | 0 (NOT SET) |
| Sync release status | `REVIEW_REQUIRED_SYNC_STOP` |

## Triage order and required **human** decisions

| Priority | Sheet row(s) | Existing non-private evidence | Required disposition, NOT auto-fix |
| --- | --- | --- | --- |
| P0 | 7 | Sheet pair absent from current DB association; history reports active current ID, current CA association count 0 | Confirm whether this CA is attached to the intended Community and how its current/historical aliases should be represented |
| P0 | 13 | Sheet pair not in current DB links; historical ID marked retired by `campfire-public-map`; no current CA association | Confirm live status and whether retired alias is still relevant; **history label is not authoritative live status** |
| P0 | 60, 116 | Both use an ID that is absent from current + historical DB ID sets; each has one different current association; same URL has conflicting community identity within source | Verify authoritative ID and geographic/name identity for both rows; no inferred reassignment |
| P0 | 94 | Sheet pair absent from DB current link; DB has different current link; ID active with `manual-hokkaido-repair` history; overlaps with row 177 URL group | Independently verify prior manual repair and current source mapping before any proposed change |
| P0 | 100 | DB-only current pairing; history also contains a retired ID, and Sheet ID maps as an alias for this CA | Classify whether the current association and alias both remain valid |
| P0 | 17 | Sheet Campfire URL and ID missing; coordinate also missing; matches Community prefecture/name identity of row 128 | Ask for authoritative published Community ID/URL or retain explicit unresolved state; do not fabricate coordinates |
| P0 | 34 | URL exists but ID unparseable/unresolved; **2026-10-12 read-only Sheet spot check** found a source prefecture vs coordinate/self-description geography mismatch | Confirm intended prefecture/coordinates and actual current Campfire ID with an authorized owner; leave source unchanged pending review |
| P1 | 7 / 115 | Same URL, different normalized name | Confirm rename vs separate per-CA text vs incorrect data |
| P1 | 60 / 116 | Same URL, different normalized name | Examine with above P0 pair discrepancy; avoid duplicate uncoordinated edits |
| P1 | 94 / 177 | Same URL, different normalized name | Examine with above P0 prior repair |
| P1 | 144 / 159 / 199 | Same URL, different normalized names | Confirm canonical display identity and whether distinct CA assignments are intentional |
| P1 | 175 / 198 | Same URL, differing Community identity **and prefecture** | Confirm authoritative prefecture; changes to geographic ownership require explicit review |
| P1 | 13 / 175 | Same prefecture/name represented under multiple distinct IDs | Confirm historical vs current ID and any legitimate migration |
| P1 | 17 / 128 | Same prefecture/name represented with unresolved/different IDs | Resolve row 17 before considering de-duplication |
| P1 | 29 / 94 | Same prefecture/name represented under different IDs | Verify aliases, canonical ID and whether both should survive |

## Operator-only review decision template (retain private details OFF GitHub)

For each unique issue, record *in a protected private workspace*: sheet row(s), observed source and DB relationship, **publicly verifiable evidence captured at date/time**, intended current Community (if known), historical alias handling, whether relevant CA has a verified Identity/medal, reviewer, approving operator, and a disposition code:

- `VALID_EXISTING_ALIAS`: no data change required, documented equivalence.
- `SOURCE_RENAME_REVIEW`: source correction may be proposed only after human approval.
- `DB_MAPPING_REVIEW`: existing DB association needs a **separate** safe migration design.
- `LEGITIMATE_MULTI_CA`: shared Community ID confirmed to represent multiple CA relationships.
- `UNRESOLVED`: stop remains.

Disposition is **not permission to run SQL**; no auto-merge, rename, retire, delete or insert is authorized.

## Conditions for concluding source review

1. Every P0 and P1 conflict has an explicit recorded disposition and appropriate evidence. No unresolved or silently skipped source rows.
2. Local-only source-to-DB comparison is rerun against a dated frozen source snapshot and disposable restored data; any difference is explained and approved (not just a count match).
3. Verified Identity, primary assignment and medal ownership must not be lost through a proposed mapping change. Existing CA association links must not be auto-pruned.
4. A human explicitly attests the source row count and unique CA baseline. Do not forge a `ca-master-verified-baseline` merely because 200 keys match.
5. Only after source review AND isolated technical E2E pass may a separately authorized controlled sync be considered. Maintain 2099 pause and dedicated gate OFF meanwhile.

**Current review disposition: ALL ROWS PENDING. No production or source Sheet mutations performed.**

## Supplemental live Sheet read-only spot check (2026-10-12 JST)

- Confirmed the same listed five same-URL/name-disagreement groups persist in the exact visible source tab `[new]CA List 20260828`, gid `633821294`. Equal URLs are evidence of a shared link, **not** proof of canonical Community identity or CA affiliation.
- Row **17** still lacks source URL and coordinates. Row **34** still has an unresolved/unparseable URL-to-ID representation, and its listed prefecture conflicts with the geographic region indicated by its coordinate/self-description. This needs **human source-owner review**; no automatic correction is justified.
- Row **34** shares a Community display name with row **198**, but their URL values are **not equal**, and listed prefectures differ. Do not merge them using the display name alone.
- Sheets were read-only; no account/member identifiers, raw URLs, map coordinates or private identities have been committed here.

**Source reconciliation remains REVIEW_REQUIRED_SYNC_STOP.**
