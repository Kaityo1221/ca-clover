// Offline UI visibility contract only. NEVER use browser visibility as authorization.
// Any production CSV endpoint MUST verify its own authenticated actor,
// CSV_EXPORT permission and event->community membership at request time.
export const CSV_EXPORT_PERMISSION = "CSV_EXPORT";

export function canShowCsvExport({
  role,
  permissionCodes,
  membershipCommunityIds,
  eventCommunityId,
  authVerified = false,
}) {
  if (authVerified !== true) return false; // unknown/error => hidden
  if (typeof eventCommunityId !== "string" || !eventCommunityId) return false;
  if (role === "admin") return true;
  if (role !== "ca") return false;
  if (!Array.isArray(permissionCodes) || !permissionCodes.includes(CSV_EXPORT_PERMISSION)) return false;
  if (!Array.isArray(membershipCommunityIds)) return false;
  return membershipCommunityIds.includes(eventCommunityId);
}

export function canAdminGrantCsvExport({ actorRole, targetRole }) {
  // Pending users are not eligible; admin role already has system-wide rights.
  return actorRole === "admin" && targetRole === "ca";
}
