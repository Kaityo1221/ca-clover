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

## 2026-10-12: Osaka Night Activity public Meetup screenshot (READ ONLY)

The operator supplied a `cmpf.re` **Meetup short URL**, followed by a screenshot of the opened Campfire Meetup page. An external independent redirect fetch could **not** resolve the short URL in this review environment. Accordingly neither Meetup UUID nor actual `clubId` was programmatically recovered; **do not claim automatic verified event-to-Community ID matching**.

**Direct screenshot evidence:**
- Public Meetup on **2026-10-10**, Osaka **Diamor Osaka** area, **Zorua Community Day**.
- Group card explicitly reads `夜活 Pokémon GO` and displays the same group picture as the Osaka group screenshot provided by the operator.
- Host card displays a purple CA badge and a public display handle **visually similar to** (but not character-for-character identical with) the current master row **198** 1st CA's Discord account handle. Source row 198 trainer name itself does **not** appear in the screenshot. Therefore current 1st CA's precise account identity is still a **strong candidate**, **not independently authenticated**.
- The host is the organizer of **this Meetup**, which does **not** alone prove they are the 1st CA; 2nd CAs can also host.
- The displayed meetup page does not show immutable `clubId` or machine-readable `creator.username`, so **row 198's encoded source ID remains unverified against the live Osaka Club**, and row 34's short link remains unresolved.

**Read-only triage update:** `OSAKA_MEETUP_GROUP_NAME_AND_CA_BADGE=SCREENSHOT_CONFIRMED`; `OSAKA_HOST_SOURCE_HANDLE=SIMILAR_NOT_VERIFIED`; `OSAKA_LIVE_GROUP_UUID=AWAITING_SHARE_LINK_OR_VERIFIED_EVENT_API`; `OSAKA_1ST_PRIMARY_STATUS=SOURCE_ONLY`.

**Next best evidence:** operator supplies the **Osaka group's** Campfire share URL from the **same Meetup's group card**, or an authorized private live-event read returning Meetup `clubId` plus `creator.username`; compare decoded/returned `clubId` to row 198 and 34 privately. Avoid putting screenshots, names, public handles, personally identifying evidence or raw URLs in public GitHub.

**Production and source status unchanged:** CA Master dedicated stop and emergency 2099 pause remain; no source-sheet, production DB, Identity, medal, Cron, or Edge modifications; no PR merge.

## 2026-10-12: Osaka meetup host source-trainer match, profile evidence

**This section supersedes the prior `OSAKA_HOST_SOURCE_HANDLE=SIMILAR_NOT_VERIFIED` assessment.** The operator supplied a **second screenshot**, opening the host's own Campfire profile from the Osaka Meetup. The profile shows:
- The same Campfire host account handle as the Meetup host card.
- Within its linked-game section, an **explicit Pokémon GO trainer name equal, character for character, to the exact trainer name on current CA master row 198**.
- A visible Community Ambassador badge beside that Pokémon GO account.

Together with the previously provided Meetup screenshot naming the **Osaka 夜活** group, this directly links the Meetup organizer's displayed Campfire profile to the **row 198 trainer key**. Crucially, the inference no longer relies on similar Discord usernames; it relies on a directly visible linked Pokémon GO account name and badge.

**Accurate extent of confirmation:**
- `OSAKA_MEETUP_HOST_PGO_TRAINER_MATCH_ROW_198=SCREENSHOT_EXACT_PASS`.
- `OSAKA_MEETUP_HOST_CA_BADGE=VISUALLY_CONFIRMED`.
- `OSAKA_SOURCE_1ST_ROLE=ROW_198_RECORDED`, **not independently proven by the badge**; the same CA badge may be presented for 2nd CA.
- `OSAKA_LIVE_GROUP_UUID=STILL_UNVERIFIED`: the screenshots do not expose the Meetup's immutable `clubId` or a group share URL, and the `cmpf.re` short link was not resolved here.
- `OSAKA_SECOND_CA_ROW_34=UNRESOLVED`: no membership proof, stable URL or prefecture correction obtained for row 34.

