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

## 2026-10-12 follow-up: historical tab triangulation (READ ONLY)

**Scope and privacy.** Verified the live source tab against older `CA List 20260718`, `CA List 20260622`, `[new] CA MAP 202608`, `[new] CA MAP 202606` and `CA MAP 202604`, using matching normalized trainer keys only inside the read-only comparison and matching literal Campfire links/name/prefecture in map tabs. Only anonymous *current source grid row numbers*, Boolean comparisons and rough geographic separation are recorded below. This historical comparison **cannot prove present-day ownership of a Campfire ID**. Existing restored DB link differences remain as recorded above; no live production DB read or changes occurred.

| Current Sheet row | Independent historical evidence | Safe provisional classification | Required human evidence before changing anything |
| --- | --- | --- | --- |
| **7** | New 2nd CA not present in June/July lists. Current URL duplicates row 115 although names differ (locations about 4 km apart). Earlier April/June map includes the row-7-style group identity **with a different URL**; absent under that identity from August map. | `NEW_2ND_CA_URL_AMBIGUITY`. Potential copied/stale link, **not established**. | CA/group owner confirms which live Campfire group the 2nd CA belongs to; compare its actual in-app share link to row 115 and historical group. Do not reassign from proximity/name alone. |
| **13** | New 2nd CA absent from June/July lists. Same prefecture and group display name as established row **175** (1st), but **different URL IDs**. Historic April/June/August maps support row-175 association. | `NEW_2ND_CA_DIFFERENT_ID` (maybe migration/new group). | Confirm whether both CAs really belong to one Campfire Community and which UUID is the active authoritative group. Preserve aliases as history if migration confirmed. |
| **17** | 2nd CA already listed in July with **no URL**. Same prefecture/name as row **128** (1st) in current list, and map tabs support row 128 going back to April. Source also lacks coordinates. | `SECONDARY_MISSING_LINK_POSSIBLE_SHARED_GROUP`; highest-confidence **candidate for owner verification**, not auto repair. | Row 128 group owner confirms 2nd CA membership and provides the same canonical share URL if appropriate; obtain event/geographic location independently. |
| **34** | Source URL is a short **38-character bare deep link**, with no `deep_link_sub1` encoded Community ID. The same URL and listed prefecture/name exist in July/June lists and April/June/August maps. Listed prefecture disagrees with the coordinates and geographic region stated in self-description. Display name also resembles row 198, but URLs and regions differ. | `INCOMPLETE_DEEPLINK_AND_GEO_REVIEW`. Historical propagation of defective link format is verified; intended Community ID remains **unknown**. | Authorized CA provides a full in-app Campfire group share URL with resolvable ID and confirms current activity prefecture/location. Never infer the missing ID from similarly named row 198. |
| **60 / 116** | Both 1st CAs have literally **the same UUID-bearing URL**, but distinct group names, about **18 km apart**. This duplication persists in April, June and August map tabs and both historical CA lists. Restored DB has different associations for these CAs; their shared source ID is absent from the restored current/history Community ID sets. | `PERSISTENT_CROSS_GROUP_LINK_COLLISION`, **two independent authoritative confirmations required**. | Ask each group owner to share its *current* Campfire group link, verify whether one group actually contains both CAs vs two separate groups. Never collapse distinct groups into one ID solely because the source shares a URL. |
| **94** | 1st CA source UUID-bearing URL is shared by row **177** (another 1st), with different group names and positions about **8 km apart**; appears unchanged in all three map tabs. Same display name/prefecture as 2nd CA row **29**, but that row has a different URL. Restored history cites `manual-hokkaido-repair` and DB current link differs. | `MANUAL_REPAIR_HISTORICAL_COLLISION` (high risk of undoing prior correction). | Recheck the documented prior manual intervention, and get authoritative Campfire links/assignments for rows 29, 94 and 177. Preserve verified Identity, medals and old links. |
| **100** | Source link, name and prefecture are stable for that CA in June/July lists and April/June/August maps. The discrepancy is in the restored DB's current association versus source; restored history includes a retired alias. | `STABLE_SOURCE_VS_DB_ALIAS`. Strong historical consistency, **not proof** current database mapping is obsolete. | Confirm present live Campfire link and prior alias/retirement provenance. Retain the old association until separately approved safe migration; do not auto-delete. |

### Mandatory secondary review beyond the eight P0 rows

