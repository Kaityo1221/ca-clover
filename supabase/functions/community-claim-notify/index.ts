import {createClient} from "npm:@supabase/supabase-js@2";

const CRON_HEADER="x-ca-clover-cron-secret";
const WEBHOOK_SECRET="DISCORD_COMMUNITY_CLAIM_WEBHOOK_URL";
const MAX_ATTEMPTS=3;
const SEND_GAP_MS=700;

const corsHeaders={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type, x-ca-clover-cron-secret",
};

function json(data:unknown,status=200){
  return new Response(JSON.stringify(data),{
    status,
    headers:{...corsHeaders,"Content-Type":"application/json"},
  });
}

const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));

function webhookWithWait(raw:string){
  const url=new URL(raw);
  url.searchParams.set("wait","true");
  return url.toString();
}

async function sendDiscord(webhook:string,body:Record<string,unknown>){
  const response=await fetch(webhookWithWait(webhook),{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify(body),
  });
  const text=await response.text();
  if(!response.ok) throw new Error("Discord HTTP "+response.status);
  try{
    const parsed=JSON.parse(text);
    return typeof parsed?.id==="string"?parsed.id:null;
  }catch{
    return null;
  }
}

function fmt(value:unknown){
  if(typeof value!=="string"||!value) return "—";
  const date=new Date(value);
  if(!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ja-JP",{
    timeZone:"Asia/Tokyo",
    year:"numeric",
    month:"numeric",
    day:"numeric",
    hour:"2-digit",
    minute:"2-digit",
  }).format(date);
}

function verificationSummary(request:Record<string,unknown>){
  const source=String(request.request_source??"meetup_share");
  if(request.ca_map_status==="matched"){
    return [
      "日本CA地図: 一致",
      request.ca_level_snapshot?"担当: "+String(request.ca_level_snapshot):null,
      request.creator_username_matches_profile===true?"Niantic ID一致":null,
    ].filter(Boolean).join(" / ");
  }
  if(source==="meetup_share"&&request.ca_map_status==="not_listed"){
    return [
      request.creator_ca_badge_verified===true?"紫CAバッジ確認":null,
      request.creator_username_matches_profile===true?"Niantic ID一致":null,
      request.is_ca_meetup===true?"CA Meetup確認":null,
      "日本CA地図: 未掲載",
    ].filter(Boolean).join(" / ");
  }
  return "ADMIN確認";
}

