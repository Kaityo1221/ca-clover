import test from "node:test";
import assert from "node:assert/strict";
import { canShowCsvExport, canAdminGrantCsvExport, CSV_EXPORT_PERMISSION } from "./csv-permission.mjs";

const base = {
  role: "ca",
  permissionCodes: [CSV_EXPORT_PERMISSION],
  membershipCommunityIds: ["own-community"],
  eventCommunityId: "own-community",
  authVerified: true,
};

test("CSV export is hidden unless explicitly granted", () => {
  assert.equal(canShowCsvExport({ ...base, permissionCodes: [] }), false);
  assert.equal(canShowCsvExport({ ...base, permissionCodes: ["S"] }), false);
  assert.equal(canShowCsvExport(base), true);
});

test("CSV permission does not bypass community membership", () => {
  assert.equal(canShowCsvExport({ ...base, eventCommunityId: "another-community" }), false);
  assert.equal(canShowCsvExport({ ...base, membershipCommunityIds: [] }), false);
  assert.equal(canShowCsvExport({ ...base, membershipCommunityIds: undefined }), false);
});

test("Pending and unknown roles do not see CSV even with a stored grant", () => {
  assert.equal(canShowCsvExport({ ...base, role: "pending" }), false);
  assert.equal(canShowCsvExport({ ...base, role: "unknown" }), false);
  assert.equal(canShowCsvExport({ ...base, role: null }), false);
});

test("Unverified or errored auth state fails closed", () => {
  assert.equal(canShowCsvExport({ ...base, authVerified: false }), false);
  assert.equal(canShowCsvExport({ ...base, authVerified: undefined }), false);
  assert.equal(canShowCsvExport({ ...base, eventCommunityId: "" }), false);
});

test("ADMIN view is allowed only after verified auth", () => {
  assert.equal(canShowCsvExport({ ...base, role: "admin", permissionCodes: [], membershipCommunityIds: [] }), true);
  assert.equal(canShowCsvExport({ ...base, role: "admin", authVerified: false }), false);
});

test("Only ADMIN can grant CSV permission to approved CA", () => {
  assert.equal(canAdminGrantCsvExport({ actorRole: "admin", targetRole: "ca" }), true);
  assert.equal(canAdminGrantCsvExport({ actorRole: "ca", targetRole: "ca" }), false);
  assert.equal(canAdminGrantCsvExport({ actorRole: "admin", targetRole: "pending" }), false);
  assert.equal(canAdminGrantCsvExport({ actorRole: "admin", targetRole: "admin" }), false);
});
