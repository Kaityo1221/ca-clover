import {createClient} from "npm:@supabase/supabase-js@2";

const CRON_HEADER="x-ca-clover-cron-secret";
const SOURCE="minpoke_event_ical";
const SOURCE_URL="https://9db.jp/pokemongo/data/17299";

const corsHeaders={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type, x-ca-clover-cron-secret",
};

function errorMessage(error:unknown){
  if(error instanceof Error) return error.message;
  if(error&&typeof error==="object"&&"message" in error){
    return String((error as {message?:unknown}).message??"Unknown error");
  }
  return String(error);
}

function json(data:unknown,status=200){
  return new Response(JSON.stringify(data),{
    status,
    headers:{...corsHeaders,"content-type":"application/json"},
  });
}

function unfold(value:string){
  return value.replace(/\r?\n[ \t]/g,"");
}

function unescapeIcal(value:string){
  return value
    .replace(/\\n/gi,"\n")
    .replace(/\\,/g,",")
    .replace(/\\;/g,";")
    .replace(/\\\\/g,"\\")
    .trim();
}

function parseProperty(line:string){
  const colon=line.indexOf(":");
  if(colon<0) return null;
  const head=line.slice(0,colon);
  const value=line.slice(colon+1);
  const parts=head.split(";");
  const name=(parts.shift()??"").toUpperCase();
  const params:Record<string,string>={};
  for(const part of parts){
    const eq=part.indexOf("=");
    if(eq>0) params[part.slice(0,eq).toUpperCase()]=part.slice(eq+1);
  }
  return {name,params,value};
}

function toIsoDate(raw:string,params:Record<string,string>){
  const value=raw.trim();
  const allDay=params.VALUE==="DATE"||/^\d{8}$/.test(value);

  if(allDay){
    const match=value.match(/^(\d{4})(\d{2})(\d{2})$/);
    if(!match) return null;
    const [,y,m,d]=match;
    return {iso:`${y}-${m}-${d}T00:00:00+09:00`,allDay:true};
  }

  const match=value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if(!match) return null;
  const [,y,m,d,hh,mm,ss,z]=match;
  const iso=z
    ?`${y}-${m}-${d}T${hh}:${mm}:${ss}Z`
    :`${y}-${m}-${d}T${hh}:${mm}:${ss}+09:00`;
  return {iso,allDay:false};
}

type ParsedEvent={
  source_key:string;
  uid:string;
  event_name:string;
  starts_at:string;
  ends_at:string;
  is_all_day:boolean;
  duration_minutes:number;
  watch_window_eligible:boolean;
};

function parseCalendar(text:string,maxWindowMinutes:number){
  const lines=unfold(text).split(/\r?\n/);
  const events:ParsedEvent[]=[];
  let current:Record<string,{value:string;params:Record<string,string>}>|null=null;

  for(const rawLine of lines){
    const line=rawLine.trimEnd();
    if(line==="BEGIN:VEVENT"){
      current={};
      continue;
    }
    if(line==="END:VEVENT"){
      if(!current) continue;
      const summary=current.SUMMARY?.value?unescapeIcal(current.SUMMARY.value):"";
      const uid=current.UID?.value?unescapeIcal(current.UID.value):"";
      const startRaw=current.DTSTART;
      const endRaw=current.DTEND;
      if(summary&&startRaw&&endRaw){
        const start=toIsoDate(startRaw.value,startRaw.params);
        const end=toIsoDate(endRaw.value,endRaw.params);
        if(start&&end){
          const startMs=Date.parse(start.iso);
          const endMs=Date.parse(end.iso);
          if(Number.isFinite(startMs)&&Number.isFinite(endMs)&&endMs>startMs){
            const duration=Math.round((endMs-startMs)/60000);
            const startIso=new Date(startMs).toISOString();
            const sourceKey=(uid||summary)+"::"+startIso;
            events.push({
              source_key:sourceKey,
              uid,
              event_name:summary,
              starts_at:startIso,
              ends_at:new Date(endMs).toISOString(),
              is_all_day:start.allDay||end.allDay,
              duration_minutes:duration,
              watch_window_eligible:duration>0&&duration<=maxWindowMinutes,
            });
          }
        }
      }
      current=null;
      continue;
    }
    if(!current) continue;
    const property=parseProperty(line);
    if(!property) continue;
    if(["UID","SUMMARY","DTSTART","DTEND"].includes(property.name)){
      current[property.name]={value:property.value,params:property.params};
    }
  }
  return events;
}

