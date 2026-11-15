// Guest QR game API. Session only from two HttpOnly cookies, never request JSON or URL.
import { NextResponse } from "next/server";
import { runtimeConfig, runtimeDatabase, readJson, BodyError, sameOrigin } from "@/lib/zoroark/runtime";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const HEX=/^[a-f0-9]{64}$/;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const response=(body:Record<string,unknown>,status=200)=>NextResponse.json(body,{status,headers:{
 "Cache-Control":"private, no-store, max-age=0","Referrer-Policy":"no-referrer",
 "X-Content-Type-Options":"nosniff","Cross-Origin-Resource-Policy":"same-origin"
}});
const digest=async (v:string)=>Array.from(new Uint8Array(await crypto.subtle.digest(
 "SHA-256",new TextEncoder().encode(v))),x=>x.toString(16).padStart(2,"0")).join("");
function cookieValue(request:Request,key:string){
 const values=(request.headers.get("cookie")??"").split(";").map(x=>x.trim())
  .filter(x=>x.startsWith(key+"=")).map(x=>x.slice(key.length+1));
 return values.length===1&&HEX.test(values[0])?values[0]:null;
}
export async function POST(request:Request){
 if(!runtimeConfig("guest")||process.env.ZOROARK_GAMEPLAY_ENABLED!=="true")return response({error:"game_not_enabled"},503);
 if(!sameOrigin(request)||request.headers.get("x-zoroark-request")!=="game-v1")return response({error:"forbidden"},403);
 if(!request.headers.get("content-type")?.startsWith("application/json"))return response({error:"invalid_content_type"},415);
 let input:Record<string,unknown>;
 try{
  const data=await readJson(request);
  if(!data||typeof data!=="object"||Array.isArray(data))return response({error:"invalid_body"},400);
  input=data as Record<string,unknown>;
 }catch(e){return response({error:"invalid_body"},e instanceof BodyError?e.status:400)}
 const action=input.action;
 if(!["state","vote","question"].includes(String(action)))return response({error:"invalid_action"},400);
 const secret=cookieValue(request,"__Host-zg_guest"),device=cookieValue(request,"__Host-zg_device");
 if(!secret||!device)return response({error:"session_missing"},401);
 try{
  const sql=await runtimeDatabase("guest");
  const [rate]=await sql`select zoroark_isolated.guest_rate_gate() as allowed`;
  if(!rate?.allowed)return response({error:"rate_limited"},429);
  const sessionHash=await digest(secret),deviceHash=await digest(device);
  if(action==="state"){
   const [result]=await sql`select zoroark_isolated.guest_game_state(${sessionHash}::text,${deviceHash}::text) as game`;
   if(!result?.game){
    const [existing]=await sql`select * from zoroark_isolated.guest_me(${sessionHash}::text,${deviceHash}::text)`;
    if(existing?.state==="approved"||existing?.state==="pending")return response({game:{
      phase:"lobby",state:existing.state,roomId:existing.room_id,nickname:existing.display_name
    }});
    return response({error:"session_not_approved_or_expired"},403);
   }
   return response({game:result.game});
  }
  if(action==="vote"){
   if(typeof input.targetId!=="string"||!UUID.test(input.targetId))return response({error:"invalid_target"},400);
   const [result]=await sql`select zoroark_isolated.guest_game_vote(
    ${sessionHash}::text,${deviceHash}::text,${input.targetId}::uuid) as ok`;
   return response({ok:result?.ok===true},result?.ok===true?200:409);
  }
  if(!Number.isInteger(input.questionId)||Number(input.questionId)<0||Number(input.questionId)>11)
   return response({error:"invalid_question"},400);
  const questionId=Number(input.questionId);
  const [result]=await sql`select zoroark_isolated.guest_game_question(
    ${sessionHash}::text,${deviceHash}::text,${questionId}::integer) as ok`;
  return response({ok:result?.ok===true},result?.ok===true?200:409);
 }catch{
  return response({error:"game_service_unavailable"},503);
 }
}
