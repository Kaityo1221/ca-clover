import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { parseCaMasterCsv } from "@/lib/ca-master";
import { compareCaMasterNewOnly } from "@/lib/ca-master-new-only-diff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OFFICIAL_SHEET_CSV =
  "https://docs.google.com/spreadsheets/d/1BtPjOxNX4JhttKKJa_-qrIXdVmK5UsbAX-RcLmLTuwk/export?format=csv&gid=633821294";
const HEADERS = {
  "Cache-Control":"private, no-store, no-cache, max-age=0, must-revalidate",
  "Vary":"Authorization",
  "X-Content-Type-Options":"nosniff",
  "Referrer-Policy":"no-referrer",
};
function reply(payload: object, status=200) {
  return NextResponse.json(payload,{status,headers:HEADERS});
}

async function authorizedReader(request: NextRequest) {
  const match=/^Bearer ([A-Za-z0-9._~-]{20,8192})$/.exec(request.headers.get("authorization")??"");
  if (!match) return null;
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()??"https://wgiittrvgtiosogyhfcl.supabase.co";
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()??
    "sb_publishable_QTCqijfNvnysUTMylNIyTA_6ngosaPN";
  const client=createClient(url,key,{
    global:{headers:{Authorization:`Bearer ${match[1]}`}},
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
  });
  const {data:identity,error:identityError}=await client.auth.getUser(match[1]);
  if (identityError||!identity.user) return null;
  const {data:profile,error:profileError}=await client.from("profiles")
    .select("role").eq("id",identity.user.id).maybeSingle();
  if (profileError||profile?.role!=="admin") return null;
  return client;
}

async function readReport(reader: NonNullable<Awaited<ReturnType<typeof authorizedReader>>>, csv:string, label:string) {
  if (csv.length>2_000_000) return reply({error:"原本CSVが大きすぎます。"},413);
  const records=parseCaMasterCsv(csv);
  // Protect against login HTML, truncated CSV, or accidental use of an old
  // tab. A small sample is not a safe basis for an official master diff.
  if (records.length<180||records.length>600)
    return reply({error:"公式CAマスターの全行を確認できません。正しいタブのCSVを選んでください。"},422);

  const [{data:members,error:memberError},{data:communities,error:communityError}] = await Promise.all([
    reader.from("ca_members").select("source_key,trainer_name,ca_level,prefecture,join_date,status").limit(1000),
    reader.from("communities").select("campfire_community_id,name,prefecture").limit(1000),
  ]);
  if (memberError||communityError||!members||!communities)
    return reply({error:"CloverのCA名簿を安全に取得できません。"},503);

  // Historical IDs are not exposed to normal user sessions. If a server-only
  // connection is unavailable, fail closed for additions; no fallback grants.
  const admin=createSupabaseAdminClient();
  const {data:history,error:historyError}=admin
    ? await admin.from("community_campfire_ids")
        .select("campfire_community_id,status").limit(2000)
    : {data:null,error:{message:"not configured"}};
  const verified=Boolean(admin&&!historyError&&history);
  const report=compareCaMasterNewOnly(records,members,communities,history??[],verified);
  return reply({
    report, source:label, checkedAt:new Date().toISOString(),
    historyVerified:verified, writeEnabled:false,
    notice:"表示・コピーのみ。既存CA/権限/所属の変更、追加のDB書込は実行されません。",
  });
}

/** Authenticated, read-only direct check of the fixed official sheet. */
export async function GET(request:NextRequest) {
  try {
    const reader=await authorizedReader(request);
    if (!reader) return reply({error:"ADMIN認証が必要です。"},403);
    const response=await fetch(OFFICIAL_SHEET_CSV,{
      headers:{Accept:"text/csv"},
      cache:"no-store",
      signal:AbortSignal.timeout(12_000),
    });
    if (!response.ok)
      return reply({error:"公式シートを直接読み取れません。公式タブのCSVファイルで照合してください。",code:"SHEET_READ_UNAVAILABLE"},502);
    return readReport(reader,await response.text(),"公式シート直接取得");
  } catch {
    return reply({error:"公式シートを直接読み取れません。公式タブのCSVファイルで照合してください。",code:"SHEET_READ_UNAVAILABLE"},502);
  }
}

/** Manual CSV fallback. A browser upload is *not* trusted proof of source authenticity. */
export async function POST(request:NextRequest) {
  try {
    if (request.headers.get("origin")&&request.headers.get("origin")!==request.nextUrl.origin)
      return reply({error:"接続元を確認できません。"},403);
    const reader=await authorizedReader(request);
    if (!reader) return reply({error:"ADMIN認証が必要です。"},403);
    const length=Number(request.headers.get("content-length")??"0");
    if (length>2_000_000) return reply({error:"CSVは2MB以下にしてください。"},413);
    const csv=await request.text();
    return readReport(reader,csv,"手動CSV（原本の一致は別途確認）");
  } catch {
    return reply({error:"CSV照合に失敗しました。原本の形式とアクセス権を確認してください。"},422);
  }
}
