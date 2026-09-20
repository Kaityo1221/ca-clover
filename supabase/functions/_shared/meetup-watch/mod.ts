import type {SupabaseClient} from "npm:@supabase/supabase-js@2";
import {buildMeetupHashes,type MeetupHashInput} from "./hash.ts";
import {
  evaluateActivity,
  evaluateStructure,
  summarizeFindings,
  type FindingDraft,
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
  for(let i=0;i<items.length;i+=size) result.push(items.slice(i,i+size));
  return result;
};

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
      .select("id,campfire_meetup_id,community_id,title,details,starts_at,ends_at,location,is_ca_meetup,rsvp_count,checkin_count,campfire_live_event_name")
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
  const startMs=Date.parse(row.starts_at);
  if(!Number.isFinite(startMs)) return [];
  const jstKey=new Date(startMs+9*60*60*1000).toISOString().slice(0,10);
  const key=row.community_id+":"+jstKey;
  const cached=cache.get(key);
  if(cached) return cached;

  const from=new Date(startMs-24*60*60*1000).toISOString();
  const to=new Date(startMs+24*60*60*1000).toISOString();
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

async function upsertHotState(
  admin:SupabaseClient,
  row:WatchMeetup,
  settings:WatchSettings,
){
  if(!row.community_id) return;
  const now=Date.now();
  const candidate=now+Math.max(15,settings.hot_ttl_minutes)*60*1000;
  const {data:current}=await admin
    .from("watch_community_state")
    .select("hot_until,hot_reasons")
    .eq("community_id",row.community_id)
    .maybeSingle();

  const currentTime=current?.hot_until?Date.parse(current.hot_until):0;
  const hotUntil=new Date(Math.max(candidate,Number.isFinite(currentTime)?currentTime:0)).toISOString();
  const reasons=[...new Set([...(current?.hot_reasons??[]),"TIME_SHORT"])];
  const {error}=await admin.from("watch_community_state").upsert({
    community_id:row.community_id,
    hot_until:hotUntil,
    hot_reasons:reasons,
    hot_meetup_id:row.id,
    next_hot_scan_at:new Date().toISOString(),
    updated_at:new Date().toISOString(),
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
    priority:0,
    flags:[],
    last_evaluated_at:new Date().toISOString(),
    updated_at:new Date().toISOString(),
  }).select("id,meetup_id,status,flags").single();
  if(error) throw error;
  return data as CaseRow;
}

