// QR gameplay GM API. Isolated until an explicit feature gate and production release.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runtimeConfig, runtimeDatabase, readJson, BodyError, sameOrigin } from "@/lib/zoroark/runtime";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const reply=(body:Record<string,unknown>,status=200)=>NextResponse.json(body,{status,headers:{
 "Cache-Control":"private, no-store, max-age=0","Referrer-Policy":"no-referrer",
 "X-Content-Type-Options":"nosniff","Cross-Origin-Resource-Policy":"same-origin"
}});
type Input={action?:unknown;roomId?:unknown;difficulty?:unknown;enableMimikyu?:unknown};
type OfficialRound={round?:{pair?:{id?:unknown};wolf?:unknown;prompts?:unknown}};
function canonicalRound(data:OfficialRound,count:number){
 const value=data?.round;
 if(!value||!Array.isArray(value.prompts)||value.prompts.length!==count||
  typeof value.pair?.id!=="string"||value.pair.id.length<1||value.pair.id.length>64||
  !Number.isInteger(value.wolf)||Number(value.wolf)<0||Number(value.wolf)>=count) return null;
 const wolf=Number(value.wolf);
 const prompts=value.prompts;
 if(!prompts.every(x=>typeof x==="string"&&x.trim().length>=1&&x.length<=80))return null;
 const major=prompts.find((_,i)=>i!==wolf),minor=prompts[wolf];
 if(typeof major!=="string"||typeof minor!=="string"||major===minor||
   prompts.some((x,i)=>i!==wolf&&x!==major))return null;
 return {pairId:value.pair.id,major,minor};
}
export async function POST(request:Request){
 if(!runtimeConfig("gm")||process.env.ZOROARK_GAMEPLAY_ENABLED!=="true")return reply({error:"game_not_enabled"},503);
 if(!sameOrigin(request)||request.headers.get("x-zoroark-request")!=="game-v1")return reply({error:"forbidden"},403);
 if(!request.headers.get("content-type")?.startsWith("application/json"))return reply({error:"invalid_content_type"},415);
 const token=/^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization")??"")?.[1];
 if(!token)return reply({error:"unauthorized"},401);
 let input:Input;
 try{
  const body=await readJson(request);
  if(!body||typeof body!=="object"||Array.isArray(body))return reply({error:"invalid_body"},400);
  input=body as Input;
 }catch(e){return reply({error:"invalid_body"},e instanceof BodyError?e.status:400)}
 if(typeof input.roomId!=="string"||!UUID.test(input.roomId))return reply({error:"invalid_room"},400);
 if(!["status","start","vote","tally","finish"].includes(String(input.action)))return reply({error:"invalid_action"},400);
 try{
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key)return reply({error:"auth_not_configured"},503);
  const auth=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},
    global:{headers:{Authorization:"Bearer "+token}}});
  const {data:u,error:e}=await auth.auth.getUser(token);
  if(e||!u.user)return reply({error:"unauthorized"},401);
  const {data:profile,error:pe}=await auth.from("profiles").select("role").eq("id",u.user.id).maybeSingle();
  if(pe||!profile||!["ca","admin"].includes(profile.role))return reply({error:"ca_role_required"},403);
  const sql=await runtimeDatabase("gm");
  const [rate]=await sql`select zoroark_isolated.guest_rate_gate() as allowed`;
  if(!rate?.allowed)return reply({error:"rate_limited"},429);
  const gm=u.user.id,roomId=input.roomId;
  const [owned]=await sql`select * from zoroark_isolated.gm_room(${gm}::uuid,${roomId}::uuid)`;
  if(!owned)return reply({error:"room_not_owned"},404);
  if(input.action==="status"){
   const [record]=await sql`select zoroark_isolated.gm_game_state(${gm}::uuid,${roomId}::uuid) as game`;
   return reply({game:record?.game??null});
  }
  if(input.action==="start"){
   if(owned.state!=="lobby")return reply({error:"game_already_started"},409);
   if(!["all","easy","normal","hard"].includes(String(input.difficulty))||
      typeof input.enableMimikyu!=="boolean")return reply({error:"invalid_settings"},400);
   const roster=await sql`select * from zoroark_isolated.gm_participants(${gm}::uuid,${roomId}::uuid)`;
   const approved=roster.filter(p=>p.state==="approved");
   if(approved.length<3||roster.some(p=>p.state==="pending")||
      approved.length>Number(owned.max_players))return reply({error:"roster_not_ready"},409);
   // Existing CA-authenticated 42-pair source used by handoff gameplay.
   // Server-side only. GM browser never receives all secrets or the role index.
   const controller=new AbortController();
   const timeout=setTimeout(()=>controller.abort(),9000);
   let fetched:Response;
   try{
    fetched=await fetch("https://ca-clover.vercel.app/api/zoroark/round",{
     method:"POST",cache:"no-store",signal:controller.signal,
     headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},
     body:JSON.stringify({count:approved.length,difficulty:input.difficulty,recent:[]})
    });
   }finally{clearTimeout(timeout)}
   if(!fetched.ok)return reply({error:"canonical_round_unavailable"},503);
   const raw:unknown=await fetched.json().catch(()=>null);
   const pair=canonicalRound(raw as OfficialRound,approved.length);
   if(!pair)return reply({error:"canonical_round_invalid"},503);
   const [result]=await sql`select zoroark_isolated.gm_game_start(${gm}::uuid,${roomId}::uuid,
      ${pair.pairId}::text,${pair.major}::text,${pair.minor}::text,${input.enableMimikyu}::boolean) as ok`;
   return reply({ok:result?.ok===true,phase:"talk"},result?.ok===true?200:409);
  }
  if(input.action==="finish"){
   const [record]=await sql`select zoroark_isolated.gm_game_finish(${gm}::uuid,${roomId}::uuid) as ok`;
   return reply({ok:record?.ok===true},record?.ok===true?200:409);
  }
  const act=input.action;
  const [record]=await sql`select zoroark_isolated.gm_game_advance(${gm}::uuid,${roomId}::uuid,${act}::text) as phase`;
  return reply({phase:record?.phase??"unknown"});
 }catch(error){
  const details=error as {code?:string;message?:string};
  const name=String(details?.message??"").split("\n")[0];
  if(details?.code==="P0001" && ["roster_not_ready","votes_incomplete","invalid_transition",
    "game_not_started","runoff_limit"].includes(name))return reply({error:name},409);
  if(details?.code==="42501")return reply({error:"room_state_changed"},409);
  return reply({error:"game_service_unavailable"},503);
 }
}
