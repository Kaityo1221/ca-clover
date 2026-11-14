// Connection selection only. API keys/JWTs still need server verification.
const PRODUCTION_REF = "wgiittrvgtiosogyhfcl";
const UNRELATED_LAB_REF = "azkshxjgsbtjgwbapcfw";

export function resolveSupabaseEndpoint(env: {
  url?: string; deployment?: string; isolatedRef?: string;
}) {
  try {
    const url = new URL(env.url?.trim() ?? "");
    if (url.protocol !== "https:" || url.username || url.password || url.port ||
        url.pathname !== "/" || url.search || url.hash) return null;
    const match = /^([a-z0-9]{20})\.supabase\.co$/.exec(url.hostname);
    if (!match) return null;
    const ref = match[1];
    if (env.deployment === "production") {
      if (ref !== PRODUCTION_REF || env.isolatedRef) return null;
    } else if (!env.isolatedRef || ref !== env.isolatedRef ||
               ref === PRODUCTION_REF || ref === UNRELATED_LAB_REF) return null;
    return {url: url.origin, ref, isolated: ref !== PRODUCTION_REF};
  } catch { return null; }
}

export function isSupabaseKeyForRole(key: string, ref: string, role: "anon" | "service_role") {
  if (key.startsWith(role === "anon" ? "sb_publishable_" : "sb_secret_"))
    return /^[A-Za-z0-9_-]+$/.test(key) && key.length >= 24;
  try {
    const parts = key.split(".");
    if (parts.length !== 3 || parts.some(part => !/^[A-Za-z0-9_-]+$/.test(part))) return false;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const claims = JSON.parse(atob(base64 + "=".repeat((4-base64.length%4)%4)));
    return claims.role === role && claims.ref === ref;
  } catch { return false; }
}
