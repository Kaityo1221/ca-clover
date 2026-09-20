import {normalizeSimple,normalizeWithMap,originalRange} from "./normalize.ts";

export type WatchTerm={
  id:string;
  phrase:string;
  category:string;
  severity:number;
  flag_code:string;
  regex:boolean;
  negative_pattern:string|null;
  rule_version:number;
};

export type WatchSettings={
  hot_ttl_minutes:number;
  watch_lookback_days:number;
  rule_version:number;
  rule_config:Record<string,unknown>;
};

export type WatchMeetup={
  id:string;
  campfire_meetup_id:string;
  community_id:string|null;
  title:string;
  details:string|null;
  starts_at:string|null;
  ends_at:string|null;
  location:string|null;
  is_ca_meetup:boolean|null;
  rsvp_count:number|null;
  checkin_count:number|null;
  campfire_live_event_name:string|null;
};

export type RelatedMeetup={
  id:string;
  starts_at:string|null;
  ends_at:string|null;
  rsvp_count:number|null;
  checkin_count:number|null;
};

export type FindingDraft={
  finding_key:string;
  watch_term_id:string|null;
  flag_code:string;
  category:string;
  severity:number;
  reason:string;
  matched_field:string|null;
  matched_text:string|null;
  match_start:number|null;
  match_end:number|null;
  source_class:"structure"|"activity"|"repeat"|"reserved";
  rule_version:number;
};

const RESERVED_FLAGS=[
  "LOCATION_UNUSUAL",
  "CREATED_LAST_MINUTE",
  "OFFICIAL_TIME_OUTSIDE",
] as const;

function negativeNearby(
  text:string,
  start:number,
  end:number,
  pattern:string|null,
){
  if(!pattern) return false;
  const before=text.slice(Math.max(0,start-36),start);
  const after=text.slice(end,Math.min(text.length,end+40));
  const context=(before+" "+after).normalize("NFKC").toLowerCase();
  try{
    return new RegExp(pattern,"iu").test(context);
  }catch{
    return false;
  }
}

function literalMatches(text:string,term:WatchTerm,field:"title"|"details"){
  const target=normalizeWithMap(text);
  const needle=normalizeSimple(term.phrase);
  const matches:FindingDraft[]=[];
  if(!needle) return matches;

  let from=0;
  while(from<=target.normalized.length-needle.length){
    const index=target.normalized.indexOf(needle,from);
    if(index<0) break;
    const range=originalRange(target,index,needle.length);
    from=index+Math.max(1,needle.length);
    if(!range) continue;
    if(negativeNearby(text,range.start,range.end,term.negative_pattern)) continue;

    matches.push({
      finding_key:`term:${term.id}:${field}:${range.start}:${range.end}`,
      watch_term_id:term.id,
      flag_code:term.flag_code,
      category:term.category,
      severity:term.severity,
      reason:`${field==="title"?"タイトル":"概要"}に「${text.slice(range.start,range.end)}」`,
      matched_field:field,
      matched_text:text.slice(range.start,range.end),
      match_start:range.start,
      match_end:range.end,
      source_class:"structure",
      rule_version:term.rule_version,
    });
  }
  return matches;
}

function regexMatches(text:string,term:WatchTerm,field:"title"|"details"){
  const matches:FindingDraft[]=[];
  let expression:RegExp;
  try{
    expression=new RegExp(term.phrase,"giu");
  }catch{
    return matches;
  }

  for(const match of text.normalize("NFKC").matchAll(expression)){
    if(match.index===undefined||!match[0]) continue;
    const start=match.index;
    const end=start+match[0].length;
    if(negativeNearby(text,start,end,term.negative_pattern)) continue;
    matches.push({
      finding_key:`term:${term.id}:${field}:${start}:${end}`,
      watch_term_id:term.id,
      flag_code:term.flag_code,
      category:term.category,
      severity:term.severity,
      reason:`${field==="title"?"タイトル":"概要"}に「${text.slice(start,end)}」`,
      matched_field:field,
      matched_text:text.slice(start,end),
      match_start:start,
      match_end:end,
      source_class:"structure",
      rule_version:term.rule_version,
    });
  }
  return matches;
}

