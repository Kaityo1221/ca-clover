import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { allowedZoroarkOrigin } from "@/lib/zoroark-api-policy";
import {
 OFFICIAL_TOPIC_CONTROL_ENABLED,OFFICIAL_TOPIC_WRITE_ENABLED,
 isOfficialTopicId,validateOfficialTopicState
} from "@/lib/zoroark-official-control.server";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const PAGES="https://kaityo1221.github.io";
const HEADERS={"Cache-Control":"private, no-store, no-cache, max-age=0, must-revalidate",
 "Vary":"Origin, Authorization","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"};
function reply(req:NextRequest,value:object,status:number){
 const res=NextResponse.json(value,{status,headers:HEADERS});
 if(req.headers.get("origin")===PAGES)res.headers.set("Access-Control-Allow-Origin",PAGES);
 return res;
}
export async function OPTIONS(req:NextRequest){
 if(!allowedZoroarkOrigin(req.headers.get("origin"),req.nextUrl.origin))
  return reply(req,{error:"origin_denied"},403);
 const res=new NextResponse(null,{status:204,headers:HEADERS});
 if(req.headers.get("origin")===PAGES)res.headers.set("Access-Control-Allow-Origin",PAGES);
 res.headers.set("Access-Control-Allow-Methods","GET, POST, OPTIONS");
 res.headers.set("Access-Control-Allow-Headers","Content-Type, Authorization");
 res.headers.set("Access-Control-Max-Age","300");
 return res;
}
async function admin(req:NextRequest){
 const jwt=/^Bearer ([A-Za-z0-9._~-]{20,8192})$/.exec(req.headers.get("authorization")||"");
 if(!jwt)return {status:401 as const};
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()||"https://wgiittrvgtiosogyhfcl.supabase.co";
 const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()||
  "sb_publishable_QTCqijfNvnysUTMylNIyTA_6ngosaPN";
 const client=createClient(url,key,{global:{headers:{Authorization:"Bearer "+jwt[1]}},
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const {data:identity,error:authError}=await client.auth.getUser(jwt[1]);
 if(authError||!identity.user)return {status:401 as const};
 const {data:profile,error:profileError}=await client.from("profiles")
  .select("role").eq("id",identity.user.id).maybeSingle();
 if(profileError)return {status:503 as const};
 if(profile?.role!=="admin")return {status:403 as const};
 return {status:200 as const,client,userId:identity.user.id};
}
function guard(req:NextRequest){
 if(!allowedZoroarkOrigin(req.headers.get("origin"),req.nextUrl.origin))
  return reply(req,{error:"origin_denied"},403);
 if(!OFFICIAL_TOPIC_CONTROL_ENABLED)
  return reply(req,{error:"official_control_disabled"},503);
 return null;
}
export async function GET(req:NextRequest){
 const blocked=guard(req);if(blocked)return blocked;
 try{
  const access=await admin(req);
  if(access.status!==200||!access.client)return reply(req,{error:"admin_only"},access.status);
  const {data,error}=await access.client.from("zoroark_official_topic_state")
   .select("topic_id,disabled,revision").limit(43);
  if(error)return reply(req,{error:"state_unavailable"},503);
  const rows=validateOfficialTopicState(data);
  return reply(req,{states:rows,writeEnabled:OFFICIAL_TOPIC_WRITE_ENABLED},200);
 }catch{return reply(req,{error:"state_unavailable"},503)}
}
export async function POST(req:NextRequest){
 const blocked=guard(req);if(blocked)return blocked;
 if(!OFFICIAL_TOPIC_WRITE_ENABLED)
  return reply(req,{error:"official_writes_disabled"},403);
 try{
  const access=await admin(req);
  if(access.status!==200||!access.client||!access.userId)return reply(req,{error:"admin_only"},access.status);
  if(Number(req.headers.get("content-length")||0)>1024)return reply(req,{error:"payload_too_large"},413);
  const raw=await req.text();
  if(raw.length>1024)return reply(req,{error:"payload_too_large"},413);
  let value:unknown;
  try{value=JSON.parse(raw)}catch{return reply(req,{error:"invalid_json"},400)}
  if(!value||typeof value!=="object"||Array.isArray(value))return reply(req,{error:"invalid_body"},400);
  const input=value as Record<string,unknown>;
  if(!isOfficialTopicId(input.topicId)||typeof input.disabled!=="boolean"||
    !Number.isSafeInteger(input.expectedRevision)||(input.expectedRevision as number)<0||
    (input.expectedRevision as number)>=1000000)
   return reply(req,{error:"invalid_topic_or_version"},400);

  const expected=input.expectedRevision as number;
  const table=access.client.from("zoroark_official_topic_state");
  let result;
  if(expected===0){
   if(input.disabled!==true)return reply(req,{error:"nothing_to_restore"},409);
   result=await table.insert({topic_id:input.topicId,disabled:true,revision:1,changed_by:access.userId})
    .select("topic_id,disabled,revision").maybeSingle();
  }else{
   result=await table.update({disabled:input.disabled,revision:expected+1,changed_by:access.userId})
    .eq("topic_id",input.topicId).eq("revision",expected)
    .select("topic_id,disabled,revision").maybeSingle();
  }
  if(result.error)return reply(req,{error:"state_change_not_applied"},409);
  if(!result.data)return reply(req,{error:"stale_state_retry"},409);
  const rows=validateOfficialTopicState([result.data]);
  return reply(req,{state:rows[0],appliesTo:"next_round",gameConfirmed:true},200);
 }catch{return reply(req,{error:"state_change_unavailable"},503)}
}
