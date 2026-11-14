// Connection selection only. API keys/JWTs still need server verification.
const PRODUCTION_REF = "wgiittrvgtiosogyhfcl";
const UNRELATED_LAB_REF = "azkshxjgsbtjgwbapcfw";

// PC OAuth QA is a separate, explicitly opted-in browser-only development path.
// It can never select a hosted Supabase project, production key or Vercel build.
// The server-side admin factory intentionally does not support this path.
export const PC_QA_AUTH_API = "http://127.0.0.1:56321";
export const PC_QA_UI_ORIGIN = "http://127.0.0.1:56490";
export function isLocalPcQaBrowserConfig(env: {
  url?: string; key?: string; deployment?: string; localPcQa?: boolean; browserOrigin?: string;
}) {
  if (env.localPcQa !== true || env.deployment !== "development" ||
      env.browserOrigin !== PC_QA_UI_ORIGIN || env.url !== PC_QA_AUTH_API) return false;
  const key = env.key ?? "";
  try {
    const parts = key.split(".");
    if (parts.length !== 3 || parts.some(p => !/^[A-Za-z0-9_-]+$/.test(p))) return false;
    const body = parts[1].replace(/-/g,"+").replace(/_/g,"/");
    const claims = JSON.parse(atob(body + "=".repeat((4 - body.length % 4) % 4)));
    // Local Supabase CLI keys may omit ref; a hosted ref is never accepted.
    return claims?.role === "anon" &&
      (claims.ref === undefined || claims.ref === "ca-clover-claim-pcqa-20261114") &&
      (claims.exp === undefined || (Number.isSafeInteger(claims.exp) && claims.exp * 1000 > Date.now()));
  } catch { return false; }
}

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
