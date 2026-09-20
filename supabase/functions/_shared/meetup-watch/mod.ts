import type {SupabaseClient} from "npm:@supabase/supabase-js@2";
import {buildMeetupHashes,type MeetupHashInput} from "./hash.ts";
import {
  durationMinutes,
  evaluateActivity,
  evaluateStructure,
  summarizeFindings,
  type FindingDraft,
  type OfficialEventWindow,
  type RelatedMeetup,
  type WatchMeetup,
  type WatchSettings,
  type WatchTerm,
} from "./evaluate.ts";

export type MeetupWriteRow=MeetupHashInput&{
  campfire_meetup_id:string;
  community_id:string;
  title:string;
  starts_at:string|null;
  ends_at:string|null;
  location:string|null;
  event_url:string|null;
  details:string|null;
  campfire_created_at:string|null;
  is_ca_meetup:boolean|null;
  rsvp_count:number|null;
  checkin_count:number|null;
  accepted_count:number|null;
  declined_count:number|null;
  campfire_live_event_name:string|null;
  source:string;
  fetched_at:string;
};

type ExistingRow={
  id:string;
  campfire_meetup_id:string;
  structure_hash:string|null;
  activity_hash:string|null;
};

type CaseRow={
  id:string;
  meetup_id:string;
  status:string;
  flags:string[]|null;
};

const chunk=<T>(items:T[],size:number)=>{
  const result:T[][]=[];
  for(let index=0;index<items.length;index+=size) result.push(items.slice(index,index+size));
  return result;
};

function normalizeEventName(value:string|null|undefined){
  return String(value??"").normalize("NFKC").trim().toLowerCase().replace(/\s+/g," ");
}

async function loadExisting(admin:SupabaseClient,ids:string[]){
  const rows:ExistingRow[]=[];
  for(const part of chunk(ids,200)){
    const {data,error}=await admin
      .from("meetups")
      .select("id,campfire_meetup_id,structure_hash,activity_hash")
      .in("campfire_meetup_id",part);
    if(error) throw error;
    rows.push(...((data as ExistingRow[]|null)??[]));
  }
  return rows;
}

async function loadChangedMeetups(admin:SupabaseClient,ids:string[]){
  const rows:WatchMeetup[]=[];
  for(const part of chunk(ids,200)){
    const {data,error}=await admin
      .from("meetups")
      .select("id,campfire_meetup_id,community_id,title,details,starts_at,ends_at,location,event_url,campfire_created_at,is_ca_meetup,rsvp_count,checkin_count,campfire_live_event_name")
      .in("campfire_meetup_id",part);
    if(error) throw error;
    rows.push(...((data as WatchMeetup[]|null)??[]));
  }
  return rows;
}

async function loadRelated(
  admin:SupabaseClient,
  row:WatchMeetup,
  cache:Map<string,RelatedMeetup[]>,
){
  if(!row.community_id||!row.starts_at) return [];
  const start=Date.parse(row.starts_at);
  if(!Number.isFinite(start)) return [];
  const key=row.community_id+":"+new Date(start).toISOString().slice(0,10);
  const cached=cache.get(key);
  if(cached) return cached;

  const from=new Date(start-30*24*60*60*1000).toISOString();
  const to=new Date(start+24*60*60*1000).toISOString();
  const {data,error}=await admin
    .from("meetups")
    .select("id,starts_at,ends_at,rsvp_count,checkin_count")
    .eq("community_id",row.community_id)
    .gte("starts_at",from)
    .lte("starts_at",to)
    .order("starts_at");
  if(error) throw error;
  const related=(data as RelatedMeetup[]|null)??[];
  cache.set(key,related);
  return related;
}

async function loadOfficialWindows(admin:SupabaseClient){
  const {data,error}=await admin
    .from("official_event_windows")
    .select("id,event_name,starts_at,ends_at")
    .eq("enabled",true)
    .order("starts_at");
  if(error) throw error;
  return (data as OfficialEventWindow[]|null)??[];
}

function pickOfficialWindow(row:WatchMeetup,windows:OfficialEventWindow[]){
  if(!row.campfire_live_event_name||!row.starts_at) return null;
  const name=normalizeEventName(row.campfire_live_event_name);
  const meetupStart=Date.parse(row.starts_at);
  const candidates=windows
    .filter(window=>normalizeEventName(window.event_name)===name)
    .map(window=>({
      window,
      distance:Math.abs(meetupStart-Date.parse(window.starts_at)),
      near:
        meetupStart>=Date.parse(window.starts_at)-12*60*60*1000 &&
        meetupStart<=Date.parse(window.ends_at)+24*60*60*1000,
    }))
    .filter(item=>item.near)
    .sort((a,b)=>a.distance-b.distance);
  return candidates[0]?.window??null;
}

