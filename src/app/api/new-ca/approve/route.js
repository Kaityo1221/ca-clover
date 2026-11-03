import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";
import { isIsolatedBridgeReady, BRIDGE_GUARD_MARKER } from "@/lib/new-ca-bridge-policy";
import { checkDiscordCurrentRole } from "@/lib/new-ca-discord-live";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const AUTH_URL = "https://wgiittrvgtiosogyhfcl.supabase.co";
const KEY = "sb_publishable_QTCqijfNvnysUTMylNIyTA_6ngosaPN";
const result = (status, code, extra={}) => NextResponse.json(
  { code, isolated: true, productionActivated: false, ...extra },
  { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } },
);

/** Isolated authorization endpoint: never writes CA Clover Supabase.
 * All STEP1/STEP2 evidence is reconstructed by the server.
 */
export async function POST(request) {
  if (!isIsolatedBridgeReady(process.env) ||
      process.env.NEW_CA_ISOLATED_APPROVAL_ENABLED !== "true")
    return result(503, "APPROVAL_WRITE_GATE_CLOSED");
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return result(403, "ORIGIN_MISMATCH");
  if (!(request.headers.get("content-type") || "").startsWith("application/json"))
    return result(415, "JSON_REQUIRED");
  const bearer=request.headers.get("authorization") || "";
  if (!/^Bearer [\w.-]{16,8192}$/.test(bearer))
    return result(401, "AUTH_REQUIRED");
  let body;
  try { body=await request.json(); } catch { return result(400, "BAD_JSON"); }
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      Object.keys(body).sort().join(",") !== "confirmedDiscordId,requestId" ||
      typeof body.requestId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.requestId) ||
      typeof body.confirmedDiscordId !== "string" ||
      !/^\d{15,22}$/.test(body.confirmedDiscordId))
    return result(400, "BAD_REQUEST");

  const url=process.env.NEXT_PUBLIC_SUPABASE_URL || AUTH_URL;
  if (url!==AUTH_URL) return result(503, "AUTH_CONFIGURATION_INVALID");
  const supabase=createClient(url,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || KEY,{
    global:{headers:{Authorization:bearer}},
    auth:{persistSession:false,autoRefreshToken:false},
  });
  const {data:{user}={},error:authErr}=await supabase.auth.getUser(bearer.slice(7));
  if (authErr || !user) return result(401, "AUTH_REQUIRED");
  const {data:profile,error:roleErr}=await supabase.from("profiles")
    .select("role").eq("id",user.id).maybeSingle();
  if (roleErr || profile?.role!=="admin") return result(403, "ADMIN_REQUIRED");

  // The current guild membership must be verified at the time of approval.
  // A saved historic role flag is never adequate.
  if (!await checkDiscordCurrentRole(body.confirmedDiscordId,process.env.NEW_CA_DISCORD_BOT_TOKEN))
    return result(409, "DISCORD_LIVE_ROLE_UNVERIFIED");

  let db;
  try {
    db = new Client({connectionString:process.env.NEW_CA_LAB_DATABASE_URL,
      connectionTimeoutMillis:5000,ssl:{rejectUnauthorized:true}});
    await db.connect();
    await db.query("BEGIN READ ONLY");
    await db.query("SET LOCAL statement_timeout='5s'");
    const guard = await db.query("SELECT marker FROM ca_onboarding_lab.environment_guard WHERE marker=$1", [BRIDGE_GUARD_MARKER]);
    if (guard.rowCount!==1) throw Error("guard_missing");
    const evidence = await db.query(
      "SELECT r.status,r.discord_user_id,r.admin_verified_discord_id,r.reviewed_at,l.clover_user_id,sp.role AS lab_role FROM ca_onboarding_lab.requests r LEFT JOIN ca_onboarding_lab.clover_identity_links l ON l.request_id=r.id LEFT JOIN ca_onboarding_lab.synthetic_profiles sp ON sp.user_id=l.clover_user_id WHERE r.id=$1::uuid",
      [body.requestId]);
    await db.query("COMMIT");
    if (evidence.rowCount!==1) return result(404,"APPLICATION_NOT_FOUND");
    const row=evidence.rows[0];
    if (row.status!=="ready_to_activate" || row.discord_user_id!==body.confirmedDiscordId ||
        row.admin_verified_discord_id!==body.confirmedDiscordId || !row.reviewed_at)
      return result(409,"REVIEW_EVIDENCE_MISSING");
    if (!row.clover_user_id || row.lab_role!=="pending")
      return result(409,"ISOLATED_PENDING_LINK_REQUIRED");
    return result(409,"TRUSTED_CAMPFIRE_RESOLVER_REQUIRED", {isolatedEvidenceChecked:true});
  } catch {
    if (db) await db.query("ROLLBACK").catch(()=>{});
    return result(503,"ISOLATED_EVIDENCE_UNAVAILABLE");
  } finally {
    if (db) await db.end().catch(()=>{});
  }
}
