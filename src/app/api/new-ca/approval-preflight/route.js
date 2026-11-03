import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";
import { isIsolatedBridgeReady, BRIDGE_GUARD_MARKER } from "@/lib/new-ca-bridge-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const URL = "https://wgiittrvgtiosogyhfcl.supabase.co";
const KEY = "sb_publishable_QTCqijfNvnysUTMylNIyTA_6ngosaPN";
const reply = (status, value) => NextResponse.json(value, {
  status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
});

/**
 * Read-only approval preflight for the dedicated Vercel preview branch.
 * Does NOT produce trusted evidence, approve any record, or issue CA privileges.
 */
export async function POST(request) {
  if (process.env.VERCEL_ENV !== "preview" ||
      process.env.VERCEL_GIT_COMMIT_REF !== "feature/new-ca-approval-admin-preview-20261103" ||
      !isIsolatedBridgeReady(process.env))
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

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || URL;
  if (url !== URL) return reply(503, { code: "AUTH_CONFIG_MISMATCH", productionActivated: false });
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
      SELECT r.id,r.status,r.discord_user_id,r.trainer_name,r.campfire_url,
             (l.clover_user_id IS NOT NULL) AS linked,
             (f.request_id IS NOT NULL) AS finalized,
             m.is_synthetic
      FROM ca_onboarding_lab.requests r
      LEFT JOIN ca_onboarding_lab.clover_identity_links l ON l.request_id=r.id
      LEFT JOIN ca_onboarding_lab.finalized_approvals f ON f.request_id=r.id
      LEFT JOIN ca_onboarding_lab.master_snapshot m
        ON lower(m.trainer_name)=lower(r.trainer_name)
        AND m.campfire_url=r.campfire_url
      WHERE r.id=$1::uuid LIMIT 2`, [body.requestId]);
    await db.query("COMMIT");
    if (result.rows.length !== 1) return reply(404, { code: "APPLICATION_NOT_FOUND_OR_AMBIGUOUS", productionActivated: false });
    const row = result.rows[0];
    if (row.discord_user_id !== body.confirmedDiscordId)
      return reply(409, { code: "DISCORD_ID_MISMATCH", productionActivated: false });
    // The trust adapters and final approval RPC do not yet exist. Never present as GO.
    const missing = [
      "LIVE_DISCORD_ROLE_RECHECK",
      "TRUSTED_CAMPFIRE_RESOLUTION",
      "NEW_PENDING_USER_GOOGLE_LINK",
      "REVIEWED_ADMIN_EVIDENCE",
      "PRODUCTION_SCHEMA_RPC_E2E",
    ];
    return reply(200, {
      code: "PREFLIGHT_READ_ONLY",
      productionActivated: false, readyToActivate: false,
      isolated: true, requestStatus: row.status,
      labLinked: row.linked, labFinalized: row.finalized,
      syntheticMaster: row.is_synthetic === true,
      missing,
    });
  } catch {
    if (db) await db.query("ROLLBACK").catch(() => {});
    return reply(503, { code: "ISOLATED_PREFLIGHT_UNAVAILABLE", productionActivated: false });
  } finally { if (db) await db.end().catch(() => {}); }
}
