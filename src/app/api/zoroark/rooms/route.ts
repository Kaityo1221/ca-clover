// Isolated Vercel preview only. No production DB and no guest access.
import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = "https://wgiittrvgtiosogyhfcl.supabase.co";
const SUPABASE_PUBLIC_KEY = "sb_publishable_QTCqijfNvnysUTMylNIyTA_6ngosaPN";

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}

function isValidInput(body: unknown): body is {
  action: "create"; mode: "simple" | "manual"; maxPlayers: number; talkSeconds: number;
} {
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  const value = body as Record<string, unknown>;
  return value.action === "create"
    && (value.mode === "simple" || value.mode === "manual")
    && typeof value.maxPlayers === "number"
    && Number.isInteger(value.maxPlayers)
    && value.maxPlayers >= 3 && value.maxPlayers <= 12
    && typeof value.talkSeconds === "number"
    && [0, 120, 180, 300].includes(value.talkSeconds);
}

// Read-only preview diagnostics. Never expose env values, credentials or tokens.
export async function GET() {
  return json({
    previewEnvironment: process.env.VERCEL_ENV === "preview",
    featureFlagPresent: process.env.ZOROARK_ROOM_CREATE_ENABLED === "true",
    isolatedDatabaseConfigured: Boolean(process.env.ZOROARK_NEON_DATABASE_URL),
    // This is intentionally not a database connectivity or CA auth test.
  }, 200);
}

export async function POST(request: Request) {
  // A branch-specific, explicitly enabled Vercel preview is mandatory.
  // Missing configuration fails closed, never falls back to production storage.
  const databaseUrl = process.env.ZOROARK_NEON_DATABASE_URL;
  if (process.env.VERCEL_ENV !== "preview" ||
      process.env.ZOROARK_ROOM_CREATE_ENABLED !== "true" ||
      !databaseUrl) {
    return json({ error: "isolated_room_api_not_configured" }, 503);
  }

  const expectedOrigin = new URL(request.url).origin;
  if (request.headers.get("origin") !== expectedOrigin) {
    return json({ error: "origin_not_allowed" }, 403);
  }
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return json({ error: "invalid_content_type" }, 415);
  }
  const declaredSize = Number(request.headers.get("content-length") ?? "0");
  if (!Number.isFinite(declaredSize) || declaredSize > 2048) {
    return json({ error: "body_too_large" }, 413);
  }
  const bearer = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(bearer);
  if (!match) return json({ error: "unauthorized" }, 401);

  let body: unknown;
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > 2048) {
      return json({ error: "body_too_large" }, 413);
    }
    body = JSON.parse(text);
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  if (!isValidInput(body)) return json({ error: "invalid_room_settings" }, 400);

  try {
    // Always verify JWT with Supabase Auth. Never trust client-supplied role claims.
    const auth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || SUPABASE_PUBLIC_KEY,
      {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: "Bearer " + match[1] } },
      },
    );
    const { data: userData, error: userError } = await auth.auth.getUser(match[1]);
    if (userError || !userData.user) return json({ error: "unauthorized" }, 401);

    // Read the caller's current server-enforced profile role, not user_metadata.
    const { data: profile, error: profileError } = await auth.from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .maybeSingle();
    if (profileError || !profile || !["ca", "admin"].includes(profile.role)) {
      return json({ error: "ca_role_required" }, 403);
    }

    const sql = neon(databaseUrl);
    // Refuse to write to any database other than the explicitly isolated synthetic DB.
    const [identity] = await sql`select current_database() as database_name`;
    if (identity?.database_name !== "ca_clover_test") {
      return json({ error: "isolated_database_mismatch" }, 503);
    }

    const random = new Uint8Array(32);
    crypto.getRandomValues(random);
    const invite = Array.from(random, b => b.toString(16).padStart(2, "0")).join("");
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(invite));
    const hashed = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
    const [room] = await sql`
      select * from zoroark_isolated.create_gm_room(
        ${userData.user.id}::uuid, ${hashed}::text, ${body.mode}::text,
        ${body.maxPlayers}::integer, ${body.talkSeconds}::integer
      )
    `;
    if (!room?.id) return json({ error: "room_create_failed" }, 503);
    return json({
      roomId: room.id,
      status: room.state,
      mode: room.mode,
      maxPlayers: room.max_players,
      talkSeconds: room.talk_seconds,
      joinExpiresAt: room.join_expires_at,
      expiresAt: room.expires_at,
      invite,
      joinEnabled: process.env.ZOROARK_GUEST_LOBBY_ENABLED === "true" &&
        process.env.VERCEL_GIT_COMMIT_REF === "feature/zoroark-guest-invite-chat-isolated-20261113",
    }, 201);
  } catch (error) {
    const dbError = error as { code?: string; message?: string };
    if (dbError?.code === "P0001" && dbError.message?.includes("room_limit_reached")) {
      return json({ error: "room_limit_reached" }, 429);
    }
    // No private DB URL, role data, or raw error messages in public responses.
    return json({ error: "isolated_room_service_unavailable" }, 503);
  }
}
