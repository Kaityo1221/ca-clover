/**
 * Pure, side-effect-free eligibility policy for NEW CA onboarding.
 * Draft only. Passing this function NEVER grants membership, roles, or privileges.
 * All evidence below must be reconstructed server-side from verified sources.
 */
export const APAC_CA_GUILD_ID = "1463804285681926373";
export const APAC_CA_ROLE_ID = "1506624152541466685";

export type CaMasterEvidence = {
  id: string;
  trainerName: string;
  caLevel: "1st" | "2nd" | null;
  status: string | null;
  communityIds: readonly string[];
  // Existing account links are immutable; do not transfer an established CA identity.
  existingUserId: string | null;
};

export type NewCaEvidence = {
  discordUserId: string;
  discordGuildId: string;
  discordRoleIds: readonly string[];
  discordVerifiedAt: string;
  trainerName: string;
  caMemberId: string;
  // Resolve the Campfire URL on the trusted server; never trust a browser-supplied ID.
  resolvedCommunityId: string | null;
  googleUserId: string | null;
  googleProviderVerified: boolean;
  alreadyBoundCaMemberIdForGoogle: string | null;
  alreadyBoundUserIdForDiscord: string | null;
  adminReviewedDiscordUserId: string | null;
  adminProfileReviewed: boolean;
};

export type EligibilityResult =
  | { state: "blocked"; reason: string }
  | { state: "pending"; reason: string }
  | { state: "eligible_for_atomic_approval"; reason: "EVIDENCE_VERIFIED" };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const discordPattern = /^\d{15,22}$/;
const normalizeTrainer = (value: string) => value.normalize("NFKC").trim().toLowerCase();

export function evaluateNewCaEligibility(
  application: NewCaEvidence,
  master: CaMasterEvidence | null,
  now: Date = new Date(),
): EligibilityResult {
  if (!discordPattern.test(application.discordUserId) ||
      application.discordGuildId !== APAC_CA_GUILD_ID ||
      !application.discordRoleIds.includes(APAC_CA_ROLE_ID)) {
    return { state: "blocked", reason: "APAC_CA_ROLE_UNVERIFIED" };
  }

  const roleTime = Date.parse(application.discordVerifiedAt);
  if (!Number.isFinite(roleTime) ||
      roleTime > now.getTime() + 60_000 ||
      now.getTime() - roleTime > 24 * 60 * 60 * 1000) {
    return { state: "blocked", reason: "DISCORD_EVIDENCE_EXPIRED" };
  }

  if (!master ||
      !uuidPattern.test(master.id) ||
      application.caMemberId !== master.id ||
      master.status !== "active" ||
      !["1st", "2nd"].includes(master.caLevel ?? "") ||
      !application.trainerName.trim() ||
      normalizeTrainer(application.trainerName) !== normalizeTrainer(master.trainerName)) {
    return { state: "blocked", reason: "CA_MASTER_MISMATCH" };
  }

  if (master.existingUserId ||
      application.alreadyBoundCaMemberIdForGoogle ||
      application.alreadyBoundUserIdForDiscord) {
    return { state: "blocked", reason: "EXISTING_IDENTITY_PROTECTED" };
  }

  if (!application.resolvedCommunityId ||
      !uuidPattern.test(application.resolvedCommunityId) ||
      !master.communityIds.includes(application.resolvedCommunityId)) {
    return { state: "blocked", reason: "COMMUNITY_MEMBERSHIP_UNVERIFIED" };
  }

  if (!application.googleUserId ||
      !uuidPattern.test(application.googleUserId) ||
      !application.googleProviderVerified) {
    return { state: "pending", reason: "GOOGLE_IDENTITY_UNVERIFIED" };
  }

  if (!application.adminProfileReviewed) {
    return { state: "pending", reason: "ADMIN_REVIEW_REQUIRED" };
  }

  if (application.adminReviewedDiscordUserId !== application.discordUserId) {
    return { state: "blocked", reason: "ADMIN_DISCORD_ID_MISMATCH" };
  }

  // Explicit admin decision and an atomic DB transaction are still REQUIRED.
  // This function must never be used as an authorization grant.
  return { state: "eligible_for_atomic_approval", reason: "EVIDENCE_VERIFIED" };
}
