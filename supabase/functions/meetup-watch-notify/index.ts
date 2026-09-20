import {createClient} from "npm:@supabase/supabase-js@2";

const CRON_HEADER="x-ca-clover-cron-secret";
const WEBHOOK_SECRET="DISCORD_MEETUP_WATCH_WEBHOOK_URL";
const MAX_ATTEMPTS=3;
const SEND_GAP_MS=750;

const corsHeaders={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type, x-ca-clover-cron-secret",
};

function json(data:unknown,status=200){
  return new Response(JSON.stringify(data),{
    status,
    headers:{...corsHeaders,"content-type":"application/json"},
  });
}

const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));

function fmt(value:unknown){
  if(typeof value!=="string"||!value) return "—";
  const date=new Date(value);
  if(!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ja-JP",{
    timeZone:"Asia/Tokyo",
    month:"numeric",
    day:"numeric",
    hour:"2-digit",
    minute:"2-digit",
  }).format(date);
}

function durationMinutes(payload:Record<string,unknown>){
  const start=typeof payload.starts_at==="string"?Date.parse(payload.starts_at):NaN;
  const end=typeof payload.ends_at==="string"?Date.parse(payload.ends_at):NaN;
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<start) return null;
  return Math.round((end-start)/60000);
}

function webhookWithWait(raw:string){
  const url=new URL(raw);
  url.searchParams.set("wait","true");
  return url.toString();
}

function humanReasonLines(payload:Record<string,unknown>){
  const flags=Array.isArray(payload.flags)?payload.flags.map(String):[];
  const detected=Array.isArray(payload.detected_terms)
    ?payload.detected_terms.map(String).filter(Boolean)
    :[];

  const lines:string[]=[];
  for(const term of detected) lines.push("🔴 「"+term+"」を検知");

  const add=(value:string)=>{
    if(value&&!lines.includes(value)) lines.push(value);
  };

  if(flags.includes("TIME_VERY_SHORT")) add("🔥 開催時間30分以下");
  else if(flags.includes("TIME_SHORT")) add("⏱️ 開催時間60分以下");
  if(flags.includes("REPEAT_SAME_DAY")) add("⚠️ 同日に短時間Meetupを複数検知");
  if(flags.includes("REPEAT_CLOSE")) add("⚠️ 前Meetup終了から30分以内に次のMeetup");
  if(flags.includes("CREATED_LAST_MINUTE")) add("⚠️ 開始10分以内に作成");
  if(flags.includes("OFFICIAL_TIME_OUTSIDE")) add("⚠️ 公式イベント終了後の時間外開催");
  if(flags.includes("LOW_CHECKIN")) add("⚠️ Meetup終了後のCheck-inが0〜1名");
  if(flags.includes("LOW_CHECKIN_REPEAT")) add("⚠️ 30日以内に少人数Check-inを反復");
  if(flags.includes("HOST_ABSENT_TEXT")&&!detected.length) add("🔴 主催者不在を示す表現を検知");
  if(flags.includes("NON_FACE_TO_FACE")&&!detected.length) add("🔴 来場不要・非対面を示す表現を検知");
  if(flags.includes("PARTICIPATION_RESTRICTED")&&!detected.length) add("🔴 一般参加制限を示す表現を検知");
  if(flags.includes("REWARD_ONLY")&&!detected.length) add("🔴 報酬・リワード目的を示す表現を検知");
  if(flags.includes("TITLE_STRONG")&&!detected.length) add("🔴 強い確認対象表現を検知");
  if(flags.includes("CHECKIN_ONLY")&&!detected.length) add("⚠️ チェックインのみを示す表現を検知");
  if(flags.includes("FREE_CHECKIN_TEXT")&&!detected.length) add("⚠️ フリーチェックインを示す表現を検知");

  if(lines.length===0){
    const reasons=Array.isArray(payload.reasons)?payload.reasons.map(String):[];
    for(const reason of reasons.slice(0,4)) add("⚠️ "+reason);
  }
  return lines.slice(0,6);
}