async function evaluateWatch(
  admin:SupabaseClient,
  changedRows:WatchMeetup[],
  changeKinds:Map<string,"new"|"structure"|"activity">,
){
  const {data:settingsData,error:settingsError}=await admin
    .from("watch_settings")
    .select("enabled,hot_ttl_minutes,watch_lookback_days,rule_version,rule_config")
    .eq("id",1)
    .single();
  if(settingsError) throw settingsError;
  if(settingsData?.enabled!==true) return {evaluated:0,casesTouched:0};

  const settings:WatchSettings={
    hot_ttl_minutes:Number(settingsData.hot_ttl_minutes??360),
    watch_lookback_days:Number(settingsData.watch_lookback_days??30),
    rule_version:Number(settingsData.rule_version??1),
    rule_config:(settingsData.rule_config??{}) as Record<string,unknown>,
  };

  const {data:termData,error:termError}=await admin
    .from("watch_terms")
    .select("id,phrase,category,severity,flag_code,regex,negative_pattern,rule_version")
    .eq("enabled",true);
  if(termError) throw termError;
  const terms=(termData as WatchTerm[]|null)??[];

  const cutoff=Date.now()-Math.max(1,settings.watch_lookback_days)*24*60*60*1000;
  const rows=changedRows.filter(row=>{
    if(!row.starts_at) return true;
    const time=Date.parse(row.starts_at);
    return !Number.isFinite(time)||time>=cutoff;
  });
  if(!rows.length) return {evaluated:0,casesTouched:0};

  const ids=rows.map(row=>row.id);
  const {data:caseData,error:caseError}=await admin
    .from("meetup_watch_cases")
    .select("id,meetup_id,status,flags")
    .in("meetup_id",ids);
  if(caseError) throw caseError;
  const caseMap=new Map(((caseData as CaseRow[]|null)??[]).map(row=>[row.meetup_id,row]));
  const relatedCache=new Map<string,RelatedMeetup[]>();
  let casesTouched=0;

  for(const row of rows){
    const kind=changeKinds.get(row.campfire_meetup_id);
    if(!kind) continue;
    const related=await loadRelated(admin,row,relatedCache);
    const findings:FindingDraft[]=[];
    const sourceClasses:string[]=[];

    if(kind==="new"||kind==="structure"){
      findings.push(...evaluateStructure(row,terms,related,settings));
      sourceClasses.push("structure","repeat");
    }
    if(kind==="new"||kind==="structure"||kind==="activity"){
      findings.push(...evaluateActivity(row,related,settings));
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
      const records=findings.map(finding=>({
        meetup_id:row.id,
        case_id:currentCase.id,
        watch_term_id:finding.watch_term_id,
        finding_key:finding.finding_key,
        flag_code:finding.flag_code,
        category:finding.category,
        severity:finding.severity,
        reason:finding.reason,
        matched_field:finding.matched_field,
        matched_text:finding.matched_text,
        match_start:finding.match_start,
        match_end:finding.match_end,
        source_class:finding.source_class,
        active:true,
        rule_version:finding.rule_version,
        last_detected_at:nowIso,
      }));
      const {error:findingError}=await admin
        .from("meetup_watch_findings")
        .upsert(records,{onConflict:"meetup_id,finding_key"});
      if(findingError) throw findingError;
    }

    const {data:activeData,error:activeError}=await admin
      .from("meetup_watch_findings")
      .select("flag_code,severity,reason,source_class")
      .eq("meetup_id",row.id)
      .eq("active",true);
    if(activeError) throw activeError;
    const summary=summarizeFindings((activeData??[]) as Array<{
      flag_code:string;
      severity:number;
      reason:string;
      source_class:"structure"|"activity"|"repeat"|"reserved";
    }>);

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
        priority:summary.priority,
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

    if(summary.isHotTrigger){
      await upsertHotState(admin,row,settings);
    }
    casesTouched++;
  }

  return {evaluated:rows.length,casesTouched};
}

export async function processMeetupRows(
  admin:SupabaseClient,
  rows:MeetupWriteRow[],
){
  if(!rows.length){
    return {
      fetched:0,written:0,newEvents:0,structureUpdates:0,activityUpdates:0,
      unchanged:0,touchedCommunityIds:[] as string[],watchEvaluated:0,watchCasesTouched:0,watchError:null as string|null,
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
  const unchanged=hashed.length-newRows.length-structureRows.length-activityRows.length;
  const changeKinds=new Map<string,"new"|"structure"|"activity">();
  newRows.forEach(row=>changeKinds.set(row.campfire_meetup_id,"new"));
  structureRows.forEach(row=>changeKinds.set(row.campfire_meetup_id,"structure"));
  activityRows.forEach(row=>changeKinds.set(row.campfire_meetup_id,"activity"));

  const fullRows=[...newRows,...structureRows];
  if(fullRows.length){
    const {error}=await admin
      .from("meetups")
      .upsert(fullRows,{onConflict:"campfire_meetup_id"});
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
  }

  const changedIds=[...changeKinds.keys()];
  const touchedCommunityIds=[...new Set(
    hashed
      .filter(row=>changeKinds.has(row.campfire_meetup_id))
      .map(row=>row.community_id)
  )];

  let watchEvaluated=0;
  let watchCasesTouched=0;
  let watchError:string|null=null;
  if(changedIds.length){
    try{
      const changedMeetups=await loadChangedMeetups(admin,changedIds);
      const result=await evaluateWatch(admin,changedMeetups,changeKinds);
      watchEvaluated=result.evaluated;
      watchCasesTouched=result.casesTouched;
    }catch(error){
      watchError=error instanceof Error?error.message:String(error);
    }
  }

  return {
    fetched:hashed.length,
    written:changedIds.length,
    newEvents:newRows.length,
    structureUpdates:structureRows.length,
    activityUpdates:activityRows.length,
    unchanged,
    touchedCommunityIds,
    watchEvaluated,
    watchCasesTouched,
    watchError,
  };
}