async function upsertHotState(admin:SupabaseClient,row:WatchMeetup,settings:WatchSettings){
  if(!row.community_id) return;
  const endRaw=row.ends_at??row.starts_at;
  if(!endRaw) return;
  const end=Date.parse(endRaw);
  if(!Number.isFinite(end)) return;
  const hotUntilMs=end+60*60*1000;
  const {data:current,error:currentError}=await admin
    .from("watch_community_state")
    .select("hot_until,hot_reasons")
    .eq("community_id",row.community_id)
    .maybeSingle();
  if(currentError) throw currentError;

  const currentUntil=current?.hot_until?Date.parse(current.hot_until):0;
  const finalUntil=Math.max(hotUntilMs,Number.isFinite(currentUntil)?currentUntil:0);
  const now=Date.now();
  const reasons=[...new Set([...(current?.hot_reasons??[]),"TIME_SHORT"])];
  const {error}=await admin.from("watch_community_state").upsert({
    community_id:row.community_id,
    hot_until:new Date(finalUntil).toISOString(),
    hot_reasons:reasons,
    hot_meetup_id:row.id,
    next_hot_scan_at:finalUntil>now?new Date(now).toISOString():null,
    updated_at:new Date(now).toISOString(),
  },{onConflict:"community_id"});
  if(error) throw error;
}

async function ensureCase(
  admin:SupabaseClient,
  row:WatchMeetup,
  existing:CaseRow|undefined,
  findings:FindingDraft[],
){
  if(existing) return existing;
  if(findings.length===0) return null;
  const {data,error}=await admin.from("meetup_watch_cases").insert({
    meetup_id:row.id,
    community_id:row.community_id,
    status:"unreviewed",
    review_required:false,
    score:0,
    priority:0,
    priority_level:"record",
    high_priority:false,
    discord_candidate:false,
    flags:[],
    last_evaluated_at:new Date().toISOString(),
    updated_at:new Date().toISOString(),
  }).select("id,meetup_id,status,flags").single();
  if(error) throw error;
  return data as CaseRow;
}

async function queueDiscordNotification(
  admin:SupabaseClient,
  row:WatchMeetup,
  caseId:string,
  summary:ReturnType<typeof summarizeFindings>,
  findings:Array<{reason:string;score_weight:number}>,
){
  if(!summary.discordCandidate||summary.notifyFlags.length===0) return;
  const signature=summary.notifyFlags.slice().sort().join(",");
  const dedupeKey=row.id+":"+signature;
  const payload={
    case_id:caseId,
    community_id:row.community_id,
    meetup_id:row.id,
    meetup_title:row.title,
    starts_at:row.starts_at,
    ends_at:row.ends_at,
    rsvp_count:row.rsvp_count,
    checkin_count:row.checkin_count,
    flags:summary.notifyFlags,
    score:summary.score,
    reasons:[...findings]
      .sort((a,b)=>b.score_weight-a.score_weight)
      .map(item=>item.reason)
      .filter((value,index,array)=>array.indexOf(value)===index)
      .slice(0,4),
    event_url:row.event_url,
  };
  const {error}=await admin.from("meetup_watch_notifications").upsert({
    meetup_id:row.id,
    case_id:caseId,
    channel:"discord",
    dedupe_key:dedupeKey,
    status:"queued",
    payload,
  },{onConflict:"dedupe_key",ignoreDuplicates:true});
  if(error) throw error;
}

