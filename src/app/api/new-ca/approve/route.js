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

  // Synthetic-only activation. Never issue production Supabase privileges.
  if (process.env.NEW_CA_SYNTHETIC_ACTIVATION_ENABLED !== "true")
    return result(503,"SYNTHETIC_ACTIVATION_GATE_CLOSED");
  let db;
  let committed=false;
  try {
    db=new Client({connectionString:process.env.NEW_CA_LAB_DATABASE_URL,
      connectionTimeoutMillis:5000,ssl:{rejectUnauthorized:true}});
    await db.connect();
    await db.query("BEGIN");
    await db.query("SET LOCAL statement_timeout='5s'");
    const guard=await db.query("SELECT marker FROM ca_onboarding_lab.environment_guard WHERE marker=$1 FOR SHARE",[BRIDGE_GUARD_MARKER]);
    if (guard.rowCount!==1) throw Error("guard_missing");
    const evidence=await db.query(`
      SELECT r.status,r.discord_user_id,r.admin_verified_discord_id,
             r.reviewed_at,r.reviewed_by,r.role_verified_at,r.google_subject,
             l.clover_user_id,sp.role AS lab_role,
             EXISTS(SELECT 1 FROM neon_auth.account a WHERE a."userId"::text=r.google_subject
               AND a."providerId"='google' AND a."accountId" IS NOT NULL) AS google_linked,
             EXISTS(SELECT 1 FROM ca_onboarding_lab.master_snapshot m
               WHERE lower(m.trainer_name)=lower(r.trainer_name)
               AND m.campfire_url=r.campfire_url AND m.community_key=r.community_key
               AND m.is_synthetic=true AND m.status='active'
               AND m.ca_level IN ('1st','2nd') AND m.already_linked_user IS NULL) AS synthetic_master
      FROM ca_onboarding_lab.requests r
      LEFT JOIN ca_onboarding_lab.clover_identity_links l ON l.request_id=r.id
      LEFT JOIN ca_onboarding_lab.synthetic_profiles sp ON sp.user_id=l.clover_user_id
      WHERE r.id=$1::uuid FOR UPDATE OF r
    `,[body.requestId]);
    if(evidence.rowCount!==1) {
      await db.query("ROLLBACK");
      return result(404,"APPLICATION_NOT_FOUND");
    }
    const row=evidence.rows[0];
    const roleAge=Date.now()-Date.parse(row.role_verified_at);
    const reviewedAge=Date.parse(row.reviewed_at)-Date.parse(row.role_verified_at);
    if(row.status!=="ready_to_activate" ||
       row.discord_user_id!==body.confirmedDiscordId ||
       row.admin_verified_discord_id!==body.confirmedDiscordId ||
       !row.reviewed_by || !row.google_linked || !row.synthetic_master ||
       !row.clover_user_id || row.lab_role!=="pending" ||
       !Number.isFinite(roleAge) || roleAge<0 || roleAge>86400000 ||
       !Number.isFinite(reviewedAge) || reviewedAge<0 || reviewedAge>86400000) {
      await db.query("ROLLBACK");
      return result(409,"SYNTHETIC_APPROVAL_EVIDENCE_INCOMPLETE");
    }
    const finalized=await db.query(
      "SELECT ca_onboarding_lab.finalize_isolated_approval($1::uuid,$2::uuid,$3::text) AS status",
      [body.requestId,row.clover_user_id,body.confirmedDiscordId]);
    if(!["isolated_finalized","already_finalized"].includes(finalized.rows[0]?.status))
      throw Error("finalizer_not_eligible");
    const activated=await db.query(
      "SELECT ca_onboarding_lab.activate_synthetic_ca($1::uuid,$2::uuid) AS status",
      [body.requestId,row.clover_user_id]);
    if(!["synthetic_ca_granted","already_granted"].includes(activated.rows[0]?.status))
      throw Error("activation_not_eligible");
    const verified=await db.query(`
      SELECT p.role,
       EXISTS(SELECT 1 FROM ca_onboarding_lab.synthetic_ca_identities i
              WHERE i.user_id=p.user_id AND i.request_id=$2::uuid) AS identity_exists,
       EXISTS(SELECT 1 FROM ca_onboarding_lab.synthetic_community_memberships m
              WHERE m.user_id=p.user_id AND m.request_id=$2::uuid) AS community_exists
      FROM ca_onboarding_lab.synthetic_profiles p WHERE p.user_id=$1::uuid
    `,[row.clover_user_id,body.requestId]);
    if(verified.rowCount!==1 || verified.rows[0].role!=="ca" ||
       !verified.rows[0].identity_exists || !verified.rows[0].community_exists)
      throw Error("postcondition_failed");
    await db.query("COMMIT");
    committed=true;
    return result(200,"SYNTHETIC_CA_ACTIVATED",{
      syntheticOnly:true,isolatedApprovalFinalized:true,
      syntheticCommunityActivated:true,productionActivated:false
    });
  } catch {
    if(db && !committed) await db.query("ROLLBACK").catch(()=>{});
    return result(503,"SYNTHETIC_ACTIVATION_ROLLED_BACK");
  } finally {
    if(db) await db.end().catch(()=>{});
  }
}