async function requireAdmin(req:Request,supabaseUrl:string,anonKey:string){
  const authorization=req.headers.get("Authorization")??"";
  const userClient=createClient(supabaseUrl,anonKey,{
    global:{headers:{Authorization:authorization}},
    auth:{persistSession:false},
  });
  const {data:userData,error:userError}=await userClient.auth.getUser();
  if(userError||!userData.user) return false;
  const {data:profile,error:profileError}=await userClient
    .from("profiles").select("role").eq("id",userData.user.id).single();
  return !profileError&&profile?.role==="admin";
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders});

  try{
    const supabaseUrl=Deno.env.get("SUPABASE_URL");
    const anonKey=Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if(!supabaseUrl||!anonKey||!serviceRoleKey) return json({error:"Supabase environment is incomplete"},500);

    const body=await req.json().catch(()=>({}));
    const action=typeof body.action==="string"?body.action:"process";
    const webhook=Deno.env.get(WEBHOOK_SECRET)?.trim()??"";
    const admin=createClient(supabaseUrl,serviceRoleKey,{auth:{persistSession:false,autoRefreshToken:false}});

    if(action==="test"){
      const adminOk=await requireAdmin(req,supabaseUrl,anonKey);
      if(!adminOk) return json({error:"admin required"},403);
      if(!webhook) return json({error:WEBHOOK_SECRET+" is not configured"},409);
      const messageId=await sendDiscord(webhook,{
        content:"🍀 CA Clover 申請通知\n\nDiscord通知テストです。",
        allowed_mentions:{parse:[]},
      });
      return json({ok:true,status:"test_sent",message_id:messageId});
    }

    const supplied=req.headers.get(CRON_HEADER)??"";
    const {data:expected,error:secretError}=await admin.rpc("internal_get_sync_cron_secret");
    if(secretError||typeof expected!=="string"||!expected||supplied!==expected){
      return json({error:"unauthorized"},401);
    }
    if(!webhook) return json({ok:true,status:"unconfigured",sent:0});

    const {data:queue,error:queueError}=await admin
      .from("community_claim_notifications")
      .select("id,request_id,retry_count,next_retry_at")
      .eq("status","queued")
      .order("created_at")
      .limit(10);
    if(queueError) throw queueError;

    const now=Date.now();
    const due=(queue??[])
      .filter(item=>!item.next_retry_at||Date.parse(item.next_retry_at)<=now)
      .slice(0,3);

    let sent=0;
    let failed=0;
    let deferred=0;

    for(let index=0;index<due.length;index++){
      if(index>0) await sleep(SEND_GAP_MS);
      const item=due[index];
      const {data:request,error:requestError}=await admin
        .from("community_access_requests")
        .select("*")
        .eq("id",item.request_id)
        .single();
      if(requestError||!request){
        await admin.from("community_claim_notifications").update({
          status:"failed",
          last_error:"request not found",
          last_attempt_at:new Date().toISOString(),
        }).eq("id",item.id);
        failed++;
        continue;
      }

      const {data:requester}=await admin
        .from("profiles")
        .select("niantic_id")
        .eq("id",request.user_id)
        .maybeSingle();

      const source=String(request.request_source??"meetup_share");
      const method=source==="community_invite"?"Community招待URL":"本人主催Meetup";
      const reviewUrl="https://kaityo1221.github.io/ca-clover/admin.html#claims";
      const campfireUrl=String(request.input_url??request.meetup_url??"").trim();
      const embed={
        title:"🛎️ CA Clover / 新しいCommunity申請",
        color:0x84cc16,
        fields:[
          {name:"🏕️ Community",value:String(request.community_name_snapshot??"—")+(request.community_prefecture_snapshot?" / "+String(request.community_prefecture_snapshot):""),inline:false},
          {name:"👤 Niantic ID",value:String(requester?.niantic_id??request.niantic_id_snapshot??"—"),inline:false},
          {name:"🔗 申請方法",value:method,inline:false},
          {name:"✅ CA確認",value:verificationSummary(request),inline:false},
          {name:"🕐 申請日時",value:fmt(request.requested_at),inline:false},
          {
            name:"確認リンク",
            value:"[🔗 CA Cloverで審査]("+reviewUrl+")"+(campfireUrl?"\n[🔗 Campfireで確認]("+campfireUrl+")":""),
            inline:false,
          },
        ],
        footer:{text:"Community申請が届きました。最終承認はADMINが行います。"},
      };

      try{
        const messageId=await sendDiscord(webhook,{embeds:[embed],allowed_mentions:{parse:[]}});
        await admin.from("community_claim_notifications").update({
          status:"sent",
          sent_at:new Date().toISOString(),
          discord_message_id:messageId,
          last_attempt_at:new Date().toISOString(),
          next_retry_at:null,
          last_error:null,
        }).eq("id",item.id);
        sent++;
      }catch(error){
        const retryCount=Math.max(0,Number(item.retry_count??0))+1;
        const exhausted=retryCount>=MAX_ATTEMPTS;
        const delayMs=retryCount===1?30_000:retryCount===2?180_000:0;
        await admin.from("community_claim_notifications").update({
          status:exhausted?"failed":"queued",
          retry_count:retryCount,
          next_retry_at:exhausted?null:new Date(Date.now()+delayMs).toISOString(),
          last_attempt_at:new Date().toISOString(),
          last_error:(error instanceof Error?error.message:String(error)).slice(0,500),
        }).eq("id",item.id);
        if(exhausted) failed++;
        else deferred++;
      }
    }

    return json({ok:true,status:"processed",sent,failed,deferred});
  }catch(error){
    return json({error:error instanceof Error?error.message:String(error)},500);
  }
});
