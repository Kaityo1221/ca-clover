// Offline-only parser for *synthetic* Campfire-shaped diagnostic data.
// No network, token, filesystem, or console access. No account names/IDs in its output.
// Status completeness cannot be established from a bare rsvpStatuses array.
const VALID_STATUS = new Set(["ACCEPTED", "CHECKED_IN", "DECLINED"]);
const MAX_RECORDS = 20_000;
const REASON_CODES = new Set([
  "EVENT_ID_MISMATCH", "RESPONSE_FIELDS_MISSING", "RECORD_LIMIT",
  "MEMBER_TOTAL_UNKNOWN", "CHECKIN_TOTAL_UNKNOWN",
  "MEMBER_PAGINATION_UNVERIFIED", "MEMBER_TOTAL_MISMATCH",
  "MEMBER_IDENTITY_MISSING", "DUPLICATE_MEMBER_ID",
  "STATUS_ID_MISSING", "STATUS_UNRECOGNIZED", "DUPLICATE_STATUS_ID",
  "CHECKIN_TOTAL_MISMATCH", "PARTICIPANT_USERNAME_MISSING",
  "STATUS_LIST_COMPLETENESS_UNVERIFIED",
]);

function validCount(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

export function inspectParticipantData({
  expectedEventId,
  event,
  members,
  memberPaginationComplete = false,
  rsvpStatuses,
  statusCompletenessVerified = false,
}) {
  // Always return static status codes and aggregate numbers only.
  const problems = [];
  const report = {
    status: "STOP",
    reasonCodes: problems,
    memberCount: null,
    reportedMemberCount: null,
    reportedCheckInCount: null,
    acceptedCount: null,
    checkedInCount: null,
    declinedCount: null,
    statusRecordCount: null,
    memberPaginationComplete: memberPaginationComplete === true,
    statusCompletenessVerified: statusCompletenessVerified === true,
    accountJoinComplete: false,
  };

  if (typeof expectedEventId !== "string" ||
      !expectedEventId ||
      event?.id !== expectedEventId) {
    problems.push("EVENT_ID_MISMATCH");
  }

  if (!Array.isArray(members) || !Array.isArray(rsvpStatuses)) {
    problems.push("RESPONSE_FIELDS_MISSING");
    return report;
  }

  if (members.length > MAX_RECORDS || rsvpStatuses.length > MAX_RECORDS) {
    problems.push("RECORD_LIMIT");
    return report;
  }

  report.memberCount = members.length;
  report.statusRecordCount = rsvpStatuses.length;
  const totalCount = event?.members?.totalCount;
  const checkedCount = event?.checkedInMembersCount;
  if (validCount(totalCount)) report.reportedMemberCount = totalCount;
  else problems.push("MEMBER_TOTAL_UNKNOWN");
  if (validCount(checkedCount)) report.reportedCheckInCount = checkedCount;
  else problems.push("CHECKIN_TOTAL_UNKNOWN");

  if (memberPaginationComplete !== true) problems.push("MEMBER_PAGINATION_UNVERIFIED");
  if (validCount(totalCount) && members.length !== totalCount) {
    problems.push("MEMBER_TOTAL_MISMATCH");
  }

  const membersById = new Map();
  for (const member of members) {
    if (typeof member?.id !== "string" || !member.id ||
        typeof member?.username !== "string" || !member.username.trim()) {
      problems.push("MEMBER_IDENTITY_MISSING");
      continue;
    }
    if (membersById.has(member.id)) problems.push("DUPLICATE_MEMBER_ID");
    membersById.set(member.id, true);
  }

  const statusById = new Map();
  let accepted = 0, checkedIn = 0, declined = 0;
  for (const row of rsvpStatuses) {
    if (typeof row?.userId !== "string" || !row.userId) {
      problems.push("STATUS_ID_MISSING");
      continue;
    }
    if (!VALID_STATUS.has(row.rsvpStatus)) {
      problems.push("STATUS_UNRECOGNIZED");
      continue;
    }
    if (statusById.has(row.userId)) {
      problems.push("DUPLICATE_STATUS_ID");
      continue;
    }
    statusById.set(row.userId, row.rsvpStatus);
    if (row.rsvpStatus === "ACCEPTED") accepted++;
    if (row.rsvpStatus === "CHECKED_IN") checkedIn++;
    if (row.rsvpStatus === "DECLINED") declined++;
  }

  report.acceptedCount = accepted;
  report.checkedInCount = checkedIn;
  report.declinedCount = declined;
  if (validCount(checkedCount) && checkedIn !== checkedCount) {
    problems.push("CHECKIN_TOTAL_MISMATCH");
  }

  report.accountJoinComplete = [...statusById.entries()]
    .filter(([, s]) => s !== "DECLINED")
    .every(([id]) => membersById.has(id));
  if (!report.accountJoinComplete) problems.push("PARTICIPANT_USERNAME_MISSING");

  // IMPORTANT: The production query currently shows no totalCount for
  // rsvpStatuses. Matching checkedIn alone CANNOT prove all RSVPs are present.
  // Explicitly keep a structurally sound but unverified result at PARTIAL.
  if (problems.length > 0) {
    report.status = "STOP";
  } else if (statusCompletenessVerified !== true) {
    report.status = "PARTIAL";
    problems.push("STATUS_LIST_COMPLETENESS_UNVERIFIED");
  } else {
    report.status = "PASS";
  }

  report.reasonCodes = [...new Set(problems)].sort();
  return report;
}

export function printSafeDiagnosticSummary(report) {
  // This function intentionally avoids event IDs, usernames and raw responses.
  const fields = [
    "result=" + (["PASS", "PARTIAL", "STOP"].includes(report?.status) ? report.status : "STOP"),
    "member_count=" + (validCount(report?.memberCount) ? report.memberCount : "unknown"),
    "member_total=" + (validCount(report?.reportedMemberCount) ? report.reportedMemberCount : "unknown"),
    "checkin_count=" + (validCount(report?.checkedInCount) ? report.checkedInCount : "unknown"),
    "reported_checkin=" + (validCount(report?.reportedCheckInCount) ? report.reportedCheckInCount : "unknown"),
    "rsvp_records=" + (validCount(report?.statusRecordCount) ? report.statusRecordCount : "unknown"),
    "status_proof=" + (report?.statusCompletenessVerified === true ? "yes" : "no"),
    "issues=" + (Array.isArray(report?.reasonCodes)
      ? report.reasonCodes.filter(v => REASON_CODES.has(v)).join(",")
      : "DIAGNOSTIC_INVALID"),
  ];
  return fields.join("\n");
}
