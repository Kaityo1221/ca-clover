import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {createSupabaseAdminClient} from "@/lib/supabase-admin";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const HEADERS={"Cache-Control":"private, no-store, max-age=0",
  "Vary":"Authorization","X-Content-Type-Options":"nosniff",
  "Referrer-Policy":"no-referrer"};
const reply=(data:object,status=200)=>NextResponse.json(data,{status,headers:HEADERS});
const enabled=()=>process.env.CA_EARLY_DISCOVERY_ENABLED==="true";

/** The caller's Supabase Auth identity and ADMIN role are verified server-side. */
async function authorize(request:NextRequest){
  const token=/^Bearer ([A-Za-z0-9._~-]{20,8192})$/.exec(request.headers.get("authorization")??"")?.[1];
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY??process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!token||!url||!key)return false;
  const reader=createClient(url,key,{
    global:{headers:{Authorization:`Bearer ${token}`}},
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
  });
  const {data:identity,error:identityError}=await reader.auth.getUser(token);
  if(identityError||!identity.user)return false;
  const {data:profile,error:profileError}=await reader.from("profiles")
    .select("role").eq("id",identity.user.id).maybeSingle();
  return !profileError&&profile?.role==="admin";
}
const fields="club_id,community_name,first_observed_at,last_observed_at,event_ids,evidence_source,review_status,report_status,master_status,reported_at,revision";
export async function GET(request:NextRequest){
  try{
    if(!await authorize(request))return reply({error:"ADMIN認証が必要です。"},403);
    if(!enabled())return reply({enabled:false,candidates:[],checkedAt:null,
      notice:"隔離プレビューです。実Campfire連携・候補DB・通知は停止中です。"});
    const admin=createSupabaseAdminClient();
    if(!admin)return reply({error:"候補台帳の接続は未設定です。"},503);
    const {data,error}=await admin.from("ca_early_discovery_candidates")
      .select(fields).order("last_observed_at",{ascending:false}).limit(500);
    if(error)return reply({error:"候補台帳を読み取れません。未確認として扱います。"},503);
    return reply({enabled:true,candidates:data??[],checkedAt:new Date().toISOString(),
      notice:"公開Meetupの観測候補です。正式CA認定やバッジ付与を確定する情報ではありません。"});
  }catch{
    return reply({error:"候補台帳の読込に失敗しました。"},503);
  }
}
export async function POST(request:NextRequest){
  try{
    const origin=request.headers.get("origin");
    if(origin&&origin!==request.nextUrl.origin)return reply({error:"接続元を確認できません。"},403);
    if(!await authorize(request))return reply({error:"ADMIN認証が必要です。"},403);
    if(!enabled())return reply({error:"隔離プレビュー中は記録を変更できません。"},423);
    const size=Number(request.headers.get("content-length")??0);
    if(size>4096)return reply({error:"入力が大きすぎます。"},413);
    const body=await request.json() as Record<string,unknown>;
    const clubId=typeof body.clubId==="string"?body.clubId.toLowerCase():"";
    const action=body.action;
    const revision=body.revision;
    if(!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(clubId)||
      (action!=="hold"&&action!=="review")||
      !Number.isSafeInteger(revision)||Number(revision)<0||Number(revision)>1_000_000){
      return reply({error:"入力値が不正です。"},400);
    }
    const admin=createSupabaseAdminClient();
    if(!admin)return reply({error:"候補台帳の接続は未設定です。"},503);
    const {data,error}=await admin.from("ca_early_discovery_candidates")
      .update({review_status:action==="hold"?"hold":"reviewed",
        revision:Number(revision)+1,updated_at:new Date().toISOString()})
      .eq("club_id",clubId).eq("revision",revision)
      .select("club_id,review_status,revision").maybeSingle();
    if(error)return reply({error:"候補の確認状態を更新できません。"},503);
    if(!data)return reply({error:"他の管理者による更新または対象なし。再読み込みしてください。"},409);
    return reply({ok:true,candidate:data});
  }catch{
    return reply({error:"確認操作に失敗しました。"},500);
  }
}
