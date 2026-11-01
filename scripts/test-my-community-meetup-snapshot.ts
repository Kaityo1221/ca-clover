import assert from "node:assert/strict";
import {
  assertMeetupSnapshotRows,
  compareMeetupSnapshot,
  type MeetupSnapshotRow,
} from "../src/lib/my-community-meetup-snapshot.ts";

const own = "community-own";
const other = "community-other";
const allowed = new Set([own]);
const event = (id: string, rsvp = 1, community_id = own): MeetupSnapshotRow => ({
  id, community_id, title: "イベント", starts_at: "2026-11-08T09:00:00Z",
  rsvp_count: rsvp, checkin_count: 0,
});
assert.deepEqual(compareMeetupSnapshot([], [event("1")], allowed), {
  added: 1, updated: 0, unchanged: 0,
});
assert.deepEqual(compareMeetupSnapshot([event("1")], [event("1", 2), event("2")], allowed), {
  added: 1, updated: 1, unchanged: 0,
});
assert.deepEqual(compareMeetupSnapshot([event("1")], [event("1")], allowed), {
  added: 0, updated: 0, unchanged: 1,
});
assert.deepEqual(compareMeetupSnapshot([event("1")], [], allowed), {
  added: 0, updated: 0, unchanged: 0,
});
assert.throws(() => compareMeetupSnapshot([event("1", 1, other)], [], allowed), /SCOPE_VIOLATION/);
assert.throws(() => compareMeetupSnapshot([], [event("1", 1, other)], allowed), /SCOPE_VIOLATION/);
assert.throws(() => assertMeetupSnapshotRows([event("1"), event("1")], allowed), /DUPLICATE_ID/);
assert.throws(() => assertMeetupSnapshotRows([{...event("1"), id: ""}], allowed), /SCOPE_VIOLATION/);
console.log("my community read-only meetup snapshot tests: PASS");
