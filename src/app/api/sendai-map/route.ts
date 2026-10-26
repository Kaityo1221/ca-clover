import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { sendaiMapIsActive, sendaiMapRoleAllowed, SENDAI_MAP_BUCKET, SENDAI_MAP_OBJECT } from "@/lib/sendai-map-policy";

export const dynamic = "force-dynamic";

const protectedHeaders = {
  "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
  "Vary": "Authorization",
  "X-Content-Type-Options": "nosniff",
};
function response(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: protectedHeaders });
}
// Called only after ADMIN authorization. No JWT, keys or request bodies in errors/logs.
function adminStorageFailure(stage: string, error: unknown) {
  const reason = error instanceof Error ? error.message : "unknown storage error";
  console.error("[sendai-map] publish failed", { stage, reason: reason.slice(0, 180) });
  return NextResponse.json(
    { error: "非公開の作戦MAP保存に失敗しました。", detail: stage + ": " + reason.slice(0, 180) },
    { status: 503, headers: protectedHeaders }
  );
}

/** Private payload endpoint. No signed URL and no public storage access. */
export async function GET(request: NextRequest) {
  if (!sendaiMapIsActive()) return response("公開期間は終了しました。", 410);
  const match = /^Bearer ([A-Za-z0-9._~-]+)$/.exec(request.headers.get("authorization") || "");
  if (!match) return response("CA Cloverのログインが必要です。", 401);

  const admin = createSupabaseAdminClient();
  if (!admin) {
    console.error("[sendai-map] missing server credentials (names only)", {
      publicUrlSet: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      serviceRoleSet: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    });
    return response("サーバー認証設定の確認が必要です。管理者に連絡してください。", 503);
  }
  const { data: identity, error: authError } = await admin.auth.getUser(match[1]);
  if (authError || !identity.user) return response("認証情報が無効です。", 401);

  // Permissions must come from the trusted database, not user-editable JWT metadata.
  const { data: profile, error: profileError } = await admin
    .from("profiles").select("role").eq("id", identity.user.id).maybeSingle();
  if (profileError) return response("権限を確認できません。", 503);
  if (!sendaiMapRoleAllowed(profile?.role)) return response("承認済みCA専用です。", 403);

  const bucket = SENDAI_MAP_BUCKET;
  const objectPath = SENDAI_MAP_OBJECT;
  try {
    const { data: file, error } = await admin.storage.from(bucket).download(objectPath);
    if (error || !file || file.size > 16_000_000) {
      const status = typeof error?.message === "string" ? error.message.toLowerCase() : "";
      if (status.includes("not found") || status.includes("no such")) return response("作戦MAPはまだ登録されていません。ADMINからJSONを公開してください。", 404);
      console.error("[sendai-map] snapshot read failed", { reason: error?.message?.slice(0, 180) || "missing file" });
      return response("保存済み作戦MAPを読み込めません。管理者に連絡してください。", 503);
    }
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
export async function POST(request: NextRequest) {
  if (!sendaiMapIsActive()) return response("公開期間は終了しました。", 410);
  const match = /^Bearer ([A-Za-z0-9._~-]+)$/.exec(request.headers.get("authorization") || "");
  if (!match) return response("ログインが必要です。", 401);
  const admin = createSupabaseAdminClient();
  if (!admin) {
    console.error("[sendai-map] missing server credentials (names only)", {
      publicUrlSet: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      serviceRoleSet: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    });
    return response("サーバー認証設定の確認が必要です。管理者に連絡してください。", 503);
  }
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
      if (created.error) return adminStorageFailure("保存先の新規作成", created.error);
      const readBack = await admin.storage.getBucket(SENDAI_MAP_BUCKET);
      bucket = readBack.data;
    }
    if (!bucket || bucket.public) return adminStorageFailure("保存先の非公開設定", new Error("private bucket not available"));
    const { error } = await admin.storage.from(SENDAI_MAP_BUCKET).upload(SENDAI_MAP_OBJECT, contents, {
      contentType: "application/json", upsert: true, cacheControl: "0",
    });
    if (error) return adminStorageFailure("ファイル登録", error);
    return NextResponse.json({ ok: true, bytes: contents.byteLength }, { headers: protectedHeaders });
  } catch (error) {
    return adminStorageFailure("予期しない保存エラー", error);
  }
}
