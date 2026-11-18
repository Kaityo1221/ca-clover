import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { allowedZoroarkOrigin } from "@/lib/zoroark-api-policy";
import { PAIRS } from "@/lib/zoroark-catalog.server";
import { catalogManagementEnabled, catalogPublishEnabled, catalogRuntimeEnabled } from "@/lib/zoroark-catalog-management.server";
import { topicPairKey } from "@/lib/zoroark-catalog-review";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const PAGES="https://kaityo1221.github.io";
const headers={"Cache-Control":"private, no-store, max-age=0","Vary":"Origin, Authorization",
 "X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"};
function response(req:NextRequest,obj:object,status:number){
 const r=NextResponse.json(obj,{status,headers});
 if(req.headers.get("origin")===PAGES)r.headers.set("Access-Control-Allow-Origin",PAGES);
 return r;
}
export async function OPTIONS(req:NextRequest){
 if(!allowedZoroarkOrigin(req.headers.get("origin"),req.nextUrl.origin))
  return response(req,{error:"origin_denied"},403);
 const r=new NextResponse(null,{status:204,headers});
 if(req.headers.get("origin")===PAGES)r.headers.set("Access-Control-Allow-Origin",PAGES);
 r.headers.set("Access-Control-Allow-Headers","Authorization, Content-Type");
 r.headers.set("Access-Control-Allow-Methods","GET, POST, OPTIONS");
 return r;
}
async function authorize(req:NextRequest){
 const match=/^Bearer ([A-Za-z0-9._~-]{20,8192})$/.exec(req.headers.get("authorization")||"");
 if(!match)return {status:401 as const};
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()||"https://wgiittrvgtiosogyhfcl.supabase.co";
 const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()||
  "sb_publishable_QTCqijfNvnysUTMylNIyTA_6ngosaPN";
 const client=createClient(url,key,{global:{headers:{Authorization:"Bearer "+match[1]}},
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const {data,error}=await client.auth.getUser(match[1]);
 if(error||!data.user)return {status:401 as const};
 const {data:profile,error:profileError}=await client.from("profiles")
  .select("role").eq("id",data.user.id).maybeSingle();
 if(profileError)return {status:503 as const};
 if(profile?.role!=="admin")return {status:403 as const};
 return {status:200 as const,client};
}
function isolatedGate(req:NextRequest){
 if(!allowedZoroarkOrigin(req.headers.get("origin"),req.nextUrl.origin))
  return response(req,{error:"origin_denied"},403);
 if(!catalogManagementEnabled())return response(req,{error:"catalog_management_disabled"},503);
 return null;
}
export async function GET(req:NextRequest){
 const guard=isolatedGate(req);if(guard)return guard;
 try{
  const auth=await authorize(req);
  if(auth.status!==200||!auth.client)return response(req,{error:"admin_only"},auth.status);
  const {data,error}=await auth.client.from("zoroark_topic_candidates")
   .select("id,a,b,a_no,b_no,common,difference,level,status,version,submitted_at,reviewed_at,published_at")
   .order("id",{ascending:false}).limit(500);
  if(error||!Array.isArray(data))return response(req,{error:"catalog_unavailable"},503);
  return response(req,{baseCount:PAIRS.length,baseKeys:PAIRS.map(x=>topicPairKey(x.a,x.b)),
   catalogVersion:Math.max(0,...data.map(x=>Number(x.version)||0)),
   runtimeEnabled:catalogRuntimeEnabled(),publishEnabled:catalogPublishEnabled(),
   entries:data.map(x=>({...x,activeInGame:catalogRuntimeEnabled()&&x.status==="published"}))},200);
 }catch{return response(req,{error:"catalog_unavailable"},503)}
}
// V8 retired legacy mutable catalog decisions in favor of CAS-protected notebook RPCs.
// The ADMIN GET remains read-only; never invoke the deprecated decide() RPC.
export async function POST(req:NextRequest){
 const guard=isolatedGate(req);if(guard)return guard;
 return response(req,{error:"catalog_v8_use_notebook_api"},410);
}
