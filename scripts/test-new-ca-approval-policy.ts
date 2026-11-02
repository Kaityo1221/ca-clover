import assert from "node:assert/strict";
import {
  APAC_CA_GUILD_ID,
  APAC_CA_ROLE_ID,
  evaluateNewCaEligibility,
  type CaMasterEvidence,
  type NewCaEvidence,
} from "../src/lib/new-ca-approval-policy.ts";

const now = new Date("2026-11-03T03:00:00.000Z");
const caId = "00000000-0000-4000-8000-000000000001";
const communityId = "00000000-0000-4000-8000-000000000002";
const googleId = "00000000-0000-4000-8000-000000000003";

const master: CaMasterEvidence = {
  id: caId,
  trainerName: "SyntheticCA0001",
  caLevel: "1st",
  status: "active",
  communityIds: [communityId],
  existingUserId: null,
};
const application: NewCaEvidence = {
  discordUserId: "837092365658619934",
  discordGuildId: APAC_CA_GUILD_ID,
  discordRoleIds: [APAC_CA_ROLE_ID],
  discordVerifiedAt: "2026-11-03T02:55:00.000Z",
  trainerName: "SyntheticCA0001",
  caMemberId: caId,
  resolvedCommunityId: communityId,
  googleUserId: googleId,
  googleProviderVerified: true,
  alreadyBoundCaMemberIdForGoogle: null,
  alreadyBoundUserIdForDiscord: null,
  adminReviewedDiscordUserId: "837092365658619934",
  adminProfileReviewed: true,
};

function expect(label: string, overrides: Partial<NewCaEvidence>, expected: string, masterOverride: CaMasterEvidence | null = master) {
  const actual = evaluateNewCaEligibility({ ...application, ...overrides }, masterOverride, now);
  assert.equal(actual.reason, expected, label);
  console.log("PASS", label);
}

expect("verified synthetic evidence is eligible but NOT activated", {}, "EVIDENCE_VERIFIED");
expect("Discord role absent", { discordRoleIds: [] }, "APAC_CA_ROLE_UNVERIFIED");
expect("wrong Discord guild", { discordGuildId: "123" }, "APAC_CA_ROLE_UNVERIFIED");
expect("expired Discord OAuth evidence", { discordVerifiedAt: "2026-11-01T00:00:00.000Z" }, "DISCORD_EVIDENCE_EXPIRED");
expect("future-dated OAuth evidence", { discordVerifiedAt: "2026-12-01T00:00:00.000Z" }, "DISCORD_EVIDENCE_EXPIRED");
expect("trainer mismatch", { trainerName: "Impersonator" }, "CA_MASTER_MISMATCH");
expect("inactive CA", {}, "CA_MASTER_MISMATCH", { ...master, status: "inactive" });
expect("existing account cannot be overwritten", {}, "EXISTING_IDENTITY_PROTECTED", { ...master, existingUserId: googleId });
expect("previously linked Google account cannot be reassigned", { alreadyBoundCaMemberIdForGoogle: caId }, "EXISTING_IDENTITY_PROTECTED");
expect("already bound Discord ID cannot be reused", { alreadyBoundUserIdForDiscord: googleId }, "EXISTING_IDENTITY_PROTECTED");
expect("unresolved Campfire community blocked", { resolvedCommunityId: null }, "COMMUNITY_MEMBERSHIP_UNVERIFIED");
expect("other CA community blocked", { resolvedCommunityId: googleId }, "COMMUNITY_MEMBERSHIP_UNVERIFIED");
expect("Google not verified", { googleProviderVerified: false }, "GOOGLE_IDENTITY_UNVERIFIED");
expect("Google account not linked", { googleUserId: null }, "GOOGLE_IDENTITY_UNVERIFIED");
expect("admin review required", { adminProfileReviewed: false }, "ADMIN_REVIEW_REQUIRED");
expect("mismatched admin-confirmed Discord account", { adminReviewedDiscordUserId: "1506624152541466685" }, "ADMIN_DISCORD_ID_MISMATCH");

const allClear = evaluateNewCaEligibility(application, master, now);
assert.equal(allClear.state, "eligible_for_atomic_approval");
console.log("PASS explicit approval and atomic database transaction still required");
