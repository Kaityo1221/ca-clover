/**
 * Security boundary for the *preview-only* Google identity bridge.
 * Keep environment verification and provider-sub extraction independently testable.
 */
export const BRIDGE_PREVIEW_BRANCH = "feature/new-ca-approval-admin-preview-20261103";
export const BRIDGE_DB_NAME = "ca_clover_test";
export const BRIDGE_GUARD_MARKER = "ca-onboarding-neon-auth-branch-20261103";

export function isIsolatedBridgeReady(env: Record<string, string | undefined>): boolean {
  if (env.NEW_CA_BRIDGE_ENABLED !== "true" ||
      env.VERCEL_ENV !== "preview" ||
      env.VERCEL_GIT_COMMIT_REF !== BRIDGE_PREVIEW_BRANCH ||
      !env.NEW_CA_LAB_DATABASE_URL) return false;
  try {
    const url = new URL(env.NEW_CA_LAB_DATABASE_URL);
    return ["postgres:", "postgresql:"].includes(url.protocol) &&
      url.hostname.endsWith(".neon.tech") &&
      url.pathname === "/" + BRIDGE_DB_NAME &&
      url.username.length > 0 && url.password.length > 0;
  } catch { return false; }
}

type Identity = {
  provider?: string;
  provider_id?: string;
  id?: string; // Internal Supabase identity-row id: never use as Google subject
  identity_data?: { sub?: unknown };
};

export function verifiedGoogleProviderSubject(user: { identities?: Identity[] } | null): string | null {
  const google = (user?.identities ?? []).filter(identity => identity.provider === "google");
  if (google.length !== 1) return null;
  const providerId = google[0].provider_id;
  const metadataSub = google[0].identity_data?.sub;
  if (typeof providerId !== "string" || !providerId.trim() ||
      (metadataSub != null && metadataSub !== providerId)) return null;
  return providerId;
}

export function allowedToBindPreview(
  role: string | null,
  linkedCaCount: number,
  matchedRequestCount: number,
): boolean {
  return role === "pending" && linkedCaCount === 0 && matchedRequestCount === 1;
}
