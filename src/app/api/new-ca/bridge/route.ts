import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";
import {
  BRIDGE_GUARD_MARKER,
  isIsolatedBridgeReady,
  verifiedGoogleProviderSubject,
  allowedToBindPreview,
} from "@/lib/new-ca-bridge-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const reply = (status: number, data: object) => NextResponse.json(data, { status, headers: NO_STORE });

type AuthContext = {
  userId: string;
  role: "pending" | "ca" | "admin";
  googleSubject: string | null;
  supabase: ReturnType<typeof createClient>;
};

function ready(): boolean {
  return isIsolatedBridgeReady(process.env);
}

async function authenticate(request: NextRequest): Promise<AuthContext | null> {
  const bearer = request.headers.get("authorization") ?? "";
  if (!/^Bearer [\w.-]+$/.test(bearer) || bearer.length > 8192) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (url !== "https://wgiittrvgtiosogyhfcl.supabase.co" || !key) return null;
  const supabase = createClient(url, key, {
    global: { headers: { Authorization: bearer } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // This is a server-side GoTrue call, not a client-side session claim.
  const { data: userResponse, error: authError } = await supabase.auth.getUser(bearer.slice(7));
  if (authError || !userResponse.user) return null;
  const user = userResponse.user;
  const { data: profile, error } = await supabase.from("profiles")
    .select("role").eq("id", user.id).maybeSingle();
  if (error || !profile || !["pending", "ca", "admin"].includes(profile.role)) return null;
  return {
    userId: user.id,
    role: profile.role as "pending" | "ca" | "admin",
    googleSubject: verifiedGoogleProviderSubject(user),
    supabase,
  };
}

async function connectLab() {
  const client = new Client({
    connectionString: process.env.NEW_CA_LAB_DATABASE_URL,
    connectionTimeoutMillis: 5000,
    ssl: { rejectUnauthorized: true },
  });
  await client.connect();
  return client;
}

async function confirmIsolation(client: Client) {
  const { rowCount } = await client.query(
    "SELECT marker FROM ca_onboarding_lab.environment_guard WHERE marker=$1",
    [BRIDGE_GUARD_MARKER],
  );
  if (rowCount !== 1) throw new Error("isolated_db_guard_missing");
}

const listSql = `
SELECT r.id, r.trainer_name, r.discord_user_id, r.discord_display_name,
       r.discord_username, r.discord_nickname, r.discord_display_name_source,
       r.campfire_url, r.status, r.created_at,
       (l.clover_user_id IS NOT NULL) AS clover_linked,
       (a."accountId"=$1) AS same_google_as_viewer
FROM ca_onboarding_lab.requests AS r
JOIN neon_auth.account AS a
  ON a."userId"::text=r.google_subject AND a."providerId"='google'
LEFT JOIN ca_onboarding_lab.clover_identity_links AS l ON l.request_id=r.id
WHERE r.status IN ('pending_admin','held')
ORDER BY r.created_at DESC LIMIT 100
`;

export async function GET(request: NextRequest) {
  if (!ready()) return reply(503, { error: "preview_bridge_disabled" });
  const auth = await authenticate(request);
  if (!auth) return reply(401, { error: "ca_clover_login_required" });
  // A non-admin may only inspect their own Google-subject match.
  if (auth.role !== "admin" && !auth.googleSubject) return reply(403, { error: "google_identity_required" });

  let db: Client | null = null;
  try {
    db = await connectLab();
    await db.query("BEGIN READ ONLY");
    await db.query("SET LOCAL statement_timeout = '5s'");
    await confirmIsolation(db);
    const query = await db.query(listSql, [auth.googleSubject]);
    await db.query("COMMIT");
    const rows = auth.role === "admin"
      ? query.rows
      : query.rows.filter(row => row.same_google_as_viewer === true);
    // Never disclose Neon user UUIDs, provider subjects, tokens, or production auth identifiers.
    const applications = rows.map(row => ({
      id: row.id,
      trainerName: row.trainer_name,
      discordUserId: row.discord_user_id,
      discordDisplayName: row.discord_display_name,
      discordUsername: row.discord_username,
      discordNickname: row.discord_nickname,
      displayNameSource: row.discord_display_name_source ?? "not_verified",
      campfireUrl: row.campfire_url,
      status: row.status,
      cloverLinked: row.clover_linked,
      // This is ONLY a Google-identity match, not a completed registration.
      sameGoogleAsViewer: row.same_google_as_viewer,
    }));
    return reply(200, {
      isolated: true, productionActivated: false,
      applications,
    });
  } catch {
    if (db) await db.query("ROLLBACK").catch(() => {});
    return reply(503, { error: "isolated_bridge_unavailable" });
  } finally {
    if (db) await db.end().catch(() => {});
  }
}

export async function POST(request: NextRequest) {
  if (!ready()) return reply(503, { error: "preview_bridge_disabled" });
  // Explicit same-origin POST; no cookies or auto-submitted browser credentials used.
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return reply(403, { error: "origin_mismatch" });
  }
  if (!(request.headers.get("content-type") ?? "").startsWith("application/json")) {
    return reply(415, { error: "json_required" });
  }

  const auth = await authenticate(request);
  if (!auth) return reply(401, { error: "ca_clover_login_required" });
  if (auth.role !== "pending" || !auth.googleSubject) {
    return reply(403, { error: "only_new_pending_google_users_may_link" });
  }
  const { count, error } = await auth.supabase.from("user_ca_identities")
    .select("ca_member_id", { count: "exact", head: true })
    .eq("user_id", auth.userId);
  if (error || count == null || count !== 0) {
    return reply(409, { error: "existing_ca_identity_protected" });
  }
  let body: { action?: unknown; requestId?: unknown };
  try { body = await request.json(); } catch { return reply(400, { error: "invalid_json" }); }
  if (body.action !== "bind" || typeof body.requestId !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(body.requestId)) {
    return reply(400, { error: "invalid_request" });
  }

  let db: Client | null = null;
  try {
    db = await connectLab();
    await db.query("BEGIN");
    await db.query("SET LOCAL statement_timeout = '5s'");
    await confirmIsolation(db);
    const matches = await db.query(
      `SELECT r.id
       FROM ca_onboarding_lab.requests r
       JOIN neon_auth.account a ON a."userId"::text=r.google_subject
         AND a."providerId"='google' AND a."accountId"=$1
       WHERE r.id=$2::uuid AND r.status='pending_admin'
       FOR UPDATE OF r`,
      [auth.googleSubject, body.requestId],
    );
    if (!allowedToBindPreview(auth.role, count, matches.rowCount ?? 0)) {
      await db.query("ROLLBACK");
      return reply(409, { error: "application_not_owned_or_not_eligible" });
    }
    const linked = await db.query(
      `INSERT INTO ca_onboarding_lab.clover_identity_links(request_id,clover_user_id)
       VALUES($1::uuid,$2::uuid) ON CONFLICT DO NOTHING RETURNING request_id`,
      [body.requestId, auth.userId],
    );
    if (linked.rowCount !== 1) {
      await db.query("ROLLBACK");
      return reply(409, { error: "identity_already_linked" });
    }
    await db.query("COMMIT");
    return reply(200, { ok: true, isolatedLinked: true, productionActivated: false });
  } catch {
    if (db) await db.query("ROLLBACK").catch(() => {});
    return reply(503, { error: "isolated_link_unavailable" });
  } finally {
    if (db) await db.end().catch(() => {});
  }
}