**Next independent evidence**: the *Osaka 夜活* group share link from Campfire (preferably opened from the same Meetup's group card), then confirm its decoded UUID against the row 198 URL and inspect whether row 34 should inherit that link through separately verified 2nd CA membership. Check row 175 KOBE mismatch independently and never remove existing identities/medals based on names alone.

No personal names/handles/screenshots or raw profile identifiers reproduced in this public PR. **No Sheet/DB/Edge/Cron/Identity/medal changes; 2099 STOP intact.**


## 2026-10-12: three Night Activity group URLs and Osaka second-CA Meetup evidence

Read-only evidence supplied by the project operator, supplementing the earlier sections:
- Three separate Campfire group share links were supplied from the live map. Their decoded IDs match current CA source rows **11 (WEST first CA), 13 (KOBE second CA), and 198 (Osaka first CA)** respectively.
- **Row 175 KOBE first CA** instead has exactly the **Osaka row 198** group's share link. This is a strong **source URL mismatch** candidate. A possible source-only fix is H175 = H13, contingent on verifying the current first CA assignment and source-owner approval.
- **Row 34 Osaka second CA** carries an unusable short group URL and an Aichi prefecture entry, despite its Osaka coordinates and self-description. A source-only fix candidate is H34 = H198 and I34 = I198, subject to source-owner approval.
- The operator provided a second Osaka Meetup screenshot dated **2026-10-09** at **Osaka Umekita Park**. The host card displays a purple CA badge and a name textually matching row 34's trainer name, and the event group card reads **Osaka Night Activity**. This is strong independent evidence that this account hosts events in the Osaka group. Because the linked Pokémon GO profile for this second host was not shown, **do not declare a fully independently verified account identity**; the purple badge also does not independently establish a 1st/2nd designation.
- An earlier Osaka Meetup plus its host's linked Pokémon GO profile **did** show an exact trainer-name match to row 198 and a CA badge.

**Evidence status:** `NIGHT_ACTIVITY_THREE_GROUP_SOURCE_UUID_MATCH=PASS_FOR_ROWS_11_13_198`; `ROW_175_URL_MISMATCH=CONFIRMED`; `ROW_34_HOST_AND_GROUP_SCREENSHOT=CORROBORATED`; `ROW_34_SOURCE_FIELDS=REVIEW_REQUIRED`. These are review dispositions only. No source Sheet or production DB edits, membership reassignments, Identity/medal changes, Cron/Edge changes, 2099 stop removal, baseline authorization or PR merge. Other source conflicts remain unresolved, so global CA master synchronization stays STOP.


## 2026-10-12: operator historical clarification: one original Night Activity community split geographically

**User-supplied historical evidence:** the operator states that `夜活 Pokémon GO` originally operated as a **single group**, then found members in different regions and **split into local groups**. This materially changes how a current UUID mismatch should be interpreted.

- Current Campfire live link evidence remains strong: the screenshot-labelled **Osaka**, **KOBE**, and **WEST** now have three distinct share UUIDs, matching source rows **198**, **13**, and **11**, respectively.
- The **source row 175 (KOBE 1st)** has the same URL as current Osaka row 198; earlier lists/maps show this for months. **This is a historical lineage/possible stale-current-link case, not proof the original row was entered incorrectly.** Its historical association may have been correct before regional group separation. The exact dates, parent/child succession, and CA member transfer history have **not** yet been established.
- **Amend previous recommendation:** `H175 <- H13` is now only a *proposed current-source link update* after the operator independently verifies **when KOBE split**, **whether row 175 1st CA moved to the new KOBE UUID**, and **whether this source tab is intended to store the current group rather than the original group**. Preserve the original ID as a *documented historical association* in an appropriate non-destructive private audit record; do NOT silently rewrite/deprecate the old UUID across unrelated Osaka records.
- Never use `community_campfire_ids` history/aliasing to equate **separate, simultaneously operating Campfire groups**. The alias model might suit an actual rename or one-to-one ID replacement, but separate Osaka/KOBE/WEST groups with independently active IDs require independent logical community identities. Verify before any proposed DB changes.
- **Row 34** still has an unparseable link and Aichi-prefecture field despite Osaka Meetup and geographical evidence; provenance alone does not resolve whether the correct *current* Osaka group and CA membership are confirmed.
- Distinguish **`HISTORICALLY_VALID_AT_TIME`**, **`CURRENT_SOURCE_STALE`**, **`LEGITIMATE_MULTIGROUP_HISTORY`**, and **`DATA_ENTRY_ERROR`**. Do not automatically classify row 175 in the last category.

**Next question for operator (not a database change):** after the geographical split, did the KOBE 1st CA officially move to the separate KOBE Campfire group? If known, obtain the approximate split date and any historical meetup link showing its host and club ID. This supports a time-bounded audit rather than deleting associations.

**Status:** `NIGHT_ACTIVITY_GROUP_SPLIT_HISTORY=OPERATOR_CONFIRMED`; `KOBE_ROW_175_REASON=HISTORICAL_LINEAGE_POSSIBLE`; `CURRENT_ASSIGNMENT=REQUIRES_CONFIRMATION`; `GOOGLE_SHEET_WRITES=NONE`; `PRODUCTION_WRITES=NONE`; `CA_MASTER_SYNC=STOP`.


## 2026-10-12: operator attestation of current KOBE first-CA assignment

**Direct operator confirmation:** in response to the exact question whether the source **row 175 KOBE first CA** remains an active first CA in the independently established **KOBE** regional community, the operator answered **YES**.

This confirmation, paired with the three separate live operator-shared Campfire group invite URLs, supports the following narrow **current-source data correction candidate**:
- **H175** (KOBE first CA) should point to the current **KOBE Community invite URL already present in H13 (KOBE second CA)**, **not** the Osaka URL currently present in H175/H198.
- Keep H198 on the already live-verified **Osaka** Community URL.
- Keep H11 on the live-verified **WEST** URL.
- Record the original H175 value as a **historical source observation** in a private operator-controlled review record where required; its past validity or transfer date **is not yet demonstrated**, so do not label it a verified past membership.
- The three currently distinct regional groups must **not** be merged as historical Campfire ID aliases. Community identity/membership migrations in restored or production DB require separate impact analysis for `user_ca_identities`, `community_ca_members`, medals, and exchanges.

**Disposition:** `ROW_175_CURRENT_KOBE_1ST=OPERATOR_ATTESTED`; `ROW_175_CURRENT_SOURCE_URL_REPLACE_WITH_H13=READY_FOR_SOURCE_OWNER_APPROVAL`; `SOURCE_SHEET_WRITE=NOT_AUTHORIZED`; `RESTORED_DB_ASSOCIATION_UPDATE=NOT_AUTHORIZED`; `MASTER_SYNC=STOP`.

**Other Night Activity issue:** H34 link and I34 prefecture are still **pending separately reviewed source correction**; the current screenshot of a second-CA-badged Meetup host supports participation in Osaka but does not by itself prove ownership of the linked Pokémon GO profile or authorize edits. The remaining non-Night-Activity source discrepancies persist.


## 2026-10-12: operator attestation of current Osaka second-CA assignment

**Direct operator confirmation:** in response to the exact question whether the current source **row 34** CA remains a **2nd CA in the Osaka `夜活 Pokémon GO`** group, the operator answered **YES**.

Fresh **read-only** source check of tab `[new]CA List 20260828` (gid `633821294`) confirms:
- Row **34** group name `夜活 Pokémon GO`, with **H34** a 38-character shortened/undecodable Campfire link and **I34** marked Aichi even though **J34/K34** match Osaka row **198** coordinates exactly.
- Osaka row **198** carries the **live operator-verified Osaka full group invite link** and Osaka prefecture.
- KOBE row **13** carries the **live operator-verified KOBE link**; KOBE 1st row **175** still carries the Osaka row-198 link and has already been affirmed by the operator as the current KOBE 1st CA.

### Proposed source-only correction set, *not authorized or performed*

| Cell | Current issue | Candidate value | Basis |
| --- | --- | --- | --- |
| **H175** | KOBE 1st points to distinct Osaka group | Copy current **H13** (KOBE) | Three verified group URLs and operator attestation of current KOBE 1st |
| **H34** | Osaka 2nd has short group link with no Community UUID | Copy current **H198** (Osaka) | Verified live Osaka link; operator affirms row 34 current Osaka 2nd; public Osaka meetup with corresponding CA-badged host |
| **I34** | Prefecture field says Aichi | Copy current **I198** (Osaka) | Operator affirms current Osaka 2nd; source self-description and existing coordinates point to Osaka |

Do **not** change row 34's J/K coordinates, row 13, row 11 or row 198. Source **A1/M201 row count and 200 CA source keys must stay unchanged**; correct a field, not a user or group identity. Historical Osaka/KOBE split means the old H175 link must be recorded privately as a **historical source observation**, not automatically marked a verified prior membership.

**Confidence:** current-region/role confirmation provided directly by operator plus matched share links. **Approval boundary:** this YES answered an affiliation-confirmation question; it is **not permission to edit the upstream Google Sheet or production database**. Separate explicit source-owner authorization, protected local/restored-DB per-key/pair impact analysis, and a post-edit read-only source preflight are still required. Do not change or delete existing `community_ca_members`, `user_ca_identities`, medals, exchanges, old aliases, or emergency stop.

**Night Activity review status:** `OSAKA_ROW_34_2ND=OPERATOR_ATTESTED`; `KOBE_ROW_175_1ST=OPERATOR_ATTESTED`; `NIGHT_ACTIVITY_THREE_FIELD_FIX_CANDIDATES=SPECIFIED`; `SOURCE_SHEET_WRITES=NONE`; `PRODUCTION_WRITES=NONE`; `GLOBAL_CA_MASTER_SYNC=STOP` (other independent P0/P1 discrepancies persist).


## 2026-10-12: source rows 7 and 115 historical split or alias investigation

**Read-only source investigation:** Current CA List `[new]CA List 20260828` (gid 633821294) row **7** lists a newly appointed **2nd CA** (join date 2026-09-24) attached to the Osaka-area `GO to今城塚古墳公園` group. Row **115** lists a **1st CA** (joined 2025-05-15) attached to `AMaGO`. Although these are **different listed group names**, **both H7 and H115 use the identical full Campfire group share URL and decoded UUID**. Their listed map points are several kilometers apart.

The same current 1st CA is traceable across snapshots (matched privately by trainer source key, not by name or coordinate alone):

| Snapshot | Historical source group name | Link type | Result |
| --- | --- | --- | --- |
| CA List **2026-04-20** | `GO to今城塚古墳公園` | Decodable UUID | **ID B** |
| CA List **2026-06-22** | `GO to今城塚古墳公園` | Decodable UUID | **ID B** |
| CA List **2026-06-25** | `GO to今城塚古墳公園` | Decodable UUID | **ID A** |
| CA List **2026-07-18** | `GO to今城塚古墳公園` | Decodable UUID | **ID A** |
| Current CA List **2026-08-28** | `AMaGO` | Decodable UUID | **ID A** |
| CA MAP **2026-03, 04, 06** | `GO to今城塚古墳公園` | Decodable UUID | **ID B** |
| CA MAP **2026-08** | `AMaGO` | Decodable UUID | **ID B** |
| Current CA List row **7** | `GO to今城塚古墳公園` | Decodable UUID | **ID A** |

**ID A** is the current identical H7/H115 group UUID. **ID B** is the *different*, consistently mapped March–August map UUID. UUIDs and account identifiers are intentionally **not** copied into this public file.

**Key observation:** Row 115's source group-name change to `AMaGO` coexists with a **stable ID B in August map**, while the **current CA List row 115 still carries ID A**, also carried by the new 2nd CA on row 7. **Two distinct real clubs vs rename/replacement vs split are all plausible**. The historical record alone cannot establish which of ID A/B is actually live today. Do not treat either as interchangeable alias or assume that the new CA is attached to the wrong club.

**Specific evidence required next, read-only:**
1. Ask operator for the **current in-app Campfire *AMaGO* group share URL**, decode its Community ID; compare with the map's **ID B** and CA List's **ID A**.
2. Obtain a current separate `GO to今城塚古墳公園` share link (or a public Meetup's group card) and compare its ID with ID A. Verify that the 2nd CA remains officially attached there.
3. If each group remains separate, preserve two independent logical Community IDs. For a current source correction to H115, obtain explicit owner authorization and protected identity/link review; do not silently reassign or delete the historical 1st CA link.
4. Retain all prior source observations. A current source-row link correction does **not** by itself authorize a production DB identity, medal, exchange or Community history migration.

**Disposition:** `ROW_7_115_SOURCE_SAME_UUID=CONFIRMED`; `HISTORICAL_ALTERNATE_COMMUNITY_ID=FOUND`; `AMAGO_CURRENT_SHARE_LINK=AWAITING_OPERATOR`; `GO_TO_CURRENT_LINK=AWAITING_OPERATOR`; `SOURCE_EDIT=NONE`; `PRODUCTION_SYNC=STOP`.


## 2026-10-12: operator-supplied AMaGO share link and separate Takatsuki CA pair

The operator supplied the **live AMaGO Campfire group invite link** in response to the exact request for AMaGO. Its full URL and decoded Community ID were compared **read-only** with CA Master `[new]CA List 20260828` (gid `633821294`) and `[new] CA MAP 202608`. Raw URLs/UUIDs are intentionally not copied to the public repository.

- **Current row 115, AMaGO 1st CA:** FULL URL and decoded ID **EXACT MATCH** to user-supplied AMaGO link. Therefore the prior speculation that H115 is a stale link is **not supported**; **do not propose changing H115**.
- **Current row 7, GO to今城塚古墳公園 2nd CA:** FULL URL and decoded ID **EXACT MATCH** to the same operator-supplied AMaGO link. **Group display names differ**; this is not by itself evidence of improper 2nd CA assignment. Possibilities include renamed group, old source display name, or shared affiliation. Confirm via current `GO to今城塚古墳公園` Meetup or group share link.
- **2026-08 CA MAP row 111, AMaGO:** lists a *different* ID from the live operator-supplied AMaGO URL. This map entry is now a **stale/misattributed-link candidate**, but it has not been proven invalid.
- Critically, a bounded **all-200-source-row scan** identified the **same second ID** currently attached to a separate group label **`Pokémon GO in 高槻`**, on CA Master rows **76 (2nd CA)** and **197 (1st CA)**. August map row **113** also lists `Pokémon GO in 高槻` with that second ID.
- Therefore the ID listed for August map's `AMaGO` is **not safely treatable as AMaGO's previous exclusive identifier**: it is still associated with a *different active current-source 1st/2nd CA pair*. Do not equate it to AMaGO through a historical alias rule, merge the logical communities, or delete/retire either set of links.

**Current evidence grid:**

| Source | Group and role | UUID bucket | Evidentiary result |
| --- | --- | --- | --- |
| CA row **115** | AMaGO 1st | **A** | Operator-supplied live AMaGO link **exact match** |
| CA row **7** | GO to今城塚古墳公園 2nd | **A** | Same link as live AMaGO; name difference needs review |
| CA row **76** | Pokémon GO in 高槻 2nd | **B** | Distinct ID; current source link only |
| CA row **197** | Pokémon GO in 高槻 1st | **B** | Distinct ID; current source link only |
| 2026-08 map row **111** | AMaGO | **B** | Conflicts with current live AMaGO **A** |
| 2026-08 map row **113** | Pokémon GO in 高槻 | **B** | Consistent with current CA master Takatsuki group **B** |

**Next verification**: Request the current Campfire **GO to今城塚古墳公園** group share URL or an actual group-linked Meetup to determine whether row 7 is the correct *AMaGO* shared Club ID with a legacy name versus a different group link. Separately request a share link for `Pokémon GO in 高槻` if map correction is to be independently confirmed. The historic name and ID transition chronology is ambiguous and requires human interpretation.

**Updated dispositions:** `AMAGO_LIVE_LINK_ROW_115=EXACT_PASS`; `ROW_7_SHARED_WITH_AMAGO=CONFIRMED_UUID`; `MAP_AMAGO_ID_B_CONFLICTS_WITH_LIVE_AMAGO=CONFIRMED`; `ID_B_ALSO_CURRENT_TAKATSUKI_1ST_2ND=CONFIRMED_SOURCE`; `SOURCE_DATA_CHANGE=NONE`; `PRODUCTION_SYNC=STOP`.


## 2026-10-12: operator-supplied Discord ticket proves AMaGO rename and venue relocation (READ ONLY)

Operator furnished a screenshot from a **2026-09-23** Discord support ticket submitted by the CA identified in source **row 115**, explicitly reporting:
- community rename **`GO to 今城塚古墳公園` → `AMaGO`**;
- change of the activity-base location to coordinates that **exactly equal current CA Master J115/K115**;
- the submitter says the rename and activity-base change had been **performed that day**.

**Privacy and evidentiary limitation:** do not publish the original screenshot, ticket channel/user identifiers, or trainer-name contents. The screenshot proves a *submitted statement* and the operator's corroboration. It does **not** by itself establish separate ticket closure/approval, platform migration date or a Campfire group deletion.

Paired with the immediately preceding **operator-shared current AMaGO invite** which exactly matches **both H115 and H7**, this directly supersedes the earlier hypothesis that the 7/115 different group names necessarily represent two simultaneous distinct groups. The **same-ID/name-change explanation is now supported by direct human primary-source evidence**, and the current H115 / row 115 display name and new site are consistent.

**Revision to row 7 current-source review:**
- **G7** (row 7 2nd CA's source group display name) remains `GO to今城塚古墳公園`, a strong **stale name** candidate after the 2026-09-23 operator-documented rename. **Proposed SOURCE-ONLY G7 value = current G115 (`AMaGO`)**, subject to source-owner consent.
- **H7** already **exactly matches the operator's live AMaGO link**: **do not change H7 or H115**.
- **J7/K7** remain the old listed map coordinate, while **J115/K115** match the new base location stated in the 2026-09-23 ticket. These are **source coordinate review candidates**; only propose J7/K7 = J115/K115 if source owners confirm columns J/K designate one *shared community base* for all 1st/2nd CAs, as opposed to individually maintained CA meeting points. **No automatic overwrite**.
- Do not alter row-7 or row-115 CA keys, roles, memberships, identity links, medals or exchanges.

**Important unresolved adjacent discrepancy:** 2026-08-labelled CA MAP row **111** records `AMaGO` under ID **B**, while the operator-shared current AMaGO link, H7 and H115 use **A**. ID **B** also belongs in the current source to the distinct `Pokémon GO in 高槻` 1st/2nd pair (rows 197/76) and map row 113. This separate map/source mapping issue **is not resolved** by the rename notice; do not rewrite B as an alias of A or merge their live communities. Tab title dates need not prove when each entry was last edited.

**Disposition:** `AMAGO_RENAME_AND_RELOCATION=OPERATOR_TICKET_SCREENSHOT`; `ROW_7_G_STALE_DISPLAY_NAME=HIGH_CONFIDENCE_CORRECTION_CANDIDATE`; `ROW_7_H_ALREADY_VALID=EXACT_PASS`; `ROW_7_JK=FIELD_SEMANTICS_REVIEW`; `MAP_ROW_111_SECOND_ID_CONFLICT=OPEN`. **No Google Sheets edit, no production Supabase write or release, no master sync restart or 2099 stop change.**


## 2026-10-12: operator-supplied Takatsuki first-CA group URL verification (READ ONLY)

The operator provided a **current Campfire group share link identified as belonging to the Takatsuki 1st CA**. The provided link's fully decoded group ID and the complete share URL were compared read-only with the official live source tabs; do not publish raw links, immutable UUIDs, trainer names or private evidence in this public file.

- Current CA List row **197**, `Pokémon GO in 高槻` 1st CA: **FULL URL + UUID EXACT MATCH**.
- Current CA List row **76**, same `Pokémon GO in 高槻` 2nd CA: **FULL URL + UUID EXACT MATCH**.
- 2026-08 map row **113**, `Pokémon GO in 高槻`: **FULL URL + UUID EXACT MATCH**.
- 2026-08 map row **111**, *mislabelled `AMaGO`*: also **FULL URL + UUID EXACT MATCH** to the Takatsuki 1st CA group, **not** the separately verified live AMaGO group link.
- In contrast, current CA List row **115** (`AMaGO` 1st) and row **7** (2nd, stale pre-renaming display name) exactly match the **other** operator-supplied live AMaGO URL. Therefore two distinct authoritative group IDs are confirmed for **currently separately identified AMaGO vs Pokémon GO in 高槻**.
- Historical maps and lists were previously discrepant. The provided operator ticket confirms the `GO to今城塚古墳公園` → `AMaGO` rename; the old display name in row 7 requires independent source edit approval. Neither group is to be combined through aliasing.

**Proposed source/map-only corrections for explicit source-owner review, NOT executed:**
1. CA List **G7** → `AMaGO` (copy G115), preserving H7 exactly. J7/K7 venue coordinates remain REVIEW until the field semantics and CA-specific assignment are confirmed.
2. 2026-08 **CA MAP row 111**: AMaGO label with *Pokémon GO in 高槻* share link constitutes a **strong confirmed link/label mismatch** versus independently operator-verified AMaGO live group. A review-only suggestion is to replace the map's row-111 URL with the verified current AMaGO link (same as current CA list H115) **only if** that tab is still the active authoritative map and an authorized maintainer confirms row 111 should represent AMaGO rather than a historical state. Keep map row 113, CA List H76/H197, and H7/H115 unchanged.
3. These are separate source/map fields, not authorization for restored or production DB mapping edits. Preserve identities, association history, medals, and exchanges.

**State:** `TAKATSUKI_1ST_LIVE_URL=EXACT_MATCH_LIST_ROWS_197_76_MAP_ROW_113`; `AMAGO_TAKATSUKI_SEPARATE_LIVE_UUID=YES`; `MAP_ROW_111_LABEL_URL_MISMATCH=VERIFIED`; `CA_LIST_G7_STALE_NAME_REVIEW`; `CA_MASTER_SYNC=STOP`; `SOURCE_WRITES=NONE`; `PRODUCTION_WRITES=NONE`.


## 2026-10-12: all remaining five regions batch historical triage (READ ONLY)

**Operator workflow change:** Rather than ask about every source row individually, consolidate all remaining regions into **one six-link batch request** and independently classify Kagoshima/Chiba from existing verified evidence. Read-only cross-check of the live 200-row master against **April, June, July 2026 CA Lists**, **March, April, June, August CA MAP** (where applicable). This is a provisional audit, not a data correction.

### Batch results before new live link submission

| Region / current source rows | Historical pattern cross-checked | Current safe disposition | Needed operator evidence |
| --- | --- | --- | --- |
| **Tokushima 60 / 116** | Two different 1st CA group names and geographies have **the same decoded group UUID** in **all** inspected historic CA Lists and CA MAP snapshots, at least back to March map. That UUID is absent from restored DB current/history according to the local report; each CA currently links to a separate other DB community. | **Historical copied UUID / shared one-group hypotheses both remain open. Do not merge or reassign either group.** | Independent current group share invite for each of the two named groups; verify current 1st CA. |
| **Hokkaido 29 / 94 / 177** | Same-name `東神楽` 1st/2nd entries have **different UUIDs** persisting in old CA Lists; source 1st row **94** instead has **exact same UUID as the distinct `旭川` 1st** row **177**, also consistently duplicated in old map snapshots. Restored history documents prior manual Hokkaido repair. | **Possible multiple long-lived copied URL errors and independent DB repair; absolutely no automatic correction.** | Current share invites from 東神楽 and 旭川 1st CA; if 東神楽 1st/2nd still disagree, obtain 2nd host's linked group proof. |
| **Nara 144 / 159 / 199** | `まほろば` 1st/2nd rows share one UUID, but `やまと` 1st also uses it across old lists/maps. A *different* historic UUID is visible on a `やまと` 2nd CA in April–July lists, while Aug map renamed a third row to `Sakura Walk` with the shared UUID. | **Likely multi-group mistaken link(s), but verify community/group succession and role before any edit.** | Current independent group share invites for `まほろば` and `やまと`; if ID identical, get explicit relation/rename explanation. |
| **Kagoshima 17 / 128** | 1st CA URL/ID stable over April–July and map snapshots; 2nd CA present in July and current records with missing URL/coords. Prior operator link has already independently matched current 1st CA row 128. | **H17 = H128 is a conditional source-only completion candidate.** 2nd CA is not independently membership-confirmed; J17/K17 must not be fabricated. | Only ask current CA affiliation and meetup-location coordinates once, if needed. No re-request of existing share link. |
| **Chiba 100** | 1st CA source UUID, name and prefecture stable in all CA Lists April–July and maps March–August. Restored local DB instead records distinct current relation and a retired/historic alias. | **SOURCE_STABLE_BUT_DB_ALIAS_REVIEW**, not a source Sheet correction on evidence available. | Restored-local no-write historical alias/current linkage evidence, then explicit CA/source-owner attestation if needed; live Campfire share link optional only if discrepancy persists. |

**Request sequence:** six targeted current Campfire group links: Tokushima 2, Hokkaido 2, Nara 2. Only after matching decoded IDs request a screenshot or club-host identity detail for unresolved affiliation. Do not ask user to reproduce already established Osaka, AMaGO, Kagoshima 1st or Takatsuki links.

**Guardrails:** source CA row count 200, unique keys 200; no Google Sheet writes, no production SQL/Edge/Cron/sync, no merges, no baseline registration, no emergency 2099 pause changes. Preserve all current associations, user identities, medal collections and exchanges. For local DB discrepancies, require guarded local rehearsal and final no-loss checks before any approval.


## 2026-10-12: two fresh unlabeled Campfire group URLs from batch (READ ONLY)

In response to the consolidated **six-group request** (Tokushima two, Hokkaido two, Nara two), the operator supplied **two separate full Campfire `onelink.me` group invite URLs without labels or captions**.

- Each decoded successfully to an immutable Campfire Club UUID.
- The two decoded UUIDs are **distinct from each other**.
- Neither UUID appears in the current **200-CA master source** (`[new]CA List 20260828`), in the July source CA List, nor in the August CA MAP source after a bounded full-table ID comparison.
- In particular, neither is the *historically duplicated source UUID* on Tokushima rows **60/116**; nor any current row-29/94/177 Hokkaido or row-144/159/199 Nara ID.

**Crucial provenance caveat:** the operator gave no Community names for either URL, and their order relative to the requested six groups is **not authenticated evidence of group assignment**. Do not publish the raw URLs/UUIDs. Do not classify either as a specific CA's Club, treat them as URL correction authority, or write a new Community ID to production without the operator's explicit link-to-group attestation.

**Disposition:** `TWO_NEW_DISTINCT_VALID_GROUP_UUIDS=CONFIRMED`; `CURRENT_SOURCE_MATCH=NONE`; `GROUP_ASSIGNMENT=AWAITING_OPERATOR_LABEL`; `SHEET_EDIT=NONE`; `PROD_EDIT=NONE`; `SYNC_STOP=MAINTAINED`.

**Minimal next step:** ask whether URL **①** corresponds to the **Tokushima Anan** group and URL **②** to the **Tokushima city** group (the first two in the six-group list). If confirmed, make narrowly scoped **source-only H60/H116 URL proposals**, not automatic edits; continue to obtain the remaining four groups and perform restored-DB no-loss impact analysis before future authorization.


## 2026-10-12: operator confirms Tokushima Anan and city group link attribution (READ ONLY)

Following the two valid but previously unlabeled Campfire group URLs, the operator was asked explicitly whether **URL #1 is `新ポケモン GO 阿南` (source row 60)** and **URL #2 is `ポケモン GO Tokushima` (source row 116)**. The operator answered **YES**.

- Each URL contains a **valid, distinct** Club UUID that was absent from the current master and inspected historical source lists/maps.
- Each is **explicitly attributed by the operator to a different currently identified group**. Treat this as **operator-supplied current Club evidence**, not API-confirmed current 1st CA membership or a verified host-linked event. Source rows 60 and 116 do list their respective 1st CAs; current role/membership is a separate gate.
- **H60**: candidate source-only value = operator-supplied **URL #1** (Anan). **H116**: candidate source-only value = operator-supplied **URL #2** (Tokushima city). The two must remain **separate distinct Communities**, never merged or recorded as interchangeable aliases.
- The old identical source URL on both H60/H116 is an **historical source observation**, and whether it was ever valid for either group is still undetermined. Retain prior link history in protected audit records, not public GitHub.
- Restored local DB already contains separately reported different associations for these two CA keys, and **new live IDs absent from current/historical restored records**. A safe mapping migration would therefore require explicit per-CA link/identity/medal/exchange impact analysis and local-only E2E proof, not just changing Google Sheets.
- **Approval boundary:** user's YES authorizes linking the two supplied evidence URLs to the two named groups **for review only**. It does **not** authorize writes to Sheets, production database, Edge/Cron or merge of Draft PR #131. Do not remove or overwrite existing identities or memberships.

**Disposition:** `TOKUSHIMA_ROW_60_CURRENT_GROUP_LINK=OPERATOR_ATTESTED`; `TOKUSHIMA_ROW_116_CURRENT_GROUP_LINK=OPERATOR_ATTESTED`; `H60_H116_SOURCE_REPLACEMENT_CANDIDATES=PREPARED`; `ACTUAL_1ST_CA_ROLE_AND_DB_MAPPING=REVIEW_REQUIRED`; `SHEET_WRITES=NONE`; `PRODUCTION_WRITES=NONE`; `MASTER_SYNC=STOP`.

**Remaining requested operator links** in the six-group batch: Hokkaido **東神楽** and **旭川**, Nara **まほろば** and **やまと**. Kagoshima row 17 membership/coordinates and Chiba row 100 historic DB association remain separate, protected review items.


## 2026-10-12: Nara Sakura Walk link and future Yamato succession notice (READ ONLY)

**Fresh operator evidence:** In the outstanding Nara link batch, the operator supplied a decodable Campfire **group invite URL**, plus the explicit statement that the current **Yamato** first CA **plans to retire** and a historical second CA **plans to succeed as first**. The statement concerns a **future** handover, not a completed transfer.

Read-only link and source-history verification:
- Supplied URL decodes exactly to **current CA Master H58**, whose current G58 display is **`Pokémon GO 奈良 Sakura Walk🌸`**. This is a **valid live-link match to row 58**; it cannot be attributed to current **Yamato** merely from the adjacent succession statement.
- The exact same source trainer key on **current row 58** was listed on previous June/July source snapshots as **`Pokémon GO 奈良 やまと` 2nd CA**. Its current second-role column **C58 is blank**; **do not equate blank with independent proof of effective first-CA promotion**. The operator's wording says first-CA transition is planned, not completed.
- Current **row 159** carries the outgoing first CA for **`Pokémon GO 奈良 やまと`**, but **H159 is a *different* Campfire UUID**: equal to current Mahoroba 1st/2nd source rows **199/144**. Prior source lists also consistently show that discrepancy.
- 2026-08 CA MAP has an additional label `Pokémon GO 奈良 Sakura Walk 🌸` whose link equals the Mahoroba/Yamato-shared *other* UUID; it **does not** match the freshly supplied row-58 Sakura Walk link. Thus the historical map has a **separate group-label/URL contradiction**, similar to prior AMaGO map inconsistencies.
- Source records show **the same historical second CA** changed from Yamato label in old source snapshots to **Sakura Walk** on current row 58, with its own distinct linked UUID. This could represent a rename, split, transferred membership, or distinct current group. No lineage/identity conclusion without owner explanation.
- **Avoid invented equivalence** between row-58 Sakura Walk UUID, current Yamato row-159 UUID and Mahoroba rows 144/199. Treat all as separate ID claims until verified.

**Next minimum operator clarification:** Does the planned successor take over **the existing Yamato community** (current source row 159) or lead a **separate Sakura Walk community** (row 58)? Is Sakura Walk a rename/replacement of Yamato, or a separate group? Request the current **Yamato group invite link** if available, plus Mahoroba to disambiguate the remaining collision. One brief question at a time is sufficient. The account should always be matched to its **exact current trainer key** (avoid inventing a near-spelling variant and duplicating accounts).

**No updates:** no source Sheet edit, current 1st/2nd promotion, deletion, alias merger, restored/prod DB mapping, Identity, medals, Cron/Edge, master sync restart, 2099 sentinel change or PR merge. Status `NARA_ROW_58_SAKURA_WALK_LIVE_UUID_MATCH=PASS`; `YAMATO_SUCCESSION=PLANNED_NOT_EXECUTED`; `NARA_GROUP_RELATIONSHIP=REQUIRES_OPERATOR_CONFIRMATION`; `MASTER_SYNC=STOP`.


## 2026-10-12: operator confirms Yamato renamed to Sakura Walk (READ ONLY)

**Supersedes the prior uncertainty about the Yamato/Sakura Walk relation.** Immediately following the operator's disclosure of planned first-CA succession, the operator explicitly clarified that the **Community name itself changed from `Pokémon GO 奈良 やまと` to `Pokémon GO 奈良 Sakura Walk🌸`**. The operator describes a **rename of an existing community**, not the founding of an unrelated new community. No effective date of platform name change or completion of role transition was supplied.

**Supported separate claims:**
- **Community display-name change:** **operator-confirmed** `やまと` → `Sakura Walk🌸`.
- **Linked live group invite:** supplied URL decodes to precisely the same ID/URL as source **row 58**, now labelled Sakura Walk. Row 58's CA key was the previous Yamato 2nd CA in earlier CA source snapshots, but its current role column is blank. Do not automatically declare planned future promotion complete.
- **Row 159**, the outgoing Yamato 1st CA, still lists **old Yamato display name and a different group URL/UUID** shared with current *Mahoroba* rows **144/199**. This is a **high-priority current-source stale-name and potential mismatched-link case** after the rename; the correct row-159 link cannot be assigned solely from a rename statement unless source owner confirms that the outgoing 1st CA still belonged to this same currently live Sakura Walk group before retirement.
- **August map row 123**, labelled Sakura Walk, likewise uses the ID shared by Mahoroba, **not** the independently operator-supplied live Sakura Walk ID. Map correction candidate requires confirming authoritative use and intended group; preserve independent Mahoroba group.
- **Transition timing:** outgoing 1st CA **retirement planned**, historical Yamato 2nd CA **promotion to 1st planned**; **no early inactive/active/role changes, no removal of CA member or identity associations, medals, or exchanges**.
- **Possible source-only edit candidates for separate permission**: current **G159** old name → Sakura Walk (if current-display source semantics confirmed); **H159** → same as verified H58 (after CA's current Club membership verified); map row 123 UUID should be verified against H58. Do not amend H144/H199 based on another group's rename.
- Do not assume that the source G58 name + blank C58 proves effective promotion. Require separate confirmation of the change's effective date before touching role assignments.

**Disposition:** `YAMATO_TO_SAKURA_WALK_RENAME=OPERATOR_CONFIRMED`; `S_58_LIVE_URL=EXACT`; `ROW_159_STALE_NAME=LIKELY`; `ROW_159_URL_AND_MAP_ROW_123=NEEDS_CONSISTENCY_REVIEW`; `FIRST_CA_HANDOVER=FUTURE_PLANNED`; `SOURCE_SHEET_WRITES=NONE`; `PRODUCTION_DB_WRITES=NONE`; `MASTER_SYNC=STOP`.
