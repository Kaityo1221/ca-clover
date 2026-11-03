import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";
import { isIsolatedBridgeReady, BRIDGE_GUARD_MARKER, verifiedGoogleProviderSubject } from "@/lib/new-ca-bridge-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const AUTH_URL = "https://wgiittrvgtiosogyhfcl.supabase.co";
const PUBLIC_KEY = "sb_publishable_QTCqijfNvnysUTMylNIyTA_6ngosaPN";
const respond = (status, code, extra = {}) => NextResponse.json(
  { code, isolated: true, productionActivated: false, ...extra },
  { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } },
);

/** Preview-only pending enrollment. The sole write target is the guarded Neon lab.
 * Never creates or modifies Supabase profiles, Auth identities, or CA permissions.
 */
export async function POST(request) {
  if (!isIsolatedBridgeReady(process.env)) return respond(503, "PREVIEW_ONLY");
  if (request.headers.get("origin") !== new URL(request.url).origin) return respond(403, "ORIGIN_MISMATCH");
  const bearer = request.headers.get("authorization") || "";
  if (!/^Bearer [\w.-]{16,8192}$/.test(bearer)) return respond(401, "SESSION_REQUIRED");
  if (request.headers.get("content-length") && Number(request.headers.get("content-length")) > 0)
    return respond(400, "BODY_NOT_ALLOWED");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || AUTH_URL;
  if (url !== AUTH_URL) return respond(503, "AUTH_CONFIG_MISMATCH");
  let db;
  try {
    const supabase = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || PUBLIC_KEY, {
      global: { headers: { Authorization: bearer } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: auth, error: authError } = await supabase.auth.getUser(bearer.slice(7));
    if (authError || !auth?.user) return respond(401, "INVALID_SESSION");
    if (!verifiedGoogleProviderSubject(auth.user)) return respond(403, "GOOGLE_IDENTITY_REQUIRED");
    const { data: profile, error: profileError } = await supabase.from("profiles")
      .select("role").eq("id", auth.user.id).maybeSingle();
    if (profileError) return respond(503, "PROFILE_READ_FAILED");
    if (profile) return respond(409, "EXISTING_PROFILE_PROTECTED");
    const { count, error: identityError } = await supabase.from("user_ca_identities")
      .select("ca_member_id", { count: "exact", head: true }).eq("user_id", auth.user.id);
    if (identityError || count == null) return respond(503, "IDENTITY_READ_FAILED");
    if (count !== 0) return respond(409, "EXISTING_CA_IDENTITY_PROTECTED");

    db = new Client({ connectionString: process.env.NEW_CA_LAB_DATABASE_URL,
      connectionTimeoutMillis: 5000, ssl: { rejectUnauthorized: true } });
    await db.connect();
    await db.query("BEGIN");
    await db.query("SET LOCAL statement_timeout = '5s'");
    const guard = await db.query("SELECT marker FROM ca_onboarding_lab.environment_guard WHERE marker=$1 FOR SHARE", [BRIDGE_GUARD_MARKER]);
    if (guard.rowCount !== 1) throw Error("isolation guard missing");
    await db.query(`INSERT INTO ca_onboarding_lab.synthetic_profiles(user_id,role)
      VALUES($1::uuid,'pending') ON CONFLICT (user_id) DO NOTHING`, [auth.user.id]);
    const current = await db.query("SELECT role FROM ca_onboarding_lab.synthetic_profiles WHERE user_id=$1::uuid", [auth.user.id]);
    if (current.rowCount !== 1 || current.rows[0].role !== "pending") {
      await db.query("ROLLBACK");
      return respond(409, "ISOLATED_ROLE_PROTECTED");
    }
    await db.query("COMMIT");
    return respond(200, "ISOLATED_PENDING_READY", { role: "pending" });
  } catch {
    if (db) await db.query("ROLLBACK").catch(() => {});
    return respond(503, "ISOLATED_ENROLLMENT_UNAVAILABLE");
  } finally {
    if (db) await db.end().catch(() => {});
  }
}
