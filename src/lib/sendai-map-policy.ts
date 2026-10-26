/** Sendai 2026: JST cutoff, shared by the UI and private API. */
export const SENDAI_MAP_EXPIRES_AT = Date.parse("2026-11-10T00:00:00+09:00");
export function sendaiMapIsActive(now = Date.now()): boolean {
  return Number.isFinite(now) && now < SENDAI_MAP_EXPIRES_AT;
}
export function sendaiMapRoleAllowed(role: string | null | undefined): boolean {
  return role === "ca" || role === "admin";
}

// Dedicated non-public storage object, never expose a public or signed URL.
export const SENDAI_MAP_BUCKET = "sendai-city-operations-private";
export const SENDAI_MAP_OBJECT = "2026-11-08/viewer-snapshot.json";
