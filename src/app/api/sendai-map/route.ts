import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createSendaiMapAdminClient } from "@/lib/sendai-map-server";
import { sendaiMapIsActive, sendaiMapRoleAllowed, SENDAI_MAP_BUCKET, SENDAI_MAP_OBJECT } from "@/lib/sendai-map-policy";

export const dynamic = "force-dynamic";

const protectedHeaders = {
  "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
  "Vary": "Authorization",
  "X-Content-Type-Options": "nosniff",
};
function response(message: string, status: number, code?: string) {
  return NextResponse.json(
    { error: message, ...(code ? { code } : {}) },
    { status, headers: protectedHeaders }
  );
}
function adminClientOrError() {
  const admin = createSendaiMapAdminClient();
  if (!admin) {
    // Never print or return the contents of any environment variable.
    console.error("[sendai-map] Server authentication configuration unavailable", {
      hasUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()),
      hasServerKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
    });
  }
  return admin;
}

/** Private payload endpoint. No signed URL and no public storage access. */
async function getMap(request: NextRequest, headOnly = false) {
  if (!sendaiMapIsActive()) return response("公開期間は終了しました。", 410);
  const match = /^Bearer ([A-Za-z0-9._~-]+)$/.exec(request.headers.get("authorization") || "");
  if (!match) return response("CA Cloverのログインが必要です。", 401);

  const admin = adminClientOrError();
  if (!admin) return response("作戦MAPのサーバー接続設定を確認してください。", 503, "MAP_AUTH_CONFIG");
  const { data: identity, error: authError } = await admin.auth.getUser(match[1]);
  if (authError || !identity.user) return response("認証情報が無効です。", 401);

  // Permissions must come from the trusted database, not user-editable JWT metadata.
  const { data: profile, error: profileError } = await admin
    .from("profiles").select("role").eq("id", identity.user.id).maybeSingle();
  if (profileError) return response("権限を確認できません。", 503);
  if (!sendaiMapRoleAllowed(profile?.role)) return response("承認済みCA専用です。", 403);

  if (headOnly) return new NextResponse(null, { status: 200, headers: protectedHeaders });
  const bucket = SENDAI_MAP_BUCKET;
  const objectPath = SENDAI_MAP_OBJECT;
  try {
    const bucketInfo = await admin.storage.getBucket(bucket);
    if (bucketInfo.error || !bucketInfo.data || bucketInfo.data.public) return response("非公開保存先を確認できません。", 503, "MAP_DATA_NOT_FOUND");
    // A fresh cache key avoids stale edge responses after overwriting this private object.
    const { data: file, error } = await admin.storage.from(bucket).download(objectPath, { cacheNonce: randomUUID() }, { cache: "no-store" });
    if (error || !file || file.size > 16_000_000) return response("作戦MAPがまだ登録されていないか、保存先を読み込めません。", 503, "MAP_DATA_NOT_FOUND");
    const raw = JSON.parse(await file.text()) as Record<string, unknown>;
    if (!raw || typeof raw !== "object" || !raw.plans || typeof raw.plans !== "object" || typeof raw.current !== "string" || !Object.hasOwn(raw.plans,raw.current)) {
      return response("作戦データの形式が不正です。", 503);
    }
    // Strip personal roster data even if it was included in the original export.
    const { caRoster: _privateRoster, ...workspace } = raw;
    void _privateRoster;
    return NextResponse.json({ workspace }, { headers: protectedHeaders });
  } catch {
    return response("作戦データを読み込めません。", 503);
  }
}

/**
 * ADMIN-only manual publish. Called solely when the operator explicitly selects
 * a JSON export; creates one dedicated private bucket when it does not exist.
 * No changes to existing tables, Cron or public storage buckets.
 */
