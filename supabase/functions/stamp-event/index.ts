import { createClient } from "npm:@supabase/supabase-js@2";

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

function phaseOf(event:any,nowMs=Date.now()){
  if(event.status==="cancelled") return "cancelled";
  const start=new Date(event.starts_at).getTime();
  const end=new Date(event.ends_at).getTime();
  if(nowMs<start) return "scheduled";
  if(nowMs>=end) return "ended";
  return "active";
}

function localDate(instant:string|Date,timezone:string){
  const date=instant instanceof Date?instant:new Date(instant);
  const parts=new Intl.DateTimeFormat("en-CA",{
    timeZone:timezone,
    year:"numeric",
    month:"2-digit",
    day:"2-digit",
  }).formatToParts(date);
  const values=Object.fromEntries(parts.map(part=>[part.type,part.value]));
  return values.year+"-"+values.month+"-"+values.day;
}

function localDateTime(instant:string,timezone:string){
  const parts=new Intl.DateTimeFormat("sv-SE",{
    timeZone:timezone,
    year:"numeric",
    month:"2-digit",
    day:"2-digit",
    hour:"2-digit",
    minute:"2-digit",
    hour12:false,
  }).formatToParts(new Date(instant));
  const values=Object.fromEntries(parts.map(part=>[part.type,part.value]));
  return values.year+"-"+values.month+"-"+values.day+"T"+values.hour+":"+values.minute;
}

async function getAccess(admin:any,userId:string){
  const [profileResult,permissionResult,identityResult]=await Promise.all([
    admin.from("profiles").select("role,niantic_id").eq("id",userId).single(),
    admin.from("user_permissions").select("permission_code").eq("user_id",userId).eq("permission_code","S"),
    admin.from("user_ca_identities").select("ca_member_id").eq("user_id",userId).eq("is_primary",true).maybeSingle(),
  ]);

  if(profileResult.error||!profileResult.data) throw new Error("profile not found");
  const profile=profileResult.data;
  const isAdmin=profile.role==="admin";
  const hasStamp=isAdmin||(permissionResult.data??[]).some((row:any)=>row.permission_code==="S");

  return {
    isAdmin,
    hasStamp,
    hasIdentity:Boolean(identityResult.data?.ca_member_id),
    nianticId:profile.niantic_id??null,
  };
}

