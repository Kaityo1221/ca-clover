import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isIsolatedBridgeReady, verifiedGoogleProviderSubject } from "@/lib/new-ca-bridge-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const URL_PIN = "https://wgiittrvgtiosogyhfcl.supabase.co";
const PUBLIC_KEY = "sb_publishable_QTCqijfNvnysUTMylNIyTA_6ngosaPN";
const respond = (status, code, details = {}) => NextResponse.json(
  { code, isolated: true, productionActivated: false, ...details },
  { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } }
);

// Diagnostic only. Never inserts profiles, changes auth users, or grants CA roles.
export async function GET(request) {
  if (!isIsolatedBridgeReady(process.env))
    return respond(503, "PREVIEW_ONLY");
  const bearer = request.headers.get("authorization") || "";
  if (!/^Bearer [\w.-]{16,8192}$/.test(bearer))
    return respond(401, "SESSION_REQUIRED");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || URL_PIN;
  if (url !== URL_PIN) return respond(503, "AUTH_CONFIG_MISMATCH");
  try {
    const supabase = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || PUBLIC_KEY, {
      global: { headers: { Authorization: bearer } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.auth.getUser(bearer.slice(7));
    if (error || !data?.user) return respond(401, "INVALID_SESSION");
    const { data: profile, error: profileError } = await supabase.from("profiles")
      .select("role").eq("id", data.user.id).maybeSingle();
    if (profileError) return respond(503, "PROFILE_READ_FAILED");
    if (!profile) return respond(200, "PROFILE_MISSING", { googleProviderVerified: !!verifiedGoogleProviderSubject(data.user) });
    if (!["pending", "ca", "admin"].includes(profile.role))
      return respond(409, "PROFILE_ROLE_INVALID");
    return respond(200, "PROFILE_FOUND", {
      role: profile.role,
      googleProviderVerified: !!verifiedGoogleProviderSubject(data.user),
    });
  } catch {
    return respond(503, "AUTH_DIAGNOSTIC_UNAVAILABLE");
  }
}
