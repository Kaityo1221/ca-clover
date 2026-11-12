// Public guest lobby endpoint, isolated Vercel Preview only.
// A guest never receives another player's identity, role or secret.
import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE = "__Host-zg_guest";
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
  const name = raw.normalize("NFKC").trim().replace(/\s+/gu, " ");
  if (!name || name.length > 24 || /[\p{Cc}\p{Cf}\p{Cs}\p{Zl}\p{Zp}]/u.test(name)) return null;
  return { display: name, normalized: name.toLocaleLowerCase("ja-JP") };
}

export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  if (request.headers.get("origin") !== origin ||
      request.headers.get("sec-fetch-site") && request.headers.get("sec-fetch-site") !== "same-origin" ||
      request.headers.get("x-zoroark-request") !== "guest-lobby-v1") {
    return json({ error: "forbidden_origin" }, 403);
  }
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return json({ error: "invalid_content_type" }, 415);
  }
  const dbUrl = process.env.ZOROARK_NEON_DATABASE_URL;
  if (process.env.VERCEL_ENV !== "preview" ||
      process.env.ZOROARK_GUEST_LOBBY_ENABLED !== "true" ||
      process.env.VERCEL_GIT_COMMIT_REF !== "feature/zoroark-guest-invite-chat-isolated-20261113" ||
      !dbUrl) return json({ error: "guest_lobby_unavailable" }, 503);
  let data: Record<string, unknown>;
  try {
    if (Number(request.headers.get("content-length") ?? 0) > 2048) return json({error:"too_large"},413);
    const source = await request.text();
    if (new TextEncoder().encode(source).byteLength > 2048) return json({error:"too_large"},413);
    const parsed: unknown = JSON.parse(source);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") return json({error:"invalid_request"},400);
    data = parsed as Record<string, unknown>;
  } catch { return json({error:"invalid_request"},400); }

  const sql = neon(dbUrl);
  try {
    const [db] = await sql`select current_database() as name`;
    if (db?.name !== "ca_clover_test") return json({error:"wrong_isolation_database"},503);

    if (data.action === "inspect" || data.action === "join") {
      if (!isHex64(data.invite)) return json({error:"invalid_invite"},400);
      const inviteHash = await sha256(data.invite);
      if (data.action === "inspect") {
        const [room] = await sql`
          select id, max_players, join_expires_at,
            (select count(*)::int from zoroark_isolated.guest_participants
             where room_id = r.id and state in ('pending','approved')) as occupied
          from zoroark_isolated.rooms r where invite_sha256=${inviteHash}
          and state='lobby' and not join_locked
          and join_expires_at > now() and expires_at > now()
        `;
        if (!room) return json({error:"expired_or_closed"},410);
        return json({roomId:room.id,maxPlayers:room.max_players,occupied:room.occupied,
          joinExpiresAt:room.join_expires_at},200);
      }
      const name = normalizeName(data.nickname);
      if (!name) return json({error:"invalid_nickname"},400);
      const sessionToken = bytesHex(SESSION_BYTES);
      const hash = await sha256(sessionToken);
      let guest;
      try {
        [guest] = await sql`select * from zoroark_isolated.guest_join(
          ${inviteHash}::text,${name.display}::text,${name.normalized}::text,${hash}::text)`;
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
      const cookie = request.headers.get("cookie") ?? "";
      const matches = cookie.split(";").map(s=>s.trim()).filter(s=>s.startsWith(COOKIE+"="));
      if (matches.length !== 1) return json({error:"session_missing"},401);
      const token = matches[0].slice(COOKIE.length+1);
      if (!isHex64(token)) return json({error:"session_invalid"},401);
      const hash = await sha256(token);
      const [guest] = await sql`
        select p.room_id, p.display_name, p.state, r.expires_at
        from zoroark_isolated.guest_participants p
        join zoroark_isolated.rooms r on r.id = p.room_id
        where p.session_sha256=${hash} and r.expires_at>now()
          and r.state not in ('ended','expired')
      `;
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