async function evaluateWatch(
  admin:SupabaseClient,
  changedRows:WatchMeetup[],
  changeKinds:Map<string,"new"|"structure"|"activity">,
){
  const {data:settingsData,error:settingsError}=await admin
    .from("watch_settings")
    .select("enabled,hot_scan_interval_minutes,normal_scan_interval_minutes,watch_lookback_days,rule_version,rule_config")
    .eq("id",1)
    .single();
  if(settingsError) throw settingsError;
  if(settingsData?.enabled!==true) return {evaluated:0,casesTouched:0,notificationsQueued:0};

  const settings:WatchSettings={
    hot_scan_interval_minutes:Number(settingsData.hot_scan_interval_minutes??5),
    normal_scan_interval_minutes:Number(settingsData.normal_scan_interval_minutes??15),
    watch_lookback_days:Number(settingsData.watch_lookback_days??30),
    rule_version:Number(settingsData.rule_version??2),
    rule_config:(settingsData.rule_config??{}) as Record<string,unknown>,
  };

  const [{data:termData,error:termError},windows]=await Promise.all([
    admin
      .from("watch_terms")
      .select("id,phrase,category,severity,flag_code,regex,negative_pattern,rule_version")
      .eq("enabled",true),
    loadOfficialWindows(admin),
  ]);
  if(termError) throw termError;
  const terms=(termData as WatchTerm[]|null)??[];

  const cutoff=Date.now()-Math.max(1,settings.watch_lookback_days)*24*60*60*1000;
  const rows=changedRows.filter(row=>{
    if(!row.starts_at) return true;
    const time=Date.parse(row.starts_at);
    return !Number.isFinite(time)||time>=cutoff;
  });
  if(!rows.length) return {evaluated:0,casesTouched:0,notificationsQueued:0};

  const ids=rows.map(row=>row.id);
  const {data:caseData,error:caseError}=await admin
    .from("meetup_watch_cases")
    .select("id,meetup_id,status,flags")
    .in("meetup_id",ids);
  if(caseError) throw caseError;
  const caseMap=new Map(((caseData as CaseRow[]|null)??[]).map(row=>[row.meetup_id,row]));
  const relatedCache=new Map<string,RelatedMeetup[]>();
  let casesTouched=0;
  let notificationsQueued=0;

  for(const row of rows){
    const kind=changeKinds.get(row.campfire_meetup_id);
    if(!kind) continue;
    const related=await loadRelated(admin,row,relatedCache);
    const officialWindow=pickOfficialWindow(row,windows);
    const findings:FindingDraft[]=[];
    const sourceClasses:string[]=[];

    // HOT is a scan-frequency state, not a violation flag.
    // Keep it independent from official-event suppression rules.
    if((kind==="new"||kind==="structure") && (durationMinutes(row)??Infinity)<=60){
      await upsertHotState(admin,row,settings);
    }

    if(kind==="new"||kind==="structure"){
      findings.push(...evaluateStructure(row,terms,related,settings,officialWindow));
      sourceClasses.push("structure","repeat");
    }
    if(kind==="new"||kind==="structure"||kind==="activity"){
      findings.push(...evaluateActivity(row,related,settings,officialWindow));
      sourceClasses.push("activity");
    }

    const currentCase=await ensureCase(admin,row,caseMap.get(row.id),findings);
    if(!currentCase) continue;
    caseMap.set(row.id,currentCase);

    if(sourceClasses.length){
      const {error:deactivateError}=await admin
        .from("meetup_watch_findings")
        .update({active:false,last_detected_at:new Date().toISOString()})
        .eq("meetup_id",row.id)
        .in("source_class",[...new Set(sourceClasses)]);
      if(deactivateError) throw deactivateError;
    }

    if(findings.length){
      const nowIso=new Date().toISOString();
      const records=findings.map(item=>({
        meetup_id:row.id,
        case_id:currentCase.id,
        watch_term_id:item.watch_term_id,
        finding_key:item.finding_key,
        flag_code:item.flag_code,
        category:item.category,
        severity:item.severity,
        score_weight:item.score_weight,
        reason:item.reason,
        matched_field:item.matched_field,
        matched_text:item.matched_text,
        match_start:item.match_start,
        match_end:item.match_end,
        source_class:item.source_class,
        active:true,
        rule_version:item.rule_version,
        last_detected_at:nowIso,
      }));
      const {error:findingError}=await admin
        .from("meetup_watch_findings")
        .upsert(records,{onConflict:"meetup_id,finding_key"});
      if(findingError) throw findingError;
    }

    const {data:activeData,error:activeError}=await admin
      .from("meetup_watch_findings")
      .select("flag_code,severity,score_weight,reason")
      .eq("meetup_id",row.id)
      .eq("active",true);
    if(activeError) throw activeError;
    const activeFindings=(activeData??[]) as Array<{
      flag_code:string;
      severity:number;
      score_weight:number;
      reason:string;
    }>;
    const summary=summarizeFindings(activeFindings);

    const oldFlags=(currentCase.flags??[]).slice().sort().join("|");
    const newFlags=summary.flags.join("|");
    const shouldReopen=
      summary.reviewRequired &&
      oldFlags!==newFlags &&
      ["no_issue","completed"].includes(currentCase.status);

    const nowIso=new Date().toISOString();
    const {error:updateCaseError}=await admin
      .from("meetup_watch_cases")
      .update({
        community_id:row.community_id,
        status:shouldReopen?"unreviewed":currentCase.status,
        review_required:summary.reviewRequired,
        score:summary.score,
        priority:summary.priority,
        priority_level:summary.priorityLevel,
        high_priority:summary.highPriority,
        discord_candidate:summary.discordCandidate,
        is_hot_trigger:summary.isHotTrigger,
        flags:summary.flags,
        reason_summary:summary.reasonSummary,
        last_evaluated_at:nowIso,
        updated_at:nowIso,
      })
      .eq("id",currentCase.id);
    if(updateCaseError) throw updateCaseError;

    currentCase.flags=summary.flags;
    if(shouldReopen) currentCase.status="unreviewed";


    if(summary.discordCandidate){
      await queueDiscordNotification(admin,row,currentCase.id,summary,activeFindings);
      notificationsQueued++;
    }
    casesTouched++;
  }

  return {evaluated:rows.length,casesTouched,notificationsQueued};
}

