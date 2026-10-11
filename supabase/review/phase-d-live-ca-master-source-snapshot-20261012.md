# CA Clover | Phase D live CA master source inspection
**2026-10-12 JST | REVIEW ONLY | Production GO = STOP**

## Evidence and scope

- Source: connected Google Sheet `[APAC] CA in Japan` (spreadsheet ID referenced by the existing production CA-master Edge source).
- Exact tab: `[new]CA List 20260828`, sheet ID `633821294`, live bounded read `A1:M201`.
- Read-only cells + sheet metadata. We did not edit Google Sheets, Supabase, or the live website.
- No trainer name, Discord identity, user UUID, Campfire link, access token, or backup artifact is copied into this public report.
- Sheet cell values were inspected through the connected Sheets API. The HTTP CSV export was **not** executed; parser/output equivalence must be checked in the local private rehearsal.
- Restored database *aggregate counts* came from the separate successful private Windows audit, not from this remote Sheets read. Individual CA/link intersections with that database remain **unverified**.

## Current source summary

| Check | Observation |
| --- | ---: |
| Sheet nonempty CA rows | 200 |
| Rows with mandatory name, Community name, prefecture | 200 |
| Unique normalized CA source keys | 200 |
| Duplicated CA source keys | 0 |
| Distinct valid decoded Campfire Community IDs | 155 |
| Rows with a missing / unparseable Community ID | 2 |
| Rows with no Campfire URL | 1 |
| Rows with incomplete/invalid coordinates | 1 |
| Campfire ID mapped to multiple different Community prefecture/name identities | 5 ID groups |
| Same Community prefecture/name identity mapped to multiple different IDs | 3 groups |
| Status plain blank | 152 |
| Status 🆕 | 11 |
| Status 🔰 | 31 |
| Status 🏝️ Inactive | 6 |

Restored DB aggregates (previous confirmed report): `ca_members=200`, `communities=155`,
`community_ca_members=196`, `user_ca_identities=6`, `stamp_collections=13`.

**Identical aggregate CA/Community counts do NOT prove identical identities or assignments.**
The Sheet provides 200 distinct CA keys but only 198 parsed CA-Community links,
whereas restored DB has 196 CA-Community links. Differences must be classified
using a local-only per-key/pair comparison before any write.

### Anonymous row references for operator review

The row numbers below refer to the original 1-based Sheet grid, including header row 1:

- Missing/unparseable Community ID: **17 (no URL), 34 (URL exists but ID not resolved)**.
- Missing/invalid coordinate: **17**.
- Same Campfire ID with differing Community identity:
  - **7 / 115**
  - **60 / 116**
  - **94 / 177**
  - **144 / 159 / 199**
  - **175 / 198**
- Same prefecture and Community name paired to multiple distinct/unresolved IDs:
  - **13 / 175**
  - **17 / 128**
  - **29 / 94**

CA name repetition with same Community ID may be legitimate (1st / 2nd CA);
do not treat multiple rows for the same Community ID as a collision *unless*
the prefecture/name identity is contradictory.

## Classification and safety

1. `Status` is mostly blank or emoji-based. The safe parser must not infer `active`
   from blank, 🆕, or 🔰. `🏝️ Inactive` is recognized as inactive. Compare existing
   statuses before any update, and require explicit approval for new ambiguous cases.
2. The current Phase C source preflight **should reject** 2 unresolved IDs and
   contradictory ID/name mappings. A failed preflight is expected to stop CA-master;
   it is NOT a reason to bypass the gate or disable validation.
3. Do not automatically normalize, rename, merge, retire, or delete historical
   Community mappings based solely on these apparent inconsistencies.
4. No verified source-row baseline should be registered before the **actual
   restored-DB per-CA/per-link diff** and human review are completed.
5. Never infer "safe to sync" from matching totals alone.

## Next private/non-production test

Compare sheet source keys and fully decoded Community IDs against the **restored local**
`ca_members`, `communities`, and `community_ca_members` key/pair sets,
including historical aliases if relevant. Report counts and anonymous Sheet row
numbers, not names or UUIDs. Verify each mismatch before any change.

**No source Sheet edits, no production DML/DDL, no PR merge, no Edge deploy, no Cron
change, and no change to the 2099 emergency sentinel.**
