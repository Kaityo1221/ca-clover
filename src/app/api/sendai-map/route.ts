import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { sendaiMapIsActive, sendaiMapRoleAllowed } from "@/lib/sendai-map-policy";

export const dynamic = "force-dynamic";

const protectedHeaders = {
  "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
  "Vary": "Authorization",
  "X-Content-Type-Options": "nosniff",
};
function response(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: protectedHeaders });
}

/** Private payload endpoint. No signed URL and no public storage access. */
export async function GET(request: NextRequest) {
  if (!sendaiMapIsActive()) return response("公開期間は終了しました。", 410);
  const match = /^Bearer ([A-Za-z0-9._~-]+)$/.exec(request.headers.get("authorization") || "");
  if (!match) return response("CA Cloverのログインが必要です。", 401);

  const admin = createSupabaseAdminClient();
  if (!admin) return response("現在、作戦MAPを利用できません。", 503);
  const { data: identity, error: authError } = await admin.auth.getUser(match[1]);
  if (authError || !identity.user) return response("認証情報が無効です。", 401);

  // Permissions must come from the trusted database, not user-editable JWT metadata.
  const { data: profile, error: profileError } = await admin
    .from("profiles").select("role").eq("id", identity.user.id).maybeSingle();
  if (profileError) return response("権限を確認できません。", 503);
  if (!sendaiMapRoleAllowed(profile?.role)) return response("承認済みCA専用です。", 403);

  const bucket = process.env.SENDAI_MAP_PRIVATE_BUCKET;
  const objectPath = process.env.SENDAI_MAP_PRIVATE_OBJECT;
  if (!bucket || !objectPath) return response("作戦MAPは準備中です。", 503);
  try {
    const { data: file, error } = await admin.storage.from(bucket).download(objectPath);
    if (error || !file || file.size > 16_000_000) return response("作戦データを読み込めません。", 503);
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
