import test from "node:test";
import assert from "node:assert/strict";
import { inspectParticipantData, printSafeDiagnosticSummary } from "./api-diagnostic-contract.mjs";

const seed = () => ({
  expectedEventId: "mock-event",
  event: { id: "mock-event", members: { totalCount: 3 }, checkedInMembersCount: 1 },
  members: [
    { id: "u1", username: "Private_A" },
    { id: "u2", username: "Private_B" },
    { id: "u3", username: "Private_C" },
  ],
  memberPaginationComplete: true,
  rsvpStatuses: [
    { userId: "u1", rsvpStatus: "ACCEPTED" },
    { userId: "u2", rsvpStatus: "CHECKED_IN" },
    { userId: "u3", rsvpStatus: "DECLINED" },
  ],
});

test("unproven status-list completeness remains PARTIAL even if totals align", () => {
  const report = inspectParticipantData(seed());
  assert.equal(report.status, "PARTIAL");
  assert.deepEqual(report.reasonCodes, ["STATUS_LIST_COMPLETENESS_UNVERIFIED"]);
  assert.equal(report.checkedInCount, 1);
});

test("explicit independent evidence allows PASS for a consistent fixture", () => {
  const report = inspectParticipantData({ ...seed(), statusCompletenessVerified: true });
  assert.equal(report.status, "PASS");
  assert.equal(report.accountJoinComplete, true);
  assert.equal(report.acceptedCount, 1);
  assert.equal(report.declinedCount, 1);
});

test("wrong event ID is STOP", () => {
  const input = seed();
  const report = inspectParticipantData({ ...input, expectedEventId: "wrong" });
  assert.equal(report.status, "STOP");
  assert.ok(report.reasonCodes.includes("EVENT_ID_MISMATCH"));
});

test("truncated pagination is STOP", () => {
  const input = seed();
  const report = inspectParticipantData({
    ...input, members: input.members.slice(0, 2), memberPaginationComplete: false,
  });
  assert.equal(report.status, "STOP");
  assert.ok(report.reasonCodes.includes("MEMBER_TOTAL_MISMATCH"));
  assert.ok(report.reasonCodes.includes("MEMBER_PAGINATION_UNVERIFIED"));
});

test("check-in mismatch is STOP, not silently adjusted", () => {
  const input = seed();
  const report = inspectParticipantData({
    ...input, event: { ...input.event, checkedInMembersCount: 2 },
  });
  assert.equal(report.status, "STOP");
  assert.ok(report.reasonCodes.includes("CHECKIN_TOTAL_MISMATCH"));
});

test("missing username or member mapping is STOP", () => {
  const input = seed();
  const report = inspectParticipantData({
    ...input, members: [{ id: "u1", username: "Private_A" }, { id: "u2" }, input.members[2]],
  });
  assert.equal(report.status, "STOP");
  assert.ok(report.reasonCodes.includes("MEMBER_IDENTITY_MISSING"));
  assert.ok(report.reasonCodes.includes("PARTICIPANT_USERNAME_MISSING"));
});

test("unknown status enum and duplicate IDs are STOP", () => {
  const input = seed();
  const report = inspectParticipantData({
    ...input,
    rsvpStatuses: [
      input.rsvpStatuses[0], input.rsvpStatuses[0],
      { userId: "u2", rsvpStatus: "UNKNOWN_STATUS" },
    ],
  });
  assert.equal(report.status, "STOP");
  assert.ok(report.reasonCodes.includes("DUPLICATE_STATUS_ID"));
  assert.ok(report.reasonCodes.includes("STATUS_UNRECOGNIZED"));
});

test("invalid response fields are STOP", () => {
  const input = seed();
  const report = inspectParticipantData({ ...input, rsvpStatuses: null });
  assert.equal(report.status, "STOP");
  assert.ok(report.reasonCodes.includes("RESPONSE_FIELDS_MISSING"));
});

test("empty event is valid if independent status proof is supplied", () => {
  const input = seed();
  const report = inspectParticipantData({
    ...input,
    event: { id: "mock-event", members: { totalCount: 0 }, checkedInMembersCount: 0 },
    members: [], rsvpStatuses: [], statusCompletenessVerified: true,
  });
  assert.equal(report.status, "PASS");
  assert.equal(report.memberCount, 0);
});

test("safe report never prints usernames, event IDs or raw API payloads", () => {
  const input = seed();
  const result = inspectParticipantData(input);
  const shown = printSafeDiagnosticSummary(result);
  assert.match(shown, /result=PARTIAL/);
  assert.ok(!shown.includes("Private_A"));
  assert.ok(!shown.includes("mock-event"));
  assert.ok(!shown.includes("u1"));
});

test("safe output codes reject unknown injected strings", () => {
  const printed = printSafeDiagnosticSummary({
    status: "PASS", memberCount: 1, reportedMemberCount: 1, checkedInCount: 0,
    reportedCheckInCount: 0, statusRecordCount: 1,
    reasonCodes: ["__PRIVATE__", "BAD: alice@example.org", "GOOD_CODE"],
  });
  assert.ok(!printed.includes("alice@example.org"));
  assert.ok(!printed.includes("__PRIVATE__"));
  assert.ok(!printed.includes("GOOD_CODE"));
});
