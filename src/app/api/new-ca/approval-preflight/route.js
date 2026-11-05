import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";
import { isIsolatedPreflightReady, BRIDGE_GUARD_MARKER } from "@/lib/new-ca-bridge-policy";
import { checkDiscordCurrentRole } from "@/lib/new-ca-discord-live";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const SUPABASE_ORIGIN = "https://wgiittrvgtiosogyhfcl.supabase.co";
const KEY = "sb_publishable_QTCqijfNvnysUTMylNIyTA_6ngosaPN";
const reply = (status, value) => NextResponse.json(value, {
  status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
});

/**
 * Read-only approval preflight for the dedicated Vercel preview branch.
 * Does NOT produce trusted evidence, approve any record, or issue CA privileges.
 */
export async function POST(request) {
  if (!isIsolatedPreflightReady(process.env))
    return reply(503, { code: "PREVIEW_ONLY", productionActivated: false });
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return reply(403, { code: "ORIGIN_MISMATCH", productionActivated: false });
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json"))
    return reply(415, { code: "JSON_REQUIRED", productionActivated: false });
  const bearer = request.headers.get("authorization") ?? "";
  if (!/^Bearer [\w.-]{16,8192}$/.test(bearer))
    return reply(401, { code: "BEARER_REQUIRED", productionActivated: false });
  let body;
  try { body = await request.json(); } catch {
    return reply(400, { code: "INVALID_JSON", productionActivated: false });
  }
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      Object.keys(body).sort().join(",") !== "confirmedDiscordId,requestId" ||
      typeof body.requestId !== "string" || typeof body.confirmedDiscordId !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(body.requestId) || !/^\d{15,22}$/.test(body.confirmedDiscordId))
    return reply(400, { code: "INVALID_REQUEST", productionActivated: false });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || SUPABASE_ORIGIN;
  if (url !== SUPABASE_ORIGIN) return reply(503, { code: "AUTH_CONFIG_MISMATCH", productionActivated: false });
  const supabase = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || KEY, {
    global: { headers: { Authorization: bearer } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user } = {}, error: userError } = await supabase.auth.getUser(bearer.slice(7));
  if (userError || !user) return reply(401, { code: "INVALID_SESSION", productionActivated: false });
  const { data: profile, error: profileError } = await supabase.from("profiles")
    .select("role").eq("id", user.id).maybeSingle();
  if (profileError || profile?.role !== "admin")
    return reply(403, { code: "ADMIN_REQUIRED", productionActivated: false });
  const { count, error: identityError } = await supabase.from("user_ca_identities")
    .select("ca_member_id", { head: true, count: "exact" }).eq("user_id", user.id);
  // The administrator can be an existing CA; a failed read must never be considered clean.
  if (identityError || count == null) return reply(503, { code: "IDENTITY_CHECK_UNAVAILABLE", productionActivated: false });

  let db;
  try {
    db = new Client({
      connectionString: process.env.NEW_CA_LAB_DATABASE_URL,
      connectionTimeoutMillis: 5000, ssl: { rejectUnauthorized: true },
    });
    await db.connect();
    await db.query("BEGIN READ ONLY");
    await db.query("SET LOCAL statement_timeout = '5s'");
    const guard = await db.query("SELECT marker FROM ca_onboarding_lab.environment_guard WHERE marker=$1", [BRIDGE_GUARD_MARKER]);
    if (guard.rowCount !== 1) throw new Error("missing isolation marker");
    const result = await db.query(`
      SELECT r.id, r.status, r.discord_user_id,
             r.admin_verified_discord_id, r.reviewed_at,
             r.guild_id, r.apac_role_id, r.role_verified_at,
             EXISTS(
               SELECT 1 FROM ca_onboarding_lab.clover_identity_links l
               WHERE l.request_id=r.id
             ) AS linked,
             EXISTS(
               SELECT 1 FROM ca_onboarding_lab.finalized_approvals f
               WHERE f.request_id=r.id
             ) AS finalized,
             EXISTS(
               SELECT 1 FROM neon_auth.account a
               WHERE a."userId"::text=r.google_subject AND a."providerId"='google'
                 AND a."accountId" IS NOT NULL
             ) AS neon_google_linked,
             (
               SELECT count(*) = 1 FROM ca_onboarding_lab.master_snapshot m
               WHERE lower(trim(m.trainer_name))=lower(trim(r.trainer_name))
                 AND m.is_synthetic=true
             ) AND (
               SELECT count(*) = 1 FROM ca_onboarding_lab.master_snapshot m
               WHERE lower(trim(m.trainer_name))=lower(trim(r.trainer_name))
                 AND m.campfire_url=r.campfire_url
                 AND m.community_key=r.community_key
                 AND m.is_synthetic=true AND m.status='active'
                 AND m.ca_level IN ('1st','2nd')
                 AND m.already_linked_user IS NULL
             ) AS synthetic_master_valid
      FROM ca_onboarding_lab.requests r
      WHERE r.id=$1::uuid`, [body.requestId]);
    await db.query("COMMIT");
    if (result.rows.length !== 1) return reply(404, { code: "APPLICATION_NOT_FOUND_OR_AMBIGUOUS", productionActivated: false });
    const row = result.rows[0];
    if (row.discord_user_id !== body.confirmedDiscordId)
      return reply(409, { code: "DISCORD_ID_MISMATCH", productionActivated: false });
    const recordedDiscordRole = row.guild_id === "1463804285681926373" &&
      row.apac_role_id === "1506624152541466685" &&
      !!row.role_verified_at && Date.parse(row.role_verified_at) <= Date.now() &&
      Date.now() - Date.parse(row.role_verified_at) <= 24 * 60 * 60 * 1000;
    const adminReviewed = row.status === "ready_to_activate" &&
      row.admin_verified_discord_id === row.discord_user_id && !!row.reviewed_at;
    const checks = {
      discordRolePreviouslyVerified: recordedDiscordRole,
      adminDiscordIdReviewed: adminReviewed,
      neonGoogleProviderLinked: row.neon_google_linked === true,
      syntheticCaMasterMatched: row.synthetic_master_valid === true,
      cloverUserIdentityLinked: row.linked === true,
      isolatedApprovalFinalized: row.finalized === true,
    };
    const liveDiscordRole = await checkDiscordCurrentRole(row.discord_user_id, process.env.NEW_CA_DISCORD_BOT_TOKEN);
    checks.discordRoleCurrentlyVerified = liveDiscordRole;
    const missing = [
      ...(!liveDiscordRole ? ["LIVE_DISCORD_ROLE_RECHECK"] : []),
      ...(!checks.discordRolePreviouslyVerified ? ["RECORDED_DISCORD_ROLE_STALE_OR_MISSING"] : []),
      ...(!checks.adminDiscordIdReviewed ? ["ADMIN_DISCORD_REVIEW_MISSING"] : []),
      ...(!checks.neonGoogleProviderLinked ? ["NEON_GOOGLE_PROVIDER_MISSING"] : []),
      ...(!checks.syntheticCaMasterMatched ? ["SYNTHETIC_MASTER_MISMATCH"] : []),
      ...(!checks.cloverUserIdentityLinked ? ["CLOVER_NEW_USER_LINK_REQUIRED"] : []),
      ...(!checks.isolatedApprovalFinalized ? ["ISOLATED_APPROVAL_NOT_FINALIZED"] : []),
      "TRUSTED_CAMPFIRE_RESOLUTION",
      "NEW_PENDING_USER_GOOGLE_LINK",
      "PRODUCTION_SCHEMA_RPC_E2E",
    ];
    return reply(200, {
      code: "PREFLIGHT_READ_ONLY", productionActivated: false,
      readyToActivate: false, isolated: true,
      requestStatus: row.status, checks, missing,
    });
  } catch {
    if (db) await db.query("ROLLBACK").catch(() => {});
    return reply(503, { code: "ISOLATED_PREFLIGHT_UNAVAILABLE", productionActivated: false });
  } finally { if (db) await db.end().catch(() => {}); }
}