- **7/115** and **94/177** already involved above, **60/116** covered above.
- **144/159/199:** same URL attached to differing Community names since the older map tabs. All in same listed prefecture, locations within about 1 km. One name changed in the August map: a genuine rename is plausible but not proven. Source owner must decide canonical current Community identity or distinct groups; do **not** treat nearby coordinates as ownership evidence.
- **175/198:** same URL shared by distinct listed prefectures and group names, with locations roughly 29 km apart; duplicate link already present in April map. Both owners must confirm independent current group IDs or prove a cross-prefecture single group.
- **13/175, 17/128, 29/94:** the same group name/prefecture with differing or missing links, potentially 1st/2nd CA assignments; obtain membership and current group ID proof before joining or splitting assignments.
- **Important:** resolving just 8 P0 rows does **not** automatically satisfy the actual source preflight; ALL remaining cross-name UUID collisions and unresolved IDs must be adjudicated, including P1-only group 144/159/199 and 175/198.

### Minimal safe review workflow

1. Ask each involved Community owner for the current in-app *share link*, the group's current display name, prefecture and whether they are 1st/2nd CA of the **same** group. Record evidence privately (no URLs or personal identifiers in this public PR).
2. Independently compare owner-submitted decoded Community IDs with (a) current source, (b) July/June historic lists, (c) April/June/August map links, (d) the operator's read-only restored DB alias/link report. If owner answers conflict, remain `UNRESOLVED`.
3. Submit a **separate** source-owner correction proposal if the Sheet is wrong, or a reviewed database migration if the DB association is wrong. A displayed rename alone should not delete or reassign verified Identity.
4. Re-run source preflight and frozen pair comparison **without writes**; only a fully adjudicated, privately attested baseline could then advance this gate.
5. Do not run live CA Master sync, create `ca-master-verified-baseline`, touch the 2099 sentinel, merge PRs or perform production SQL/Edge/Cron changes.

**2026-10-12 outcome:** `HISTORICAL_TRIANGULATION=COMPLETE`; `ROW_17=VERIFY_POSSIBLE_SHARED_1ST_2ND_GROUP`; `ROW_34=CONFIRMED_MISSING_DEEPLINK_ID`; `HUMAN_COMMUNITY_ID_ATTESTATION=PENDING`; `SOURCE_RECONCILIATION=NO_GO`.

## 2026-10-12: operator-supplied Campfire share-link inspection, row 17

- The operator provided a **current Campfire group share link in direct response to the request for source row 17**. Link encoding decoded successfully into a syntactically valid UUID.
- **Verified against the current read-only Sheet**: decoded UUID and full share link match exactly the Community link already recorded for row **128** (listed 1st CA); row **17** is listed 2nd CA under the same Community display name and prefecture but its source `H17` link is blank. Historical July list independently confirms the 2nd CA is present with an empty link and the 1st CA uses the same link.
- **Decision:** `ROW_17_SHARE_URL_MATCH_CONFIRMED_BY_OPERATOR`. `H17` is a **specific source-only fill candidate**, *not* an approved sheet write, proof of current 2nd CA accreditation, confirmation of coordinate values or authorization for DB re-assignment. Do not automatically fill `J17/K17`; those need separate factual geographic evidence.
- Raw share URL, UUID, personal CA names and credentials are intentionally omitted from the public repository. Re-check the canonical source via private evidence before any authorized patch.
- Row 17's URL ambiguity has a **candidate resolution** but **source correction not yet applied**. Row 34 and remaining independent P0/P1 conflicts still block the global CA-master preflight; 2099 emergency STOP unchanged.


## 2026-10-12: operator clarification on the multi-prefecture "夜活" network (READ ONLY)

The project operator explained that the Night Activity (夜活) organization is **special: there is one CA in Hyogo and one in Osaka**. These multi-prefecture community operations are therefore potentially intentional and MUST NOT be treated as duplicate CAs, illegitimate memberships or a reason to merge/rename/delete groups.

Fresh source-only comparison of the visible CA master (gid `633821294`):
- **Row 175:** 1st CA; Night Activity group labelled **KOBE**; prefecture **Hyogo**.
- **Row 198:** 1st CA; Osaka Night Activity group; prefecture **Osaka**.
- **Row 34:** 2nd CA; **same Osaka Night Activity display name and coordinates as row 198**. Its `Primary City` field nevertheless says **Aichi**, while its self-description explicitly says **Osaka** and its short group URL lacks the encoded Community ID.
- **Rows 175 and 198 share the same Community-ID-bearing source URL** in the currently visible Sheet. This is *not* proof they are the same current Campfire group, since cross-prefecture shared operational branding is distinct from in-app group identity; the operator needs to confirm whether Kobe and Osaka share one Campfire club or represent two independent clubs.
- **Row 34 is an additional 2nd CA record** and should not be silently discarded simply because the operator described one CA in each prefecture. Whether this is a current 1st/2nd assignment or an out-of-date row is still unverified.

