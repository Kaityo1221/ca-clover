// Public guest lobby; dedicated database and explicit deployment gates.
// A guest never receives another player's identity, role or secret.
import { NextResponse } from "next/server";
import { runtimeConfig, runtimeDatabase, readJson, BodyError, sameOrigin } from "@/lib/zoroark/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE = "__Host-zg_guest";
const DEVICE = "__Host-zg_device";
const SESSION_BYTES = 32;
const json = (data: Record<string, unknown>, code: number) => NextResponse.json(data, {
  status: code,
  headers: {
    "Cache-Control": "private, no-store, max-age=0",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "Cross-Origin-Resource-Policy": "same-origin",
  },
});

function isHex64(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}
function bytesHex(size: number): string {
  const data = new Uint8Array(size);
  crypto.getRandomValues(data);
  return Array.from(data, x => x.toString(16).padStart(2, "0")).join("");
}
async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    x => x.toString(16).padStart(2, "0")).join("");
}
function normalizeName(raw: unknown) {
  if (typeof raw !== "string") return null;
  if (/[\p{Cc}\p{Cf}\p{Cs}\p{Zl}\p{Zp}]/u.test(raw)) return null;
  const name = raw.normalize("NFKC").trim().replace(/\s+/gu, " ");
  if (!name || name.length > 24 || /[\p{Cc}\p{Cf}\p{Cs}\p{Zl}\p{Zp}]/u.test(name)) return null;
  return { display: name, normalized: name.toLocaleLowerCase("ja-JP") };
}

export async function POST(request: Request) {
  if (!sameOrigin(request) ||
      request.headers.get("x-zoroark-request") !== "guest-lobby-v1") {
    return json({ error: "forbidden_origin" }, 403);
  }
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return json({ error: "invalid_content_type" }, 415);
  }
  if (!runtimeConfig("guest") || process.env.ZOROARK_GUEST_LOBBY_ENABLED !== "true") return json({error:"guest_lobby_unavailable"},503);
  let data: Record<string, unknown>;
  try {
    const parsed: unknown = await readJson(request);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") return json({error:"invalid_request"},400);
    data = parsed as Record<string, unknown>;
  } catch(error) { return json({error:"invalid_request"},error instanceof BodyError ? error.status : 400); }

  try {
    const sql = await runtimeDatabase("guest");
    // Shared, non-tracking limiter. Does not persist IP addresses or device fingerprints.
    const [rate] = await sql`select zoroark_isolated.guest_rate_gate() as allowed`;
    if (!rate?.allowed) return json({error:"rate_limited"},429);
    const deviceCookies=(request.headers.get("cookie")??"").split(";").map(x=>x.trim()).filter(x=>x.startsWith(DEVICE+"="));
    if(deviceCookies.length>1)return json({error:"ambiguous_device_cookie"},400);
    const device=deviceCookies[0]?.slice(DEVICE.length+1);

    if (data.action === "inspect" || data.action === "join") {
      if (!isHex64(data.invite)) return json({error:"invalid_invite"},400);
      const inviteHash = await sha256(data.invite);
      if (data.action === "inspect") {
        const [room] = await sql`select * from zoroark_isolated.guest_inspect(${inviteHash}::text)`;
        if (!room) return json({error:"expired_or_closed"},410);
        const result=json({roomId:room.id,maxPlayers:room.max_players,occupied:room.occupied,
          joinExpiresAt:room.join_expires_at},200);
        if(!isHex64(device))result.cookies.set(DEVICE,bytesHex(SESSION_BYTES),{
          httpOnly:true,secure:true,sameSite:"strict",path:"/",maxAge:21600,
        });
        return result;
      }
      if(!isHex64(device))return json({error:"device_cookie_required"},403);
      const deviceHash=await sha256(device);
      const name = normalizeName(data.nickname);
      if (!name) return json({error:"invalid_nickname"},400);
      // One existing browser session must not silently create additional
      // player slots in the same room. This is NOT proof of one physical person.
      const previousCookies=(request.headers.get("cookie")??"").split(";")
        .map(value=>value.trim()).filter(value=>value.startsWith(COOKIE+"="));
      if(previousCookies.length>1)return json({error:"ambiguous_guest_cookie"},400);
      if(previousCookies.length===1){
        const previous=previousCookies[0].slice(COOKIE.length+1);
        if(isHex64(previous)){
          const previousHash=await sha256(previous);
          const [existing]=await sql`select zoroark_isolated.guest_existing(${previousHash}::text,${inviteHash}::text) as present`;
          if(existing?.present)return json({error:"already_joined"},409);
        }
      }
      const sessionToken = bytesHex(SESSION_BYTES);
      const hash = await sha256(sessionToken);
      let guest;
      try {
        [guest] = await sql`select * from zoroark_isolated.guest_join(
          ${inviteHash}::text,${name.display}::text,${name.normalized}::text,${hash}::text,${deviceHash}::text)`;
      } catch (error) {
        const code = (error as {code?: string;message?: string}).code;
        if (code === "23505") return json({error:"nickname_unavailable"},409);
        if (code === "P0001") return json({error:"expired_or_full"},410);
        throw error;
      }
      if (!guest?.guest_id) return json({error:"join_failed"},503);
      const result = json({roomId:guest.game_room_id, nickname:name.display,
        state:"pending",joined:true},201);
      // One-device-per-browser session; never put credentials in JSON, URLs or localStorage.
      result.cookies.set(COOKIE,sessionToken,{
        httpOnly:true,secure:true,sameSite:"strict",path:"/",
        maxAge:Math.min(6*60*60, 21600),
      });
      return result;
    }
    if (data.action === "me") {
      if(!isHex64(device))return json({error:"device_cookie_required"},401);
      const cookie = request.headers.get("cookie") ?? "";
      const matches = cookie.split(";").map(s=>s.trim()).filter(s=>s.startsWith(COOKIE+"="));
      if (matches.length !== 1) return json({error:"session_missing"},401);
      const token = matches[0].slice(COOKIE.length+1);
      if (!isHex64(token)) return json({error:"session_invalid"},401);
      const hash = await sha256(token);
      const deviceHash=await sha256(device);
      const [guest] = await sql`select * from zoroark_isolated.guest_me(${hash}::text,${deviceHash}::text)`;
      if (!guest) {
        const result=json({error:"session_expired"},401);
        result.cookies.set(COOKIE,"",{httpOnly:true,secure:true,sameSite:"strict",path:"/",maxAge:0});
        return result;
      }
      return json({roomId:guest.room_id,nickname:guest.display_name,
        state:guest.state,expiresAt:guest.expires_at},200);
    }
    return json({error:"unknown_action"},400);
  } catch {
    return json({error:"guest_service_unavailable"},503);
  }
}
