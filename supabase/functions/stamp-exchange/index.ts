import { createClient } from "npm:@supabase/supabase-js@2";
import {resolveStampActor} from "../_shared/stamp-identity.ts";

const corsHeaders={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
};

function json(data:unknown,status=200){
  return new Response(JSON.stringify(data),{
    status,
    headers:{...corsHeaders,"Content-Type":"application/json"},
  });
}

function base64Url(bytes:Uint8Array){
  let raw="";
  for(const byte of bytes) raw+=String.fromCharCode(byte);
  return btoa(raw).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}

async function sha256(value:string){
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map(byte=>byte.toString(16).padStart(2,"0"))
    .join("");
}

function makeToken(){
  const bytes=new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

async function getActiveEvent(admin:any,userId:string){
  const now=new Date().toISOString();
  const {data:participants,error:participantError}=await admin
    .from("stamp_event_participants")
    .select("event_id")
    .eq("user_id",userId)
    .is("left_at",null);
  if(participantError) throw participantError;
  const ids=(participants??[]).map((row:any)=>row.event_id);
  if(!ids.length) return null;

  const {data:events,error:eventError}=await admin
    .from("stamp_events")
    .select("id,name,location,timezone,starts_at,ends_at,status")
    .in("id",ids)
    .eq("status","scheduled")
    .lte("starts_at",now)
    .gt("ends_at",now)
    .order("starts_at",{ascending:false})
    .limit(1);
  if(eventError) throw eventError;
  return events?.[0]??null;
}

async function getSessionDto(admin:any,sessionId:string,actorUserId:string){
  const {data:session,error}=await admin
    .from("stamp_exchange_sessions")
    .select("*")
    .eq("id",sessionId)
    .single();
  if(error||!session) throw new Error("交換セッションが見つかりません");

  if(session.issuer_user_id!==actorUserId && session.scanner_user_id!==actorUserId){
    throw new Error("この交換には参加していません");
  }

  if(session.status==="open" && new Date(session.expires_at).getTime()<=Date.now()){
    await admin.from("stamp_exchange_sessions")
      .update({status:"expired"})
      .eq("id",session.id)
      .eq("status","open");
    session.status="expired";
  }

  const issuer=session.issuer_snapshot??await resolveStampActor(admin,session.issuer_user_id);
  const scanner=session.scanner_user_id
    ?session.scanner_snapshot??await resolveStampActor(admin,session.scanner_user_id)
    :null;

  await admin.from("stamp_exchange_sessions")
    .update({last_client_seen_at:new Date().toISOString()})
    .eq("id",session.id);
  const myRole=session.issuer_user_id===actorUserId?"issuer":"scanner";
  const partner=myRole==="issuer"?scanner:issuer;

  return {
    id:session.id,
    status:session.status,
    expires_at:session.expires_at,
    created_at:session.created_at,
    paired_at:session.paired_at,
    completed_at:session.completed_at,
    my_role:myRole,
    my_confirmed:myRole==="issuer"?session.issuer_confirmed:session.scanner_confirmed,
    partner_confirmed:myRole==="issuer"?session.scanner_confirmed:session.issuer_confirmed,
    me:myRole==="issuer"?issuer:scanner,
    partner,
    event:session.event_id?{
      id:session.event_id,
      name:session.event_name,
      location:session.event_location,
      timezone:session.event_timezone,
    }:null,
    result:session.result??null,
  };
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders});
  if(req.method!=="POST") return json({error:"method not allowed"},405);

  try{
    const url=Deno.env.get("SUPABASE_URL");
    const anon=Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if(!url||!anon||!serviceKey) throw new Error("Supabase environment is incomplete");

    const authorization=req.headers.get("Authorization")??"";
    const userClient=createClient(url,anon,{
      global:{headers:{Authorization:authorization}},
      auth:{persistSession:false},
    });
    const {data:userData,error:userError}=await userClient.auth.getUser();
    if(userError||!userData.user) return json({error:"unauthorized"},401);

    const actorUserId=userData.user.id;
    const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
    const body=await req.json().catch(()=>({}));
    const action=String(body.action??"");

    if(action==="resume"){
      await resolveStampActor(admin,actorUserId);
      const cutoff=new Date(Date.now()-10*60_000).toISOString();
      const {data:recent,error:recentError}=await admin
        .from("stamp_exchange_sessions")
        .select("id,status,created_at")
        .or("issuer_user_id.eq."+actorUserId+",scanner_user_id.eq."+actorUserId)
        .in("status",["open","paired","completed"])
        .gte("created_at",cutoff)
        .order("created_at",{ascending:false})
        .limit(1);
      if(recentError) throw recentError;
      if(!recent?.length) return json({ok:true,session:null});
      return json({ok:true,session:await getSessionDto(admin,recent[0].id,actorUserId)});
    }

    if(action==="create"){
      const actor=await resolveStampActor(admin,actorUserId);
      const activeEvent=await getActiveEvent(admin,actorUserId);

      await admin.from("stamp_exchange_sessions")
        .update({status:"expired"})
        .eq("issuer_user_id",actorUserId)
        .eq("status","open");

      const token=makeToken();
      const tokenHash=await sha256(token);
      const expiresAt=new Date(Date.now()+60_000).toISOString();
      const {data:session,error}=await admin.from("stamp_exchange_sessions").insert({
        token_hash:tokenHash,
        issuer_user_id:actorUserId,
        issuer_snapshot:actor,
        expires_at:expiresAt,
        last_client_seen_at:new Date().toISOString(),
        event_id:activeEvent?.id??null,
        event_name:activeEvent?.name??null,
        event_location:activeEvent?.location??null,
        event_timezone:activeEvent?.timezone??null,
      }).select("id,expires_at").single();
      if(error) throw error;

      return json({
        ok:true,
        token,
        session:await getSessionDto(admin,session.id,actorUserId),
      });
    }

    if(action==="claim"){
      const actor=await resolveStampActor(admin,actorUserId);
      const token=String(body.token??"").trim();
      if(!token) return json({error:"QRコードを読み取れませんでした"},400);
      const tokenHash=await sha256(token);

      const {data:targetSession,error:targetSessionError}=await admin
        .from("stamp_exchange_sessions")
        .select("id,event_id,event_name,event_location,event_timezone,status,expires_at")
        .eq("token_hash",tokenHash)
        .maybeSingle();
      if(targetSessionError) throw targetSessionError;
      if(!targetSession) return json({error:"QRコードが無効です"},400);

      if(targetSession.event_id){
        const scannerEvent=await getActiveEvent(admin,actorUserId);
        if(!scannerEvent||scannerEvent.id!==targetSession.event_id){
          return json({
            error:"このQRは「"+(targetSession.event_name??"イベント")+"」のイベントモードです。先に同じイベントへ参加してください。"
          },409);
        }
      }

      const {data:sessionId,error}=await admin.rpc("stamp_exchange_claim_internal",{
        p_token_hash:tokenHash,
        p_scanner_user_id:actorUserId,
      });
      if(error) throw error;
      const {error:snapshotError}=await admin.from("stamp_exchange_sessions")
        .update({
          scanner_snapshot:actor,
          last_client_seen_at:new Date().toISOString(),
        })
        .eq("id",String(sessionId))
        .eq("scanner_user_id",actorUserId);
      if(snapshotError) throw snapshotError;
      return json({ok:true,session:await getSessionDto(admin,String(sessionId),actorUserId)});
    }

    if(action==="status"){
      const sessionId=String(body.sessionId??"");
      if(!sessionId) return json({error:"sessionId is required"},400);
      return json({ok:true,session:await getSessionDto(admin,sessionId,actorUserId)});
    }

    if(action==="confirm"){
      const sessionId=String(body.sessionId??"");
      if(!sessionId) return json({error:"sessionId is required"},400);
      const {error}=await admin.rpc("stamp_exchange_confirm_internal",{
        p_session_id:sessionId,
        p_actor_user_id:actorUserId,
      });
      if(error) throw error;
      return json({ok:true,session:await getSessionDto(admin,sessionId,actorUserId)});
    }

    if(action==="cancel"){
      const sessionId=String(body.sessionId??"");
      if(!sessionId) return json({error:"sessionId is required"},400);
      const {error}=await admin.rpc("stamp_exchange_cancel_internal",{
        p_session_id:sessionId,
        p_actor_user_id:actorUserId,
      });
      if(error) throw error;
      return json({ok:true,session:await getSessionDto(admin,sessionId,actorUserId)});
    }

    return json({error:"unknown action"},400);
  }catch(error){
    const message=error instanceof Error?error.message:String(error);
    return json({error:message},400);
  }
});