async function sendDiscord(webhook:string,body:Record<string,unknown>){
  const response=await fetch(webhookWithWait(webhook),{
    method:"POST",
    headers:{"content-type":"application/json"},
    body:JSON.stringify(body),
  });
  const text=await response.text();
  if(!response.ok){
    let detail="Discord HTTP "+response.status;
    try{
      const parsed=JSON.parse(text);
      if(parsed?.message) detail+=": "+String(parsed.message).slice(0,160);
    }catch{
      // Never include webhook URL or arbitrary long response bodies in logs.
    }
    throw new Error(detail);
  }
  try{
    const parsed=JSON.parse(text);
    return typeof parsed?.id==="string"?parsed.id:null;
  }catch{
    return null;
  }
}

async function requireAdmin(
  req:Request,
  supabaseUrl:string,
  anonKey:string,
){
  const authorization=req.headers.get("Authorization")??"";
  const userClient=createClient(supabaseUrl,anonKey,{
    global:{headers:{Authorization:authorization}},
    auth:{persistSession:false},
  });
  const {data:userData,error:userError}=await userClient.auth.getUser();
  if(userError||!userData.user) return false;
  const {data:profile,error:profileError}=await userClient
    .from("profiles")
    .select("role")
    .eq("id",userData.user.id)
    .single();
  return !profileError&&profile?.role==="admin";
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders});

  try{
    const supabaseUrl=Deno.env.get("SUPABASE_URL");
    const anonKey=Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if(!supabaseUrl||!anonKey||!serviceRoleKey){
      return json({error:"Supabase environment is incomplete"},500);
    }

    const body=await req.json().catch(()=>({}));
    const action=typeof body.action==="string"?body.action:"process";
    const webhook=Deno.env.get(WEBHOOK_SECRET)?.trim()??"";

    if(action==="test"){
      const adminOk=await requireAdmin(req,supabaseUrl,anonKey);
      if(!adminOk) return json({error:"admin required"},403);
      if(!webhook) return json({error:WEBHOOK_SECRET+" is not configured"},409);

      const messageId=await sendDiscord(webhook,{
        content:"🍀 CA Clover Meetup Watch\n\nDiscord通知テストです。\nこのメッセージが表示されればWebhook接続は正常です。",
        allowed_mentions:{parse:[]},
      });
      return json({ok:true,status:"test_sent",message_id:messageId});
    }

    const admin=createClient(supabaseUrl,serviceRoleKey,{auth:{persistSession:false,autoRefreshToken:false}});
    const supplied=req.headers.get(CRON_HEADER)??"";
    const {data:expected,error:secretError}=await admin.rpc("internal_get_sync_cron_secret");
    if(secretError||typeof expected!=="string"||!expected||supplied!==expected){
      return json({error:"unauthorized"},401);
    }

    const {data:settings,error:settingsError}=await admin
      .from("watch_settings")
      .select("discord_enabled")
      .eq("id",1)
      .single();
    if(settingsError) throw settingsError;
    if(settings?.discord_enabled!==true) return json({ok:true,status:"disabled",sent:0});
    if(!webhook) return json({ok:true,status:"unconfigured",sent:0});

    const {data:queue,error:queueError}=await admin
      .from("meetup_watch_notifications")
      .select("id,case_id,payload,retry_count,next_retry_at,notification_type")
      .eq("channel","discord")
      .eq("status","queued")
      .order("created_at")
      .limit(10);
    if(queueError) throw queueError;

    const now=Date.now();
    const due=(queue??[])
      .filter(item=>!item.next_retry_at||Date.parse(item.next_retry_at)<=now)
      .slice(0,3);

    let sent=0;
    let skipped=0;
    let failed=0;
    let deferred=0;

    for(let index=0;index<due.length;index++){
      if(index>0) await sleep(SEND_GAP_MS);
      const item=due[index];

      const {data:watchCase}=await admin
        .from("meetup_watch_cases")
        .select("discord_candidate,score")
        .eq("id",item.case_id)
        .maybeSingle();

      if(watchCase?.discord_candidate!==true){
        await admin.from("meetup_watch_notifications").update({
          status:"skipped",
          last_error:"Case no longer qualifies for Discord",
          error_message:"Case no longer qualifies for Discord",
          last_attempt_at:new Date().toISOString(),
        }).eq("id",item.id);
        skipped++;
        continue;
      }

      const payload=(item.payload??{}) as Record<string,unknown>;
      let communityName="Community";
      if(typeof payload.community_id==="string"){
        const {data:community}=await admin
          .from("communities")
          .select("name")
          .eq("id",payload.community_id)
          .maybeSingle();
        if(community?.name) communityName=community.name;
      }

      const meetupId=String(payload.meetup_id??"");
      const detailsUrl="https://ca-clover.vercel.app/admin/meetup-watch/"+encodeURIComponent(meetupId);
      const campfireUrl=typeof payload.event_url==="string"?payload.event_url:"";
      const minutes=durationMinutes(payload);
      const reasonLines=humanReasonLines(payload);
      const isUpdate=item.notification_type==="update"||payload.notification_type==="update";
      const title=isUpdate
        ?"🔄 CA Clover / 要確認Meetup 更新"
        :"🔍 CA Clover / 要確認Meetup";

      const embed={
        title,
        color:0xf59e0b,
        fields:[
          {name:"🟠 確認優先度",value:"高 / "+String(payload.score??watchCase?.score??0)+"点",inline:false},
          {name:"🏕️ Community",value:communityName||"—",inline:false},
          {name:"📛 Meetup",value:String(payload.meetup_title??"—").slice(0,1024),inline:false},
          {
            name:"🕐 開催日時",
            value:fmt(payload.starts_at)+"〜"+fmt(payload.ends_at)+(minutes===null?"":"（"+minutes+"分）"),
            inline:false,
          },
          {
            name:"👥 RSVP / Check-in",
            value:"RSVP "+String(payload.rsvp_count??"—")+" / Check-in "+String(payload.checkin_count??"—"),
            inline:false,
          },
          {
            name:"⚠️ 検知理由",
            value:(reasonLines.length?reasonLines:["確認条件を検知"]).join("\n").slice(0,1024),
            inline:false,
          },
          {
            name:"🔗 確認",
            value:"[CA Cloverで確認]("+detailsUrl+")"+(campfireUrl?"\n[Campfireで確認]("+campfireUrl+")":""),
            inline:false,
          },
        ],
        footer:{text:"通知は不正認定ではありません。最終判断はADMIN・コミュニティチームが行います。"},
      };

      try{
        const messageId=await sendDiscord(webhook,{
          embeds:[embed],
          allowed_mentions:{parse:[]},
        });
        await admin.from("meetup_watch_notifications").update({
          status:"sent",
          sent_at:new Date().toISOString(),
          discord_message_id:messageId,
          last_attempt_at:new Date().toISOString(),
          next_retry_at:null,
          last_error:null,
          error_message:null,
        }).eq("id",item.id);
        sent++;
      }catch(error){
        const message=error instanceof Error?error.message:String(error);
        const retryCount=Math.max(0,Number(item.retry_count??0))+1;
        const exhausted=retryCount>=MAX_ATTEMPTS;
        const delayMs=retryCount===1?30_000:retryCount===2?180_000:0;
        await admin.from("meetup_watch_notifications").update({
          status:exhausted?"failed":"queued",
          retry_count:retryCount,
          next_retry_at:exhausted?null:new Date(Date.now()+delayMs).toISOString(),
          last_attempt_at:new Date().toISOString(),
          last_error:message.slice(0,500),
          error_message:message.slice(0,500),
        }).eq("id",item.id);
        if(exhausted) failed++;
        else deferred++;
      }
    }

    return json({ok:true,status:"processed",sent,skipped,failed,deferred});
  }catch(error){
    return json({error:error instanceof Error?error.message:String(error)},500);
  }
});