function textFindings(row:WatchMeetup,terms:WatchTerm[]){
  const findings:FindingDraft[]=[];
  for(const term of terms){
    for(const [field,value] of [["title",row.title],["details",row.details??""]] as const){
      if(!value) continue;
      findings.push(...(term.regex?regexMatches(value,term,field):literalMatches(value,term,field)));
    }
  }
  return findings;
}

function durationMinutes(row:WatchMeetup){
  if(!row.starts_at||!row.ends_at) return null;
  const start=Date.parse(row.starts_at);
  const end=Date.parse(row.ends_at);
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<start) return null;
  return (end-start)/60000;
}

function jstDateKey(value:string){
  const time=Date.parse(value);
  if(!Number.isFinite(time)) return "";
  return new Date(time+9*60*60*1000).toISOString().slice(0,10);
}

export function evaluateStructure(
  row:WatchMeetup,
  terms:WatchTerm[],
  related:RelatedMeetup[],
  settings:WatchSettings,
){
  const findings=textFindings(row,terms);
  const duration=durationMinutes(row);

  if(duration!==null&&duration<=60){
    findings.push({
      finding_key:"rule:TIME_SHORT",
      watch_term_id:null,
      flag_code:"TIME_SHORT",
      category:"time",
      severity:1,
      reason:`開催時間が60分以下（${Math.round(duration)}分）`,
      matched_field:null,
      matched_text:null,
      match_start:null,
      match_end:null,
      source_class:"structure",
      rule_version:settings.rule_version,
    });
  }
  if(duration!==null&&duration<=30){
    findings.push({
      finding_key:"rule:TIME_VERY_SHORT",
      watch_term_id:null,
      flag_code:"TIME_VERY_SHORT",
      category:"time",
      severity:2,
      reason:`開催時間が30分以下（${Math.round(duration)}分）`,
      matched_field:null,
      matched_text:null,
      match_start:null,
      match_end:null,
      source_class:"structure",
      rule_version:settings.rule_version,
    });
  }

  if(row.starts_at){
    const sameDay=related.filter(other=>
      other.id!==row.id &&
      Boolean(other.starts_at) &&
      jstDateKey(other.starts_at as string)===jstDateKey(row.starts_at as string)
    );
    if(sameDay.length){
      findings.push({
        finding_key:"rule:REPEAT_SAME_DAY",
        watch_term_id:null,
        flag_code:"REPEAT_SAME_DAY",
        category:"repeat",
        severity:1,
        reason:`同じCommunityで同日に他のMeetupが${sameDay.length}件あります`,
        matched_field:null,
        matched_text:null,
        match_start:null,
        match_end:null,
        source_class:"repeat",
        rule_version:settings.rule_version,
      });
    }

    const closeMinutes=Math.max(30,Number(settings.rule_config?.repeat_close_minutes??180)||180);
    const start=Date.parse(row.starts_at);
    const distances=related
      .filter(other=>other.id!==row.id&&other.starts_at)
      .map(other=>Math.abs(Date.parse(other.starts_at as string)-start)/60000)
      .filter(value=>Number.isFinite(value)&&value<=closeMinutes);
    if(distances.length){
      const closest=Math.round(Math.min(...distances));
      findings.push({
        finding_key:"rule:REPEAT_CLOSE",
        watch_term_id:null,
        flag_code:"REPEAT_CLOSE",
        category:"repeat",
        severity:2,
        reason:`同じCommunityの別Meetupと開始時刻が近接（最短${closest}分）`,
        matched_field:null,
        matched_text:null,
        match_start:null,
        match_end:null,
        source_class:"repeat",
        rule_version:settings.rule_version,
      });
    }
  }

  return findings;
}

