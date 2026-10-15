// Standalone, fixture-only CSV core. Never contacts Campfire or Supabase.
// This module is not connected to production authorization or UI.

const ALLOWED_STATUSES = new Set(["ACCEPTED", "CHECKED_IN", "DECLINED"]);
const MAX_RECORDS = 20000;

function requiredString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(label + " is required");
  }
  return value.trim();
}

function csvCell(value) {
  let text = String(value ?? "");
  // Guard against CSV formula injection in Excel and other spreadsheet viewers.
  if (/^\s*[=+\-@]/u.test(text) || /^[\t\r\n]/u.test(text)) {
    text = "'" + text;
  }
  return '"' + text.replace(/"/g, '""') + '"';
}

function csvLine(cells) {
  return cells.map(csvCell).join(",");
}

function safeEventId(value) {
  return value.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 80);
}

export function makeCsvFilename(event) {
  const id = safeEventId(requiredString(event?.id, "event.id"));
  const d = event?.eventTime ? new Date(event.eventTime) : null;
  const date = d && !Number.isNaN(d.getTime())
    ? d.toISOString().slice(0, 10).replace(/-/g, "")
    : "undated";
  return "meetup_" + date + "_" + id + ".csv";
}

export function buildParticipantCsv({ event, members, rsvpStatuses, allPagesComplete }) {
  requiredString(event?.id, "event.id");
  if (allPagesComplete !== true) throw new Error("Member pagination is not complete");
  if (!Array.isArray(members) || !Array.isArray(rsvpStatuses)) {
    throw new Error("members and rsvpStatuses must be arrays");
  }
  if (members.length > MAX_RECORDS || rsvpStatuses.length > MAX_RECORDS) {
    throw new Error("Participant count exceeds safety limit");
  }

  const byId = new Map();
  for (const member of members) {
    const id = requiredString(member?.id, "member.id");
    const username = typeof member?.username === "string" && member.username.trim() ? member.username : "";
    const existing = byId.get(id);
    if (existing && existing.username !== username) {
      throw new Error("Conflicting usernames for participant");
    }
    byId.set(id, { username });
  }

  const byStatus = new Map();
  for (const record of rsvpStatuses) {
    const id = requiredString(record?.userId, "rsvpStatuses.userId");
    const status = requiredString(record?.rsvpStatus, "rsvpStatuses.rsvpStatus");
    if (!ALLOWED_STATUSES.has(status)) throw new Error("Unsupported RSVP status");
    if (byStatus.has(id) && byStatus.get(id) !== status) {
      throw new Error("Conflicting RSVP statuses for participant");
    }
    byStatus.set(id, status);
  }

  const rows = [];
  for (const [id, status] of byStatus.entries()) {
    // Declined attendees are not part of the participant export.
    if (status === "DECLINED") continue;
    const username = byId.get(id)?.username;
    if (!username) throw new Error("Participant username missing; refusing partial CSV");
    rows.push({
      username,
      participation: "あり",
      checkin: status === "CHECKED_IN" ? "済" : "未",
      status
    });
  }

  rows.sort((a, b) => a.username.localeCompare(b.username, "ja"));
  const checkedIn = rows.filter((r) => r.status === "CHECKED_IN").length;
  const text = [
    csvLine(["アカウント名", "参加表明", "チェックイン"]),
    ...rows.map((r) => csvLine([r.username, r.participation, r.checkin])),
  ].join("\r\n") + "\r\n";

  return {
    filename: makeCsvFilename(event),
    csv: "\uFEFF" + text,
    summary: {
      participating: rows.length,
      checkedIn,
      excludedDeclined: [...byStatus.values()].filter((s) => s === "DECLINED").length,
      rows: rows.length,
    }
  };
}
