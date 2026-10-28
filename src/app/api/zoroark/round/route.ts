import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createZoroarkRound, chooseZoroarkPair } from "@/lib/zoroark-catalog.server";
import { allowedZoroarkOrigin, allowedZoroarkRole, validateRoundRequest } from "@/lib/zoroark-api-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGES_ORIGIN = "https://kaityo1221.github.io";
const headersBase = {
  "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
  "Vary": "Authorization, Origin",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};
function response(request: NextRequest, data: object, status: number): NextResponse {
  const result = NextResponse.json(data, {status,headers:headersBase});
  if (request.headers.get("origin") === PAGES_ORIGIN) {
    result.headers.set("Access-Control-Allow-Origin", PAGES_ORIGIN);
  }
  return result;
}

export async function OPTIONS(request: NextRequest) {
  if (!allowedZoroarkOrigin(request.headers.get("origin"),request.nextUrl.origin)) {
    return response(request,{error:"接続元が許可されていません。"},403);
  }
  const result = new NextResponse(null, {status:204,headers:headersBase});
  if (request.headers.get("origin") === PAGES_ORIGIN) {
    result.headers.set("Access-Control-Allow-Origin", PAGES_ORIGIN);
  }
  result.headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
  result.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  result.headers.set("Access-Control-Max-Age", "300");
  return result;
}

/**
 * GM-only API. No DB writes or service_role key. A valid Supabase user
 * must have a CURRENT ca/admin role visible through existing self-profile RLS.
 * A browser-side role or user ID is never accepted as authorization.
 */
export async function POST(request: NextRequest) {
  if (!allowedZoroarkOrigin(request.headers.get("origin"), request.nextUrl.origin)) {
    return response(request, {error:"接続元が許可されていません。"}, 403);
  }
  const match = /^Bearer ([A-Za-z0-9._~-]{20,8192})$/.exec(request.headers.get("authorization") || "");
  if (!match) return response(request, {error:"CA Cloverへのログインが必要です。"}, 401);
  const token = match[1];

  // These are the same PUBLIC frontend defaults, not a privileged credential.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "https://wgiittrvgtiosogyhfcl.supabase.co";
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    "sb_publishable_QTCqijfNvnysUTMylNIyTA_6ngosaPN";
  try {
    const supabase = createClient(url, key, {
      global:{headers:{Authorization:"Bearer " + token}},
      auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
    });
    const { data: identity, error: identityError } = await supabase.auth.getUser(token);
    if (identityError || !identity.user) return response(request,{error:"ログインが無効または期限切れです。"},401);
    const { data: profile, error: profileError } = await supabase.from("profiles")
      .select("role").eq("id",identity.user.id).maybeSingle();
    if (profileError) return response(request,{error:"CA権限を確認できません。"},503);
    if (!allowedZoroarkRole(profile?.role)) {
      return response(request,{error:"承認済みCA・ADMIN専用です。"},403);
    }

    const length = Number(request.headers.get("content-length") || 0);
    if (length > 2048) return response(request,{error:"リクエストが大きすぎます。"},413);
    let body: unknown;
    try {
      const raw = await request.text();
      if (raw.length > 2048) return response(request,{error:"リクエストが大きすぎます。"},413);
      body=JSON.parse(raw);
    } catch {
      return response(request,{error:"リクエスト形式を確認してください。"},400);
    }
    const input = validateRoundRequest(body);
    if (!input) return response(request,{error:"人数または難易度が不正です。"},400);

    const pair = chooseZoroarkPair(input.difficulty,input.recent);
    const round = createZoroarkRound(input.count,pair);
    return response(request,{round},200);
  } catch {
    // Do not log access tokens, CA identities, request bodies or key material.
    return response(request,{error:"安全なゲーム開始処理が利用できません。"},503);
  }
}