async function authorize(
  req:Request,
  supabaseUrl:string,
  anonKey:string,
  admin:ReturnType<typeof createClient>,
){
  const supplied=req.headers.get(CRON_HEADER)??"";
  const {data:expected}=await admin.rpc("internal_get_sync_cron_secret");
  if(typeof expected==="string"&&expected&&supplied===expected) return true;

  const authorization=req.headers.get("Authorization")??"";
  if(!authorization) return false;
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

    const admin=createClient(supabaseUrl,serviceRoleKey,{auth:{persistSession:false,autoRefreshToken:false}});
    if(!(await authorize(req,supabaseUrl,anonKey,admin))) return json({error:"unauthorized"},401);

    const {data:settings,error:settingsError}=await admin
      .from("watch_settings")
      .select("rule_config")
      .eq("id",1)
      .single();
    if(settingsError) throw settingsError;

    const config=(settings?.rule_config??{}) as Record<string,unknown>;
    const maxWindowMinutes=Math.max(60,Math.min(1440,Number(config.official_max_window_minutes??720)||720));

    const response=await fetch(SOURCE_URL,{
      headers:{
        "accept":"text/calendar,text/plain;q=0.9,*/*;q=0.1",
        "user-agent":"CA Clover Meetup Watch/1.0",
      },
    });
    if(!response.ok) throw new Error("みんポケ iCal HTTP "+response.status);
    const contentType=response.headers.get("content-type")??"";
    const body=await response.text();
    if(!body.includes("BEGIN:VCALENDAR")){
      throw new Error("みんポケ iCal response is not a calendar");
    }

    const parsed=parseCalendar(body,maxWindowMinutes);
    const now=Date.now();
    const lower=now-45*24*60*60*1000;
    const upper=now+240*24*60*60*1000;
    const events=parsed.filter(event=>{
      const start=Date.parse(event.starts_at);
      const end=Date.parse(event.ends_at);
      return end>=lower&&start<=upper;
    });

    const seenAt=new Date().toISOString();
    const entryRows=events.map(event=>({
      source:SOURCE,
      source_key:event.source_key,
      source_url:SOURCE_URL,
      event_name:event.event_name,
      starts_at:event.starts_at,
      ends_at:event.ends_at,
      duration_minutes:event.duration_minutes,
      is_all_day:event.is_all_day,
      watch_window_eligible:event.watch_window_eligible,
      raw_uid:event.uid||null,
      last_seen_at:seenAt,
      updated_at:seenAt,
    }));

    if(entryRows.length){
      const {error:entryError}=await admin
        .from("event_calendar_entries")
        .upsert(entryRows,{onConflict:"source,source_key"});
      if(entryError) throw entryError;
    }

    const sourceKeys=events.map(event=>event.source_key);
    const {data:storedEntries,error:storedError}=sourceKeys.length
      ?await admin
        .from("event_calendar_entries")
        .select("id,source_key,event_name,starts_at,ends_at,watch_window_eligible")
        .eq("source",SOURCE)
        .in("source_key",sourceKeys)
      :{data:[],error:null};
    if(storedError) throw storedError;

    const {data:existingWindows,error:existingError}=await admin
      .from("official_event_windows")
      .select("id,source_key,enabled")
      .eq("source",SOURCE)
      .eq("auto_managed",true);
    if(existingError) throw existingError;
    const windowMap=new Map((existingWindows??[]).map(row=>[String(row.source_key??""),row]));

    let watchWindows=0;
    for(const entry of storedEntries??[]){
      if(entry.watch_window_eligible!==true) continue;
      const existing=windowMap.get(entry.source_key);
      const {error}=await admin.from("official_event_windows").upsert({
        event_name:entry.event_name,
        starts_at:entry.starts_at,
        ends_at:entry.ends_at,
        enabled:existing?.enabled??true,
        notes:"みんポケ イベントiCalから自動同期（参照データ）",
        source:SOURCE,
        source_key:entry.source_key,
        calendar_entry_id:entry.id,
        auto_managed:true,
        updated_at:seenAt,
      },{onConflict:"source,source_key"});
      if(error) throw error;
      watchWindows++;
    }

    const activeKeys=new Set((storedEntries??[])
      .filter(row=>row.watch_window_eligible===true)
      .map(row=>String(row.source_key)));

    for(const existing of existingWindows??[]){
      const key=String(existing.source_key??"");
      if(key&&!activeKeys.has(key)){
        const {error}=await admin
          .from("official_event_windows")
          .delete()
          .eq("id",existing.id);
        if(error) throw error;
      }
    }

    const {error:pruneError}=await admin
      .from("event_calendar_entries")
      .delete()
      .eq("source",SOURCE)
      .lt("ends_at",new Date(now-120*24*60*60*1000).toISOString());
    if(pruneError) throw pruneError;

    await admin.from("sync_automation_state").update({
      last_event_calendar_at:seenAt,
      updated_at:seenAt,
    }).eq("id",1);

    return json({
      ok:true,
      source:SOURCE,
      sourceUrl:SOURCE_URL,
      contentType,
      parsed:parsed.length,
      stored:events.length,
      watchWindows,
      referenceOnly:events.filter(event=>!event.watch_window_eligible).length,
      maxWatchWindowMinutes:maxWindowMinutes,
    });
  }catch(error){
    return json({error:errorMessage(error)},500);
  }
});