export async function processMeetupRows(admin:SupabaseClient,rows:MeetupWriteRow[]){
  if(!rows.length){
    return {
      fetched:0,written:0,newEvents:0,structureUpdates:0,activityUpdates:0,
      unchanged:0,touchedCommunityIds:[] as string[],watchEvaluated:0,watchCasesTouched:0,
      notificationsQueued:0,watchError:null as string|null,
    };
  }

  const hashed=await Promise.all(rows.map(async row=>({
    ...row,
    ...(await buildMeetupHashes(row)),
  })));
  const existing=await loadExisting(admin,hashed.map(row=>row.campfire_meetup_id));
  const existingMap=new Map(existing.map(row=>[row.campfire_meetup_id,row]));

  const newRows=hashed.filter(row=>!existingMap.has(row.campfire_meetup_id));
  const structureRows=hashed.filter(row=>{
    const old=existingMap.get(row.campfire_meetup_id);
    return Boolean(old)&&old?.structure_hash!==row.structure_hash;
  });
  const activityRows=hashed.filter(row=>{
    const old=existingMap.get(row.campfire_meetup_id);
    return Boolean(old)&&old?.structure_hash===row.structure_hash&&old?.activity_hash!==row.activity_hash;
  });
  const changedIds=new Set<string>();
  const changeKinds=new Map<string,"new"|"structure"|"activity">();

  for(const row of newRows){
    changedIds.add(row.campfire_meetup_id);
    changeKinds.set(row.campfire_meetup_id,"new");
  }
  for(const row of structureRows){
    changedIds.add(row.campfire_meetup_id);
    changeKinds.set(row.campfire_meetup_id,"structure");
  }

  const fullRows=[...newRows,...structureRows];
  if(fullRows.length){
    const {error}=await admin.from("meetups").upsert(fullRows,{onConflict:"campfire_meetup_id"});
    if(error) throw error;
  }

  for(const row of activityRows){
    const {error}=await admin
      .from("meetups")
      .update({
        rsvp_count:row.rsvp_count,
        checkin_count:row.checkin_count,
        activity_hash:row.activity_hash,
        fetched_at:row.fetched_at,
      })
      .eq("campfire_meetup_id",row.campfire_meetup_id);
    if(error) throw error;
    changedIds.add(row.campfire_meetup_id);
    changeKinds.set(row.campfire_meetup_id,"activity");
  }

  const unchanged=hashed.length-changedIds.size;
  const touchedCommunityIds=[...new Set(
    hashed
      .filter(row=>changedIds.has(row.campfire_meetup_id))
      .map(row=>row.community_id)
  )];

  let watchEvaluated=0;
  let watchCasesTouched=0;
  let notificationsQueued=0;
  let watchError:string|null=null;
  if(changedIds.size){
    try{
      const changedMeetups=await loadChangedMeetups(admin,[...changedIds]);
      const result=await evaluateWatch(admin,changedMeetups,changeKinds);
      watchEvaluated=result.evaluated;
      watchCasesTouched=result.casesTouched;
      notificationsQueued=result.notificationsQueued;
    }catch(error){
      watchError=error instanceof Error?error.message:String(error);
    }
  }

  return {
    fetched:hashed.length,
    written:changedIds.size,
    newEvents:newRows.length,
    structureUpdates:structureRows.length,
    activityUpdates:activityRows.length,
    unchanged,
    touchedCommunityIds,
    watchEvaluated,
    watchCasesTouched,
    notificationsQueued,
    watchError,
  };
}
