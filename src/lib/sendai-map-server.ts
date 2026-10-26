import { createClient } from "@supabase/supabase-js";

// Match the existing browser's public connection default. This fallback is only
// for Sendai MAP and does not alter other API clients or service credentials.
export function sendaiMapServerConfig(env: Record<string, string | undefined>) {
  return {
    url: env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "https://wgiittrvgtiosogyhfcl.supabase.co",
    key: env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "",
  };
}
export function createSendaiMapAdminClient() {
  const { url, key } = sendaiMapServerConfig(process.env);
  if (!key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