export function evaluateActivity(
  row:WatchMeetup,
  related:RelatedMeetup[],
  settings:WatchSettings,
){
  const findings:FindingDraft[]=[];
  const config=settings.rule_config??{};
  const endRaw=row.ends_at??row.starts_at;
  const ended=endRaw?Date.parse(endRaw)<=Date.now():false;
  if(!ended) return findings;

  const lowEnabled=config.low_checkin_enabled===true;
  const lowMax=Math.max(0,Number(config.low_checkin_max??2)||0);
  if(lowEnabled&&row.checkin_count!==null&&row.checkin_count<=lowMax){
    findings.push({
      finding_key:"rule:LOW_CHECKIN",
      watch_term_id:null,
      flag_code:"LOW_CHECKIN",
      category:"activity",
      severity:2,
      reason:`Check-inが設定閾値以下（${row.checkin_count}）`,
      matched_field:null,
      matched_text:null,
      match_start:null,
      match_end:null,
      source_class:"activity",
      rule_version:settings.rule_version,
    });

    const repeatNeed=Math.max(2,Number(config.low_checkin_repeat_count??3)||3);
    const lowRelated=related.filter(other=>
      other.id!==row.id &&
      other.checkin_count!==null &&
      other.checkin_count<=lowMax &&
      Boolean(other.ends_at??other.starts_at) &&
      Date.parse((other.ends_at??other.starts_at) as string)<=Date.now()
    );
    if(lowRelated.length+1>=repeatNeed){
      findings.push({
        finding_key:"rule:LOW_CHECKIN_REPEAT",
        watch_term_id:null,
        flag_code:"LOW_CHECKIN_REPEAT",
        category:"activity",
        severity:2,
        reason:`低Check-inが同じCommunityで繰り返されています（${lowRelated.length+1}件）`,
        matched_field:null,
        matched_text:null,
        match_start:null,
        match_end:null,
        source_class:"activity",
        rule_version:settings.rule_version,
      });
    }
  }

  const gapEnabled=config.rsvp_checkin_gap_enabled===true;
  const gapMin=Math.max(1,Number(config.rsvp_gap_min??10)||10);
  const ratioMax=Math.max(0,Math.min(1,Number(config.rsvp_checkin_ratio_max??0.25)||0.25));
  if(
    gapEnabled &&
    row.rsvp_count!==null &&
    row.checkin_count!==null &&
    row.rsvp_count>=gapMin &&
    row.checkin_count/Math.max(1,row.rsvp_count)<=ratioMax
  ){
    findings.push({
      finding_key:"rule:RSVP_CHECKIN_GAP",
      watch_term_id:null,
      flag_code:"RSVP_CHECKIN_GAP",
      category:"activity",
      severity:2,
      reason:`RSVP ${row.rsvp_count} に対し Check-in ${row.checkin_count}`,
      matched_field:null,
      matched_text:null,
      match_start:null,
      match_end:null,
      source_class:"activity",
      rule_version:settings.rule_version,
    });
  }

  return findings;
}

export function summarizeFindings(findings:Array<Pick<FindingDraft,"flag_code"|"severity"|"reason"|"source_class">>){
  const flags=[...new Set(findings.map(f=>f.flag_code))].sort();
  const material=flags.filter(flag=>!["TIME_SHORT","REPEAT_SAME_DAY"].includes(flag));
  const strong=findings.some(f=>
    f.severity>=3 &&
    ["TITLE_STRONG","TITLE_REWARD","HOST_ABSENT_TEXT","FREE_CHECKIN_TEXT"].includes(f.flag_code)
  );
  const maxSeverity=findings.reduce((max,f)=>Math.max(max,f.severity),0);
  const reviewRequired=
    strong ||
    material.length>=2 ||
    (flags.includes("TIME_VERY_SHORT")&&material.length>=1);

  let priority=0;
  if(!reviewRequired){
    priority=maxSeverity>=2?1:0;
  }else if(strong&&flags.length>=3&&maxSeverity>=4){
    priority=5;
  }else if(strong&&flags.length>=2){
    priority=4;
  }else if(strong){
    priority=3;
  }else{
    priority=2;
  }

  const reasons=[...findings]
    .sort((a,b)=>b.severity-a.severity)
    .map(f=>f.reason)
    .filter((value,index,array)=>array.indexOf(value)===index)
    .slice(0,3);

  return {
    flags,
    reviewRequired,
    priority,
    isHotTrigger:flags.includes("TIME_SHORT"),
    notifyCandidate:strong||material.length>=2,
    reasonSummary:reasons.join(" / ")||null,
  };
}

export {RESERVED_FLAGS};
