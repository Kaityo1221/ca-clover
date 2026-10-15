import test from "node:test";
import assert from "node:assert/strict";
import { buildParticipantCsv, makeCsvFilename } from "./csv-core.mjs";

const event = { id: "event-001", eventTime: "2026-10-11T14:00:00+09:00" };
const members = [
  { id: "u1", username: "Trainer_A" },
  { id: "u2", username: "Trainer_B" },
  { id: "u3", username: "Trainer_C" }
];
const rsvpStatuses = [
  { userId: "u1", rsvpStatus: "ACCEPTED" },
  { userId: "u2", rsvpStatus: "CHECKED_IN" },
  { userId: "u3", rsvpStatus: "DECLINED" }
];
const input = (changes = {}) => ({
  event, members, rsvpStatuses, allPagesComplete: true, allStatusesComplete: true, ...changes,
});

test("creates Japanese Excel-friendly CSV without declined participants", () => {
  const result = buildParticipantCsv(input());
  assert.equal(result.filename, "meetup_20261011_event-001.csv");
  assert.ok(result.csv.startsWith("\uFEFF"));
  assert.ok(result.csv.includes('"アカウント名","参加表明","チェックイン"'));
  assert.ok(result.csv.includes('"Trainer_A","あり","未"'));
  assert.ok(result.csv.includes('"Trainer_B","あり","済"'));
  assert.ok(!result.csv.includes("Trainer_C"));
  assert.deepEqual(result.summary, {
    participating: 2, checkedIn: 1, excludedDeclined: 1, rows: 2,
  });
});

test("refuses export until pagination is complete", () => {
  assert.throws(
    () => buildParticipantCsv(input({ allPagesComplete: false })),
    /pagination is not complete/
  );
});

test("refuses missing usernames rather than issuing an incomplete CSV", () => {
  assert.throws(
    () => buildParticipantCsv(input({ members: [members[0]] })),
    /username missing/
  );
});

test("refuses conflicting duplicate statuses", () => {
  assert.throws(
    () => buildParticipantCsv(input({ rsvpStatuses: [
      rsvpStatuses[0], { userId: "u1", rsvpStatus: "CHECKED_IN" }
    ] })),
    /Conflicting RSVP/
  );
});

test("refuses unknown statuses", () => {
  assert.throws(
    () => buildParticipantCsv(input({ rsvpStatuses: [
      { userId: "u1", rsvpStatus: "INVENTED" }
    ] })),
    /Unsupported RSVP/
  );
});

test("neutralizes Excel formula injection and escapes quoted values", () => {
  const result = buildParticipantCsv(input({
    members: [{ id: "u1", username: ' =HYPERLINK("url")' }],
    rsvpStatuses: [rsvpStatuses[0]],
  }));
  assert.ok(result.csv.includes("' =HYPERLINK"));
  assert.ok(result.csv.includes('""url""'));
});

test("duplicates with the same username and status do not duplicate rows", () => {
  const result = buildParticipantCsv(input({
    members: [members[0], members[0]],
    rsvpStatuses: [rsvpStatuses[0], rsvpStatuses[0]],
  }));
  assert.equal(result.summary.participating, 1);
});

test("uses a sanitized event ID in the filename", () => {
  assert.equal(
    makeCsvFilename({ id: "event/strange:name", eventTime: "bad" }),
    "meetup_undated_event_strange_name.csv"
  );
});

test("preserves calendar day in Japan for a midnight meetup filename", () => {
  assert.equal(
    makeCsvFilename({ id: "tokyo", eventTime: "2026-10-16T00:30:00+09:00" }),
    "meetup_20261016_tokyo.csv"
  );
});

test("refuses a partially collected RSVP status list", () => {
  assert.throws(
    () => buildParticipantCsv(input({ allStatusesComplete: false })),
    /status collection is not verified complete/
  );
});

test("rejects missing status-completeness evidence by default", () => {
  const { allStatusesComplete, ...withoutFlag } = input();
  assert.throws(
    () => buildParticipantCsv(withoutFlag),
    /status collection is not verified complete/
  );
});

test("quotes and preserves embedded newlines and commas", () => {
  const result = buildParticipantCsv(input({
    members: [{ id: "u1", username: 'A,"B"\\nC'.replace("\\n", "\n") }],
    rsvpStatuses: [rsvpStatuses[0]],
  }));
  assert.ok(result.csv.includes('"A,""B""\nC"'));
});
