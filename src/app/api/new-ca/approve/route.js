import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";
import { BRIDGE_GUARD_MARKER, isIsolatedBridgeReady } from "@/lib/new-ca-bridge-policy";
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
  if (!/^Bearer [\\w.-]{16,8192}$/.test(bearer))
    return result(401, "AUTH_REQUIRED");
  let body;
  try { body=await request.json(); } catch { return result(400, "BAD_JSON"); }
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      Object.keys(body).sort().join(",") !== "confirmedDiscordId,requestId" ||
      typeof body.requestId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.requestId) ||
      typeof body.confirmedDiscordId !== "string" ||
      !/^\\d{15,22}$/.test(body.confirmedDiscordId))
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

  // A trusted Campfire URL-to-ID resolver and a fresh pending-user role verification
  // are mandatory. Until both adapters are independently implemented and tested,
  // intentionally stop BEFORE opening a write transaction.
  if (process.env.NEW_CA_STEP2_TRUSTED_RESOLVER_READY !== "true" ||
      process.env.NEW_CA_PENDING_USER_VALIDATOR_READY !== "true")
    return result(409, "TRUSTED_EVIDENCE_NOT_READY");

  // Deliberately no call to finalize_isolated_approval here:
  // these flags alone are not proof. Only after real verified evidence
  // adapters are integrated can finalization be safely wired.
  return result(503, "ATOMIC_FINALIZER_NOT_CONNECTED");
}
