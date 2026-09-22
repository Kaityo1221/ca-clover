import { createClient } from "npm:@supabase/supabase-js@2";
import {observeCommunityIcon} from "../_shared/community-icon.ts";
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

function makeToken(){
  const bytes=new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

async function sha256(value:string){
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map(byte=>byte.toString(16).padStart(2,"0"))
    .join("");
}

function localDate(instant:Date,timezone:string){
  const parts=new Intl.DateTimeFormat("en-CA",{
    timeZone:timezone,
    year:"numeric",
    month:"2-digit",
    day:"2-digit",
  }).formatToParts(instant);
  const values=Object.fromEntries(parts.map(part=>[part.type,part.value]));
  return values.year+"-"+values.month+"-"+values.day;
}

async function ensureActorDesign(admin:any,actor:any){
  const community=actor?.community;
  if(!community?.id||!community?.avatar_url) return;
  await observeCommunityIcon(
    admin,
    community.id,
    community.avatar_url,
    {
      generateMissingThumbnail:!community.avatar_thumbnail_path,
      ensureArchive:true,
      allowUrlFallbackChange:false,
    },
  );
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

async function maybeCloseStale(admin:any,room:any){
  if(!room||!["open","processing","partial_failed","completed"].includes(room.status)) return room;

  const {data:event,error:eventError}=await admin
    .from("stamp_events")
    .select("status,starts_at,ends_at")
    .eq("id",room.event_id)
    .single();
  if(eventError) throw eventError;

  const now=Date.now();
  const eventEnded=event.status!=="scheduled"||now>=new Date(event.ends_at).getTime();
  const hostStale=now-new Date(room.last_host_seen_at).getTime()>=5*60_000;

  if(eventEnded||hostStale){
    const nextStatus=eventEnded?"expired":"closed";
    const {data:updated,error}=await admin
      .from("stamp_bulk_rooms")
      .update({status:nextStatus,closed_at:new Date().toISOString()})
      .eq("id",room.id)
      .in("status",["open","processing","partial_failed","completed"])
      .select("*")
      .single();
    if(error) throw error;
    return updated;
  }
  return room;
}

async function missionForRoom(admin:any,room:any){
  const today=localDate(new Date(),room.event_timezone);
  const {data:assignment,error:assignmentError}=await admin
    .from("stamp_event_daily_missions")
    .select("mission_template_id")
    .eq("event_id",room.event_id)
    .eq("local_date",today)
    .maybeSingle();
  if(assignmentError) throw assignmentError;
  if(!assignment) return {local_date:today,mission:null};

  const {data:mission,error:missionError}=await admin
    .from("stamp_mission_templates")
    .select("id,title,instruction")
    .eq("id",assignment.mission_template_id)
    .maybeSingle();
  if(missionError) throw missionError;
  return {local_date:today,mission:mission??null};
}

async function getRoomDto(admin:any,roomId:string,actorUserId:string,touchHost=false){
  const {data:rawRoom,error:roomError}=await admin
    .from("stamp_bulk_rooms")
    .select("*")
    .eq("id",roomId)
    .single();
  if(roomError||!rawRoom) throw new Error("大交換ルームが見つかりません");

  let room=await maybeCloseStale(admin,rawRoom);

  const {data:membership,error:membershipError}=await admin
    .from("stamp_bulk_participants")
    .select("user_id")
    .eq("room_id",room.id)
    .eq("user_id",actorUserId)
    .maybeSingle();
  if(membershipError) throw membershipError;
  if(!membership) throw new Error("この大交換ルームには参加していません");

  const isHost=room.host_user_id===actorUserId;
  if(touchHost&&isHost&&["open","processing","partial_failed","completed"].includes(room.status)){
    const now=new Date().toISOString();
    const {data:updated,error}=await admin
      .from("stamp_bulk_rooms")
      .update({last_host_seen_at:now})
      .eq("id",room.id)
      .select("*")
      .single();
    if(error) throw error;
    room=updated;
  }

  const [participantResult,pairResult,mission]=await Promise.all([
    admin.from("stamp_bulk_participants")
      .select("user_id,joined_at,locked_at,snapshot")
      .eq("room_id",room.id)
      .order("joined_at",{ascending:true}),
    admin.from("stamp_bulk_pair_attempts")
      .select("status")
      .eq("room_id",room.id),
    missionForRoom(admin,room),
  ]);

  if(participantResult.error) throw participantResult.error;
  if(pairResult.error) throw pairResult.error;

  const participants=(participantResult.data??[]).map((row:any)=>({
    user_id:row.user_id,
    joined_at:row.joined_at,
    locked_at:row.locked_at,
    is_me:row.user_id===actorUserId,
    is_host:row.user_id===room.host_user_id,
    trainer_name:row.snapshot?.trainer_name??"CA",
    community:{
      id:row.snapshot?.community?.id??null,
      name:row.snapshot?.community?.name??"Community",
      prefecture:row.snapshot?.community?.prefecture??null,
      avatar_url:row.snapshot?.community?.avatar_url??null,
      avatar_thumbnail_path:row.snapshot?.community?.avatar_thumbnail_path??null,
      avatar_last_changed_at:row.snapshot?.community?.avatar_last_changed_at??null,
    },
  }));

  const pairStatuses=pairResult.data??[];
  const completedPairs=pairStatuses.filter((row:any)=>row.status==="completed").length;
  const failedPairs=pairStatuses.filter((row:any)=>row.status==="failed").length;
  const pendingPairs=pairStatuses.filter((row:any)=>row.status==="pending").length;
  const count=room.frozen_participant_count??participants.length;

  return {
    id:room.id,
    status:room.status,
    my_role:isHost?"host":"participant",
    created_at:room.created_at,
    started_at:room.started_at,
    completed_at:room.completed_at,
    closed_at:room.closed_at,
    event:{
      id:room.event_id,
      name:room.event_name,
      location:room.event_location,
      timezone:room.event_timezone,
    },
    participant_count:participants.length,
    frozen_participant_count:room.frozen_participant_count,
    each_receives:Math.max(0,count-1),
    total_pairs:room.total_pair_count,
    completed_pairs:completedPairs,
    failed_pairs:failedPairs,
    pending_pairs:pendingPairs,
    participants,
    today_local_date:mission.local_date,
    today_mission:mission.mission,
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
    const actor=await resolveStampActor(admin,actorUserId);
    const body=await req.json().catch(()=>({}));
    const action=String(body.action??"");

    if(action==="resume"){
      const {data:rows,error}=await admin
        .from("stamp_bulk_participants")
        .select("room_id,joined_at")
        .eq("user_id",actorUserId)
        .order("joined_at",{ascending:false})
        .limit(10);
      if(error) throw error;

      for(const row of rows??[]){
        try{
          const room=await getRoomDto(admin,row.room_id,actorUserId,true);
          if(["open","processing","partial_failed","completed"].includes(room.status)){
            return json({ok:true,room});
          }
        }catch{}
      }
      return json({ok:true,room:null});
    }

    if(action==="create"){
      await ensureActorDesign(admin,actor);
      const event=await getActiveEvent(admin,actorUserId);
      if(!event) return json({error:"開催中の参加イベントがありません"},409);

      const {data:existing,error:existingError}=await admin
        .from("stamp_bulk_rooms")
        .select("*")
        .eq("event_id",event.id)
        .in("status",["open","processing","partial_failed","completed"])
        .maybeSingle();
      if(existingError) throw existingError;

      if(existing){
        const room=await maybeCloseStale(admin,existing);
        if(["open","processing","partial_failed","completed"].includes(room.status)){
          const {data:already}=await admin.from("stamp_bulk_participants")
            .select("user_id")
            .eq("room_id",room.id)
            .eq("user_id",actorUserId)
            .maybeSingle();
          if(already) return json({ok:true,room:await getRoomDto(admin,room.id,actorUserId,true),token:null});
          return json({error:"このイベントでは、すでに大交換ルームが開いています。主催者のQRから参加してください。"},409);
        }
      }

      const token=makeToken();
      const tokenHash=await sha256(token);
      const {data:room,error:insertError}=await admin.from("stamp_bulk_rooms").insert({
        event_id:event.id,
        host_user_id:actorUserId,
        token_hash:tokenHash,
        event_name:event.name,
        event_location:event.location,
        event_timezone:event.timezone,
        last_host_seen_at:new Date().toISOString(),
      }).select("*").single();
      if(insertError) throw insertError;

      const {error:participantError}=await admin.from("stamp_bulk_participants").insert({
        room_id:room.id,
        user_id:actorUserId,
        snapshot:actor,
      });
      if(participantError) throw participantError;

      return json({ok:true,token,room:await getRoomDto(admin,room.id,actorUserId,true)});
    }

    if(action==="join"){
      await ensureActorDesign(admin,actor);
      const token=String(body.token??"").trim();
      if(!token) return json({error:"大交換QRを読み取れませんでした"},400);
      const tokenHash=await sha256(token);

      const {data:rawRoom,error}=await admin
        .from("stamp_bulk_rooms")
        .select("*")
        .eq("token_hash",tokenHash)
        .maybeSingle();
      if(error) throw error;
      if(!rawRoom) return json({error:"この大交換QRは無効です"},404);

      const room=await maybeCloseStale(admin,rawRoom);
      if(room.status!=="open") return json({error:"この大交換ルームは受付を終了しています"},409);

      const event=await getActiveEvent(admin,actorUserId);
      if(!event||event.id!==room.event_id){
        return json({error:"先に「"+room.event_name+"」へ参加してからQRを読み取ってください"},409);
      }

      const {error:joinError}=await admin.from("stamp_bulk_participants").upsert({
        room_id:room.id,
        user_id:actorUserId,
        joined_at:new Date().toISOString(),
        locked_at:null,
        snapshot:actor,
      },{onConflict:"room_id,user_id"});
      if(joinError) throw joinError;

      return json({ok:true,room:await getRoomDto(admin,room.id,actorUserId,false)});
    }

    if(action==="status"){
      const roomId=String(body.roomId??"");
      if(!roomId) return json({error:"roomId is required"},400);
      return json({ok:true,room:await getRoomDto(admin,roomId,actorUserId,true)});
    }

    if(action==="rotate_token"){
      const roomId=String(body.roomId??"");
      if(!roomId) return json({error:"roomId is required"},400);
      const {data:room,error}=await admin.from("stamp_bulk_rooms").select("*").eq("id",roomId).single();
      if(error||!room) throw new Error("大交換ルームが見つかりません");
      if(room.host_user_id!==actorUserId) return json({error:"主催者だけがQRを再発行できます"},403);
      if(room.status!=="open") return json({error:"受付中だけQRを再発行できます"},409);

      const token=makeToken();
      const tokenHash=await sha256(token);
      const {error:updateError}=await admin.from("stamp_bulk_rooms")
        .update({token_hash:tokenHash,last_host_seen_at:new Date().toISOString()})
        .eq("id",roomId);
      if(updateError) throw updateError;
      return json({ok:true,token,room:await getRoomDto(admin,roomId,actorUserId,true)});
    }

    if(action==="leave"){
      const roomId=String(body.roomId??"");
      if(!roomId) return json({error:"roomId is required"},400);
      const {data:room,error}=await admin.from("stamp_bulk_rooms").select("*").eq("id",roomId).single();
      if(error||!room) throw new Error("大交換ルームが見つかりません");
      if(room.host_user_id===actorUserId) return json({error:"主催者は「終了」でルームを閉じてください"},409);
      if(room.status!=="open") return json({error:"交換開始後は退出できません"},409);
      const {error:deleteError}=await admin.from("stamp_bulk_participants")
        .delete().eq("room_id",roomId).eq("user_id",actorUserId);
      if(deleteError) throw deleteError;
      return json({ok:true,left:true});
    }

    if(action==="start"){
      const roomId=String(body.roomId??"");
      const expectedCount=Number(body.expectedCount??0);
      if(!roomId||!Number.isInteger(expectedCount)||expectedCount<2){
        return json({error:"参加人数を確認できません"},400);
      }
      const {error}=await admin.rpc("stamp_bulk_prepare_internal",{
        p_room_id:roomId,
        p_host_user_id:actorUserId,
        p_expected_count:expectedCount,
      });
      if(error) throw error;
      return json({ok:true,room:await getRoomDto(admin,roomId,actorUserId,true)});
    }

    if(action==="process"){
      const roomId=String(body.roomId??"");
      const mode=String(body.mode??"pending");
      const retryCutoff=body.retryCutoff?String(body.retryCutoff):null;
      if(!roomId||!["pending","failed"].includes(mode)) return json({error:"invalid processing request"},400);

      const {data:summary,error}=await admin.rpc("stamp_bulk_process_batch_internal",{
        p_room_id:roomId,
        p_host_user_id:actorUserId,
        p_mode:mode,
        p_limit:100,
        p_retry_cutoff:retryCutoff,
      });
      if(error) throw error;
      return json({
        ok:true,
        summary,
        room:await getRoomDto(admin,roomId,actorUserId,true),
      });
    }

    if(action==="end"){
      const roomId=String(body.roomId??"");
      if(!roomId) return json({error:"roomId is required"},400);
      const {data:room,error}=await admin.from("stamp_bulk_rooms").select("*").eq("id",roomId).single();
      if(error||!room) throw new Error("大交換ルームが見つかりません");
      if(room.host_user_id!==actorUserId) return json({error:"主催者だけが終了できます"},403);
      if(room.status==="processing") return json({error:"交換保存中は終了できません"},409);

      const {error:updateError}=await admin.from("stamp_bulk_rooms")
        .update({status:"closed",closed_at:new Date().toISOString(),last_host_seen_at:new Date().toISOString()})
        .eq("id",roomId);
      if(updateError) throw updateError;
      return json({ok:true,room:await getRoomDto(admin,roomId,actorUserId,false)});
    }

    return json({error:"unknown action"},400);
  }catch(error){
    const message=error instanceof Error?error.message:String(error);
    return json({error:message},400);
  }
});