async function postMap(request: NextRequest) {
  if (!sendaiMapIsActive()) return response("公開期間は終了しました。", 410);
  const match = /^Bearer ([A-Za-z0-9._~-]+)$/.exec(request.headers.get("authorization") || "");
  if (!match) return response("ログインが必要です。", 401);
  const admin = adminClientOrError();
  if (!admin) return response("作戦MAPのサーバー接続設定を確認してください。", 503, "MAP_AUTH_CONFIG");
  const { data: identity, error: authError } = await admin.auth.getUser(match[1]);
  if (authError || !identity.user) return response("認証情報が無効です。", 401);
  const { data: profile, error: profileError } = await admin
    .from("profiles").select("role").eq("id", identity.user.id).maybeSingle();
  if (profileError) return response("権限を確認できません。", 503);
  if (profile?.role !== "admin") return response("公開操作はADMIN専用です。", 403);
  if ((Number(request.headers.get("content-length")) || 0) > 3_500_000) {
    return response("JSONが大きすぎます（上限3.5MB）。", 413);
  }
  let safeWorkspace: Record<string, unknown>;
  let contents: Buffer;
  try {
    const raw = await request.json() as Record<string, unknown>;
    if (!raw || typeof raw !== "object" || !raw.plans || typeof raw.plans !== "object" ||
      typeof raw.current !== "string" || !Object.hasOwn(raw.plans, raw.current) ||
      ![1, 2].includes(Number(raw.version))) return response("作戦JSONの形式が違います。", 400);
    const { caRoster: _privateRoster, ...safe } = raw;
    void _privateRoster;
    safeWorkspace = safe;
    contents = Buffer.from(JSON.stringify(safeWorkspace), "utf8");
    if (contents.byteLength > 3_500_000) return response("JSONが大きすぎます（上限3.5MB）。", 413);
  } catch {
    return response("JSONを解析できません。", 400);
  }
  try {
    let { data: bucket } = await admin.storage.getBucket(SENDAI_MAP_BUCKET);
    if (!bucket) {
      const created = await admin.storage.createBucket(SENDAI_MAP_BUCKET, {
        public: false,
        allowedMimeTypes: ["application/json"],
        fileSizeLimit: 4_000_000,
      });
      if (created.error) {
        console.error("[sendai-map] Private bucket creation failed", { code: created.error.name });
        return response("非公開保存先を作成できません。", 503, "MAP_BUCKET_CREATE");
      }
      const readBack = await admin.storage.getBucket(SENDAI_MAP_BUCKET);
      bucket = readBack.data;
    }
    if (!bucket || bucket.public) return response("非公開保存先の安全性を確認できません。", 503);
    const { error } = await admin.storage.from(SENDAI_MAP_BUCKET).upload(SENDAI_MAP_OBJECT, contents, {
      contentType: "application/json", upsert: true, cacheControl: "0",
    });
    if (error) {
      console.error("[sendai-map] Private object upload failed", { code: error.name });
      return response("公開用作戦データを保存できません。", 503, "MAP_STORAGE_WRITE");
    }
    // Read with a fresh cache key; still require an exact byte match before success.
    const verified = await admin.storage.from(SENDAI_MAP_BUCKET).download(SENDAI_MAP_OBJECT, { cacheNonce: randomUUID() }, { cache: "no-store" });
    if (verified.error || !verified.data || verified.data.size !== contents.byteLength || !Buffer.from(await verified.data.arrayBuffer()).equals(contents)) {
      return response("保存後の読み戻し確認に失敗しました。", 503, "MAP_STORAGE_VERIFY");
    }
    return NextResponse.json({ ok: true, bytes: contents.byteLength }, { headers: protectedHeaders });
  } catch {
    return response("公開用作戦データを保存できません。", 503);
  }
}

// Pages is the CA entrypoint. Only this origin may read authenticated API responses.
const PAGES_ORIGIN = "https://kaityo1221.github.io";
function cors(request: NextRequest, result: NextResponse) {
  result.headers.set("Vary", "Authorization, Origin");
  if (request.headers.get("origin") === PAGES_ORIGIN) {
    result.headers.set("Access-Control-Allow-Origin", PAGES_ORIGIN);
  }
  return result;
}
function originAllowed(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || origin === PAGES_ORIGIN || origin === "https://ca-clover.vercel.app";
}
export async function OPTIONS(request: NextRequest) {
  if (!originAllowed(request)) return cors(request, response("この接続元は許可されていません。", 403));
  const result = new NextResponse(null, { status: 204, headers: protectedHeaders });
  result.headers.set("Access-Control-Allow-Methods", "GET, HEAD, POST, OPTIONS");
  result.headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
  result.headers.set("Access-Control-Max-Age", "300");
  return cors(request, result);
}
export async function GET(request: NextRequest) {
  if (!originAllowed(request)) return cors(request, response("この接続元は許可されていません。", 403));
  return cors(request, await getMap(request));
}
export async function POST(request: NextRequest) {
  if (!originAllowed(request)) return cors(request, response("この接続元は許可されていません。", 403));
  return cors(request, await postMap(request));
}

export async function HEAD(request: NextRequest) {
  if (!originAllowed(request)) return cors(request, response("この接続元は許可されていません。", 403));
  return cors(request, await getMap(request, true));
}