**Revised issue split:**
1. `NIGHT_ACTIVITY_GEOGRAPHY=EXPLAINED_OPERATOR_CONTEXT`: Hyogo/Osaka dual-region branding is expected; do not consider different prefectures alone an error.
2. `ROW_34_SOURCE_AICHI_VS_OSAKA=PENDING_CONFIRMATION`: specific source-field mismatch remains; do not change automatically.
3. `ROW_34_SHORT_URL=PENDING_FULL_LINK`: must obtain the current correct Osaka group share link; no URL or Community ID inference from row 198 yet.
4. `ROW_175_198_SAME_URL=PENDING_GROUP_ID_ATTESTATION`: whether the two regional Night Activity groups share one physical Campfire group needs one explicit operator answer.
5. `ROW_34_2ND_RELATION=PENDING_CONFIRMATION`: no automated personnel change or link migration.

This supersedes any premature inference that cross-prefecture Night Activity rows are automatically duplicate or corrupt. Only the source's *specific* Aichi/Osaka mismatch and unresolved encoded link remain evident. Google Sheets, production Supabase and CA identities remain untouched; release STOP.

## 2026-10-12: Night Activity three-group screenshot cross-check and long-term link audit

**Campfire display evidence, supplied directly by the operator (screenshots retained in the conversation, not uploaded to public GitHub):**
- Osaka City `夜活 Pokémon GO`: 25,517 displayed members.
- Kobe Nada-area `夜活Pokémon GO WEST`: 883 displayed members.
- Kobe central `夜活Pokémon GO KOBE`: 1,529 displayed members.
These are **three visibly distinct Campfire map entries**. Their screenshot cards do **not** contain the group UUID or evidence of the actual 1st/2nd CA assignments. Therefore an ID-to-group mapping is a hypothesis until verified using each group's live **Share** link.

**Read-only source matrix, exact sheet `[new]CA List 20260828`:**

| Current sheet row | Source group | Prefecture in source | CA role in source | URL classification |
| --- | --- | --- | --- | --- |
| 11 | `夜活Pokémon GO WEST` | Hyogo | 1st | `WEST_SOURCE_ID` (valid and distinct) |
| 13 | `夜活Pokémon GO KOBE` | Hyogo | 2nd | `KOBE_2ND_SOURCE_ID` (valid and distinct) |
| 34 | `夜活 Pokémon GO` | **Aichi** (while coordinates/self-description indicate Osaka) | 2nd | `NO_DECODED_COMMUNITY_ID`: URL is short/incomplete |
| 175 | `夜活Pokémon GO KOBE` | Hyogo | 1st | `OSAKA_SOURCE_ID` (**matches row 198 exactly**) |
| 198 | `夜活 Pokémon GO` | Osaka | 1st | `OSAKA_SOURCE_ID` (valid) |

There are five source records and exactly three **distinct decoded IDs** among the four parseable source links, plus one unresolved short link. This count matching three screenshot groups is **not sufficient to prove their assignment**.

**Historical pattern checked read-only:**
- KOBE **1st CA**'s ID being identical to the Osaka **1st CA** source ID is not a newly introduced typo: it appears in the **2026-04-20, 2026-06-22, 2026-06-25, 2026-07-18** CA lists and **2026-03, 2026-04, 2026-06, 2026-08** CA maps.
- KOBE **2nd CA**'s distinct UUID and WEST source row are **newer than the July CA list**; the candidate mapping to the screenshot KOBE/WEST groups is plausible but NOT yet confirmed by an independent share-link source.
- Row 34's bare/no-ID URL and source Aichi-vs-Osaka mismatch were likewise carried in prior 2026 lists; do not assume correcting the label solves all ID conflicts.
- The distinct older `西三河 夜活部` (Aichi) entry is a **different group-name and decoded ID** in earlier source records; do not map it to row 34 merely from the word `夜活`.

