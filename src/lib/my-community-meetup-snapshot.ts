/** Read-only, in-tab comparison of already authorized Meetup rows.
 * This does not fetch Campfire, persist data, or establish CA authorization.
 * Missing rows are never treated as deletions: API pagination can be partial.
 */
export type MeetupSnapshotRow = {
  id: string;
  community_id: string | null;
  title: string | null;
  starts_at: string | null;
  rsvp_count: number | null;
  checkin_count: number | null;
};

export type MeetupSnapshotChange = {
  added: number;
  updated: number;
  unchanged: number;
};

function fingerprint(row: MeetupSnapshotRow) {
  return JSON.stringify([
    row.title,
    row.starts_at,
    row.rsvp_count,
    row.checkin_count,
  ]);
}

export function assertMeetupSnapshotRows(
  rows: MeetupSnapshotRow[],
  allowedCommunityIds: ReadonlySet<string>,
): void {
  const seen = new Set<string>();
  for (const row of rows) {
    if (
      !row ||
      typeof row.id !== "string" ||
      !row.id ||
      typeof row.community_id !== "string" ||
      !allowedCommunityIds.has(row.community_id)
    ) {
      throw new Error("MEETUP_SCOPE_VIOLATION");
    }
    if (seen.has(row.id)) throw new Error("MEETUP_DUPLICATE_ID");
    seen.add(row.id);
  }
}

export function compareMeetupSnapshot(
  before: MeetupSnapshotRow[],
  after: MeetupSnapshotRow[],
  allowedCommunityIds: ReadonlySet<string>,
): MeetupSnapshotChange {
  assertMeetupSnapshotRows(before, allowedCommunityIds);
  assertMeetupSnapshotRows(after, allowedCommunityIds);
  const previous = new Map(before.map((row) => [row.id, row]));
  let added = 0;
  let updated = 0;
  let unchanged = 0;
  for (const row of after) {
    const old = previous.get(row.id);
    if (!old) added++;
    else if (fingerprint(old) !== fingerprint(row)) updated++;
    else unchanged++;
  }
  // Never infer deletion from a missing Meetup.
  return { added, updated, unchanged };
}