async function listData(admin:any,userId:string,isAdmin:boolean){
  const now=new Date();
  const nowIso=now.toISOString();

  let eventQuery=admin.from("stamp_events")
    .select("id,name,location,timezone,starts_at,ends_at,status,created_at,updated_at")
    .order("starts_at",{ascending:true});

  if(!isAdmin){
    const lower=new Date(now.getTime()-24*60*60*1000).toISOString();
    const upper=new Date(now.getTime()+120*24*60*60*1000).toISOString();
    eventQuery=eventQuery.gte("ends_at",lower).lte("starts_at",upper).eq("status","scheduled");
  }

  const [eventsResult,participantResult,missionResult,assignmentResult]=await Promise.all([
    eventQuery,
    admin.from("stamp_event_participants")
      .select("event_id,user_id,joined_at,left_at")
      .eq("user_id",userId),
    admin.from("stamp_mission_templates")
      .select("id,title,instruction,is_active,created_at,updated_at")
      .order("created_at",{ascending:true}),
    admin.from("stamp_event_daily_missions")
      .select("event_id,local_date,mission_template_id,created_at"),
  ]);

  const firstError=eventsResult.error??participantResult.error??missionResult.error??assignmentResult.error;
  if(firstError) throw firstError;

  const events=eventsResult.data??[];
  const participants=participantResult.data??[];
  const missions=missionResult.data??[];
  const assignments=assignmentResult.data??[];
  const joinedByEvent=new Map(participants.map((row:any)=>[row.event_id,row]));
  const missionById=new Map(missions.map((row:any)=>[row.id,row]));
  const assignmentMap=new Map(assignments.map((row:any)=>[row.event_id+":"+row.local_date,row]));

  let participantCounts=new Map<string,number>();
  if(isAdmin&&events.length){
    const ids=events.map((event:any)=>event.id);
    const {data:allParticipants,error:allParticipantsError}=await admin
      .from("stamp_event_participants")
      .select("event_id,left_at")
      .in("event_id",ids)
      .is("left_at",null);
    if(allParticipantsError) throw allParticipantsError;
    for(const row of allParticipants??[]){
      participantCounts.set(row.event_id,(participantCounts.get(row.event_id)??0)+1);
    }
  }

  const eventDtos=events.map((event:any)=>{
    const phase=phaseOf(event,now.getTime());
    const participation=joinedByEvent.get(event.id);
    const joined=Boolean(participation&&!participation.left_at);
    const today=localDate(now,event.timezone);
    const assignment=assignmentMap.get(event.id+":"+today);
    const mission=assignment?missionById.get(assignment.mission_template_id)??null:null;

    return {
      ...event,
      phase,
      joined,
      joined_at:participation?.joined_at??null,
      active_for_me:joined&&phase==="active",
      today_local_date:today,
      today_mission:mission,
      participant_count:isAdmin?(participantCounts.get(event.id)??0):undefined,
      starts_local:localDateTime(event.starts_at,event.timezone),
      ends_local:localDateTime(event.ends_at,event.timezone),
    };
  });

  const joinedActive=eventDtos.find((event:any)=>event.active_for_me)??null;

  return {
    ok:true,
    server_now:nowIso,
    active_event:joinedActive,
    events:eventDtos,
    missions:isAdmin?missions.filter((mission:any)=>mission.is_active):undefined,
    assignments:isAdmin?assignments:undefined,
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
    const access=await getAccess(admin,actorUserId);
    if(!access.hasStamp) return json({error:"Stamp Rallyの利用権限がありません"},403);

    const body=await req.json().catch(()=>({}));
    const action=String(body.action??"");

    if(action==="list"){
      return json(await listData(admin,actorUserId,access.isAdmin));
    }

    if(action==="join"){
      if(!access.hasIdentity) return json({error:"交換用CA本人情報が設定されていません"},400);
      const eventId=String(body.eventId??"");
      if(!eventId) return json({error:"eventId is required"},400);

      const {data:event,error:eventError}=await admin
        .from("stamp_events")
        .select("id,name,starts_at,ends_at,status")
        .eq("id",eventId)
        .single();
      if(eventError||!event) return json({error:"イベントが見つかりません"},404);
      if(event.status!=="scheduled") return json({error:"このイベントには参加できません"},409);
      if(Date.now()>=new Date(event.ends_at).getTime()) return json({error:"このイベントは終了しています"},409);

      const {data:currentRows,error:currentError}=await admin
        .from("stamp_event_participants")
        .select("event_id,left_at")
        .eq("user_id",actorUserId)
        .is("left_at",null);
      if(currentError) throw currentError;

      const otherIds=(currentRows??[]).map((row:any)=>row.event_id).filter((id:string)=>id!==eventId);
      if(otherIds.length){
        const {data:otherEvents,error:otherError}=await admin
          .from("stamp_events")
          .select("id,name,starts_at,ends_at,status")
          .in("id",otherIds)
          .eq("status","scheduled");
        if(otherError) throw otherError;

        const targetStart=new Date(event.starts_at).getTime();
        const targetEnd=new Date(event.ends_at).getTime();
        const conflict=(otherEvents??[]).find((other:any)=>{
          const otherStart=new Date(other.starts_at).getTime();
          const otherEnd=new Date(other.ends_at).getTime();
          return targetStart<otherEnd&&otherStart<targetEnd;
        });
        if(conflict){
          return json({error:"時間が重なる「"+conflict.name+"」に参加済みです"},409);
        }
      }

      const {error:joinError}=await admin.from("stamp_event_participants").upsert({
        event_id:eventId,
        user_id:actorUserId,
        joined_at:new Date().toISOString(),
        left_at:null,
      },{onConflict:"event_id,user_id"});
      if(joinError) throw joinError;

      return json(await listData(admin,actorUserId,access.isAdmin));
    }

    if(action==="leave"){
      const eventId=String(body.eventId??"");
      if(!eventId) return json({error:"eventId is required"},400);
      const {error}=await admin.from("stamp_event_participants")
        .update({left_at:new Date().toISOString()})
        .eq("event_id",eventId)
        .eq("user_id",actorUserId);
      if(error) throw error;
      return json(await listData(admin,actorUserId,access.isAdmin));
    }

    if(!access.isAdmin) return json({error:"ADMIN専用です"},403);

    if(action==="create_event"){
      const name=String(body.name??"").trim();
      const location=String(body.location??"").trim();
      const timezone=String(body.timezone??"Asia/Tokyo").trim();
      const startsLocal=String(body.startsLocal??"").trim();
      const endsLocal=String(body.endsLocal??"").trim();
      if(!name||!startsLocal||!endsLocal) return json({error:"イベント名・開始・終了は必須です"},400);

      const {error}=await admin.rpc("stamp_event_create_internal",{
        p_name:name,
        p_location:location,
        p_timezone:timezone,
        p_starts_local:startsLocal,
        p_ends_local:endsLocal,
        p_created_by:actorUserId,
      });
      if(error) throw error;
      return json(await listData(admin,actorUserId,true));
    }

    if(action==="update_event"){
      const eventId=String(body.eventId??"");
      const name=String(body.name??"").trim();
      const location=String(body.location??"").trim();
      const timezone=String(body.timezone??"Asia/Tokyo").trim();
      const startsLocal=String(body.startsLocal??"").trim();
      const endsLocal=String(body.endsLocal??"").trim();
      const status=String(body.status??"scheduled");
      if(!eventId||!name||!startsLocal||!endsLocal) return json({error:"イベント情報が不足しています"},400);

      const {error}=await admin.rpc("stamp_event_update_internal",{
        p_event_id:eventId,
        p_name:name,
        p_location:location,
        p_timezone:timezone,
        p_starts_local:startsLocal,
        p_ends_local:endsLocal,
        p_status:status,
      });
      if(error) throw error;
      return json(await listData(admin,actorUserId,true));
    }

    if(action==="create_mission"){
      const title=String(body.title??"").trim();
      const instruction=String(body.instruction??"").trim();
      if(!title||!instruction) return json({error:"ミッション名と内容は必須です"},400);
      const {error}=await admin.from("stamp_mission_templates").insert({
        title,
        instruction,
        is_active:true,
        created_by:actorUserId,
      });
      if(error) throw error;
      return json(await listData(admin,actorUserId,true));
    }

    if(action==="assign_mission"){
      const eventId=String(body.eventId??"");
      const localDateValue=String(body.localDate??"");
      const missionId=String(body.missionId??"");
      if(!eventId||!/^\d{4}-\d{2}-\d{2}$/.test(localDateValue)||!missionId){
        return json({error:"イベント・日付・ミッションを指定してください"},400);
      }

      const {data:event,error:eventError}=await admin
        .from("stamp_events")
        .select("id,timezone,starts_at,ends_at")
        .eq("id",eventId)
        .single();
      if(eventError||!event) return json({error:"イベントが見つかりません"},404);

      const startDate=localDate(event.starts_at,event.timezone);
      const lastInstant=new Date(new Date(event.ends_at).getTime()-1);
      const endDate=localDate(lastInstant,event.timezone);
      if(localDateValue<startDate||localDateValue>endDate){
        return json({error:"イベント開催日内の日付を指定してください"},400);
      }

      const {error}=await admin.from("stamp_event_daily_missions").upsert({
        event_id:eventId,
        local_date:localDateValue,
        mission_template_id:missionId,
        created_by:actorUserId,
      },{onConflict:"event_id,local_date"});
      if(error) throw error;
      return json(await listData(admin,actorUserId,true));
    }

    if(action==="remove_mission"){
      const eventId=String(body.eventId??"");
      const localDateValue=String(body.localDate??"");
      const {error}=await admin.from("stamp_event_daily_missions")
        .delete()
        .eq("event_id",eventId)
        .eq("local_date",localDateValue);
      if(error) throw error;
      return json(await listData(admin,actorUserId,true));
    }

    return json({error:"unknown action"},400);
  }catch(error){
    const message=error instanceof Error?error.message:String(error);
    return json({error:message},400);
  }
});