**Provisional per-row actions (none authorized yet):**
1. Obtain direct live share links for **all three screenshot groups**, in this order: KOBE, WEST, Osaka. Decode and match each independently to `KOBE_2ND_SOURCE_ID`, `WEST_SOURCE_ID`, `OSAKA_SOURCE_ID` without exposing the raw IDs in this public file.
2. **Row 175**: only if KOBE live share ID matches row 13 and differs from row 198, propose correcting KOBE 1st link to KOBE's validated ID; verify actual 1st/2nd CA status separately.
3. **Row 34**: only if Osaka live share ID matches row 198, propose adding its full link, and investigate whether its Aichi prefecture is a source entry mistake; confirm current 2nd CA membership independently.
4. Confirm row 11 WEST assignment and whether its linked id matches the WEST share. Do not discard distinct WEST entry.
5. After explicit source-owner approval, re-run frozen source-to-restored-db association diff **read-only**. Do not automatically delete/merge old CA-Community links, identities, medals or exchanges.

**Status:** `NIGHT_ACTIVITY_THREE_DISPLAYED_GROUPS=VISUALLY_CONFIRMED`; `NIGHT_ACTIVITY_DECODED_SOURCE_IDS=THREE`; `NIGHT_ACTIVITY_GROUP_ID_OWNER_ATTESTATION=PENDING`; `NIGHT_ACTIVITY_SOURCE_CORRECTION=NOT_AUTHORIZED`; `MASTER_SYNC=STOP`. No live Sheet or Supabase writes. No PR merge.

## 2026-10-12: operator-shared live KOBE link verification (READ ONLY)

The operator supplied the **live Campfire share link for the screenshot-labelled `夜活Pokémon GO KOBE`**. The decoded Community UUID and full canonical URL were compared against source values in the current CA Master tab (gid 633821294):

- **Row 13, KOBE 2nd CA:** **EXACT MATCH** to operator-provided KOBE group share link.
- **Row 175, KOBE 1st CA:** **MISMATCH**. Its source share link matches **row 198 (Osaka 1st CA)** instead.
- **Rows 11 (WEST) and 198 (Osaka):** their source links differ from the operator-provided KOBE link.
- **Row 34 (Osaka 2nd):** still has an incomplete short URL without decoded Community ID.

**Provisional corrective action:** row 175 H175 has a **high-confidence wrong-source-link candidate**: suggest the already independently matched row 13 KOBE share link, **subject to approval of current 1st/2nd group membership and private restored-DB alias comparison**. Do not infer that row 175's present verified Identity should be deleted or transferred. Row 13 itself needs no URL correction on currently available evidence.

**Still outstanding:** independently receive and compare current share links for WEST and Osaka; verify whether source row 34 (2nd) belongs to Osaka and confirm its prefecture; identify any separate source/DB stale association. Do not publish the operator's raw share link, UUID, CA names or credentials in this public file.

**Status:** `KOBE_OPERATOR_LINK_CHECK=EXACT_MATCH_ROW_13`; `KOBE_1ST_ROW_175_SOURCE_LINK=CORRECTION_CANDIDATE`; `SOURCE_CHANGES=NONE`; `PRODUCTION_CHANGES=NONE`; `CA_MASTER_SYNC=STOP`.

## 2026-10-12: operator-shared live WEST link verification (READ ONLY)

The operator supplied a fresh share link for the screenshot-labelled `夜活Pokémon GO WEST` (Hyogo, Kobe/Nada area). The share link's decoded Community UUID and full URL were compared **read-only** against the current authoritative CA Master tab `[new]CA List 20260828` (gid `633821294`).

- **Row 11** (`夜活Pokémon GO WEST`, 1st CA, Hyogo): **FULL SHARE URL EXACT MATCH / UUID MATCH**.
- A bounded scan of the **200 current CA source entries** found **only row 11** using that exact WEST share URL, so no source duplication of this particular link.
- The provided WEST UUID differs from the sources on **row 13** (KOBE 2nd CA), **row 175** (KOBE 1st, currently points to the Osaka source UUID) and **row 198** (Osaka 1st). Row 34 is still undecodable.

**Disposition:** `WEST_ROW_11_OPERATOR_LINK_VERIFIED`; **NO URL CORRECTION IS WARRANTED FOR ROW 11** on current evidence. This checks the actual share link, not the authenticity/continued CA program standing of the 1st CA. No other previously unresolved Night Activity assignment is declared resolved here.

**Next:** obtain operator's *Osaka* `夜活 Pokémon GO` link from the distinct 25,517-member map entry to confirm row 198 and evaluate source row 34's missing ID; consider source row 175 only after KOBE membership and a privately approved edit proposal. Raw operator URL and Community UUID are deliberately omitted from the public repository.

**No source Sheet edits, database writes, deployments, Cron changes, 2099 sentinel changes, merges, or approved baseline**. Global CA Master remains `REVIEW_REQUIRED_SYNC_STOP`.
