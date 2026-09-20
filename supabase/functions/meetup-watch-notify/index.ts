import {createClient} from "npm:@supabase/supabase-js@2";

const CRON_HEADER="x-ca-clover-cron-secret";

function json(data:unknown,status=200){
  return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json"}});
}

function fmt(value:unknown){
  if(typeof value!=="string"||!value) return "—";
  const date=new Date(value);
  return Number.isFinite(date.getTime())?date.toLocaleString("ja-JP",{timeZone:"Asia/Tokyo"}):"—";
}

function duration(payload:Record<string,unknown>){
  const start=typeof payload.starts_at==="string"?Date.parse(payload.starts_at):NaN;
  const end=typeof payload.ends_at==="string"?Date.parse(payload.ends_at):NaN;
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<start) return "—";
  return Math.round((end-start)/60000)+"分";
}

Deno.serve(async(req:Request)=>{
  try{
    const supabaseUrl=Deno.env.get("SUPABASE_URL");
    const serviceRoleKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if(!supabaseUrl||!serviceRoleKey) return json({error:"Supabase environment is incomplete"},500);
    const admin=createClient(supabaseUrl,serviceRoleKey,{auth:{persistSession:false,autoRefreshToken:false}});

    const supplied=req.headers.get(CRON_HEADER)??"";
    const {data:expected,error:secretError}=await admin.rpc("internal_get_sync_cron_secret");
    if(secretError||typeof expected!=="string"||!expected||supplied!==expected) return json({error:"unauthorized"},401);

    const {data:settings,error:settingsError}=await admin
      .from("watch_settings")
      .select("discord_enabled")
      .eq("id",1)
      .single();
    if(settingsError) throw settingsError;
    if(settings?.discord_enabled!==true) return json({ok:true,status:"disabled",sent:0});

    const {data:webhook,error:webhookError}=await admin.rpc("internal_get_meetup_watch_discord_webhook");
    if(webhookError) throw webhookError;
    if(typeof webhook!=="string"||!webhook.trim()) return json({ok:true,status:"unconfigured",sent:0});

    const {data:queue,error:queueError}=await admin
      .from("meetup_watch_notifications")
      .select("id,case_id,payload")
      .eq("channel","discord")
      .eq("status","queued")
      .order("created_at")
      .limit(10);
    if(queueError) throw queueError;

    let sent=0;
    let skipped=0;
    let failed=0;

    for(const item of queue??[]){
      const {data:watchCase}=await admin
        .from("meetup_watch_cases")
        .select("discord_candidate,score")
        .eq("id",item.case_id)
        .maybeSingle();
      if(watchCase?.discord_candidate!==true){
        await admin.from("meetup_watch_notifications").update({
          status:"skipped",
          last_error:"Case no longer qualifies for Discord",
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

      const reasons=Array.isArray(payload.reasons)?payload.reasons.map(String).slice(0,4):[];
      const flags=Array.isArray(payload.flags)?payload.flags.map(String):[];
      const caseId=String(payload.case_id??item.case_id??"");
      const detailsUrl="https://ca-clover.vercel.app/admin/meetup-watch#case-"+caseId;
      const campfireUrl=typeof payload.event_url==="string"?payload.event_url:"";
      const content=[
        "🔍 CA Clover / 要確認Meetup",
        "",
        "🏕️ Community："+communityName,
        "📛 Meetup："+String(payload.meetup_title??"—"),
        "🕐 "+fmt(payload.starts_at)+" 〜 "+fmt(payload.ends_at)+"（"+duration(payload)+"）",
        "",
        ...reasons.map(reason=>"⚠️ "+reason),
        flags.length?"Flags: "+flags.join(" / "):"",
        "",
        "RSVP "+String(payload.rsvp_count??"—")+" / Check-in "+String(payload.checkin_count??"—"),
        "確認優先度 "+String(payload.score??watchCase?.score??0)+"点",
        "",
        "CA Clover："+detailsUrl,
        campfireUrl?"Campfire："+campfireUrl:"",
      ].filter(Boolean).join("\n").slice(0,1950);

      try{
        const response=await fetch(webhook,{
          method:"POST",
          headers:{"content-type":"application/json"},
          body:JSON.stringify({content}),
        });
        if(!response.ok) throw new Error("Discord HTTP "+response.status);
        await admin.from("meetup_watch_notifications").update({
          status:"sent",
          sent_at:new Date().toISOString(),
          last_error:null,
        }).eq("id",item.id);
        sent++;
      }catch(error){
        await admin.from("meetup_watch_notifications").update({
          status:"failed",
          last_error:error instanceof Error?error.message:String(error),
        }).eq("id",item.id);
        failed++;
      }
    }

    return json({ok:true,status:"processed",sent,skipped,failed});
  }catch(error){
    return json({error:error instanceof Error?error.message:String(error)},500);
  }
});
