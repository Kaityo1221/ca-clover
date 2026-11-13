// GM-only operations for isolated guest lobby. No public bearerless endpoints.
import { NextResponse } from "next/server";
import { runtimeConfig, runtimeDatabase, readJson, BodyError, sameOrigin } from "@/lib/zoroark/runtime";
import { createClient } from "@supabase/supabase-js";
export const runtime="nodejs";
export const dynamic="force-dynamic";
function respond(value:Record<string,unknown>,status:number){
 return NextResponse.json(value,{status,headers:{"Cache-Control":"private, no-store","Referrer-Policy":"no-referrer","X-Content-Type-Options":"nosniff"}});
}
export async function POST(request:Request){
 if(!runtimeConfig("gm") || process.env.ZOROARK_GUEST_LOBBY_ENABLED!=="true")return respond({error:"not_enabled"},503);
 if(!sameOrigin(request)||
 request.headers.get("x-zoroark-request")!=="gm-lobby-v1")return respond({error:"forbidden"},403);
 if(!request.headers.get("content-type")?.startsWith("application/json"))return respond({error:"invalid_content_type"},415);
 const match=/^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization")??"");
 if(!match)return respond({error:"unauthorized"},401);
 let input:Record<string,unknown>;
 try{
  const val:unknown=await readJson(request);
  if(!val||Array.isArray(val)||typeof val!=="object")return respond({error:"invalid_request"},400);
  input=val as Record<string,unknown>;
 }catch(error){return respond({error:"invalid_request"},error instanceof BodyError ? error.status : 400)}
 if(typeof input.roomId!=="string"||!/^[a-f0-9-]{36}$/i.test(input.roomId))return respond({error:"invalid_room"},400);
 const act=input.action;
 if(!["list","lock","unlock","approve","reject","rotate"].includes(String(act)))return respond({error:"invalid_action"},400);
 let stage="authentication";
 try{
  const auth=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL??"https://wgiittrvgtiosogyhfcl.supabase.co",
   process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY??"sb_publishable_QTCqijfNvnysUTMylNIyTA_6ngosaPN",
   {auth:{persistSession:false,autoRefreshToken:false},
    global:{headers:{Authorization:"Bearer "+match[1]}}});
  const {data:u,error:e}=await auth.auth.getUser(match[1]);
  stage="profile";
  if(e||!u.user)return respond({error:"unauthorized"},401);
  const {data:p,error:pe}=await auth.from("profiles").select("role").eq("id",u.user.id).maybeSingle();
  if(pe||!p||!["ca","admin"].includes(p.role))return respond({error:"ca_role_required"},403);
  stage="database";
  const sql=await runtimeDatabase("gm");
  stage="rate_limit";
  const [rate]=await sql`select zoroark_isolated.guest_rate_gate() as allowed`;
  if(!rate?.allowed)return respond({error:"rate_limited"},429);
  stage="room_lookup";
  const [room]=await sql`select * from zoroark_isolated.gm_room(${u.user.id}::uuid,${input.roomId}::uuid)`;
  if(!room)return respond({error:"room_not_found"},404);
  if(act==="list"){
   stage="participant_lookup";
   const players=await sql`select * from zoroark_isolated.gm_participants(${u.user.id}::uuid,${input.roomId}::uuid)`;
   return respond({room:{maxPlayers:room.max_players,state:room.state,locked:room.join_locked,
      joinExpiresAt:room.join_expires_at},participants:players},200);
  }
  if(room.state!=="lobby")return respond({error:"lobby_closed"},409);
  if(act==="rotate"){
    stage="invite_rotate";
    const bytes=new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const invite=Array.from(bytes,v=>v.toString(16).padStart(2,"0")).join("");
    const sha=Array.from(new Uint8Array(
      await crypto.subtle.digest("SHA-256",new TextEncoder().encode(invite))),
      v=>v.toString(16).padStart(2,"0")).join("");
    const [rotated]=await sql`
      select zoroark_isolated.gm_rotate_invite(
        ${u.user.id}::uuid,${input.roomId}::uuid,${sha}::text) as join_expires_at`;
    if(!rotated?.join_expires_at)return respond({error:"rotate_failed"},503);
    // Old invite is invalid immediately; only GM receives the new QR token.
    return respond({invite,joinExpiresAt:rotated.join_expires_at},200);
  }
  const guestId=typeof input.guestId==="string"&&/^[a-f0-9-]{36}$/i.test(input.guestId)?input.guestId:null;
  if((act==="approve"||act==="reject")&&!guestId)return respond({error:"invalid_guest"},400);
  stage="gm_action";
  const [result]=await sql`
    select zoroark_isolated.gm_lobby_action(${u.user.id}::uuid,${input.roomId}::uuid,
      ${act as string}::text,${guestId}::uuid) as changed`;
  return respond({ok:result?.changed===1},200);
 }catch{return respond({error:"gm_service_unavailable", ...(process.env.VERCEL_ENV==="preview"?{diagnosticStage:stage}:{})},503)}
}
