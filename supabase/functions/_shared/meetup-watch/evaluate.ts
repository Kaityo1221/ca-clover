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
  hot_scan_interval_minutes:number;
  normal_scan_interval_minutes:number;
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
  event_url:string|null;
  campfire_created_at:string|null;
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

export type OfficialEventWindow={
  id:string;
  event_name:string;
  starts_at:string;
  ends_at:string;
};

export type FindingDraft={
  finding_key:string;
  watch_term_id:string|null;
  flag_code:string;
  category:string;
  severity:number;
  score_weight:number;
  reason:string;
  matched_field:string|null;
  matched_text:string|null;
  match_start:number|null;
  match_end:number|null;
  source_class:"structure"|"activity"|"repeat"|"reserved";
  rule_version:number;
};

const SCORE_BY_FLAG:Record<string,number>={
  TIME_SHORT:1,
  TIME_VERY_SHORT:2,
  CREATED_LAST_MINUTE:1,
  OFFICIAL_TIME_OUTSIDE:2,
  REPEAT_CLOSE:2,
  REPEAT_SAME_DAY:2,
  TITLE_CAUTION:2,
  TITLE_STRONG:3,
  PARTICIPATION_RESTRICTED:3,
  FREE_CHECKIN_TEXT:2,
  CHECKIN_ONLY:2,
  HOST_ABSENT_TEXT:3,
  NON_FACE_TO_FACE:3,
  REWARD_ONLY:3,
  LOW_CHECKIN:1,
  LOW_CHECKIN_REPEAT:2,
};

const STRONG_DISCORD_FLAGS=new Set([
  "TITLE_STRONG",
  "PARTICIPATION_RESTRICTED",
  "HOST_ABSENT_TEXT",
  "NON_FACE_TO_FACE",
  "REWARD_ONLY",
]);

function scoreForFlag(flag:string){
  return SCORE_BY_FLAG[flag]??0;
}

function scoreCategory(flag:string){
  if(flag==="TIME_SHORT"||flag==="TIME_VERY_SHORT") return "TIME";
  return flag;
}

function negativeNearby(text:string,start:number,end:number,pattern:string|null){
  if(!pattern) return false;
  const before=text.slice(Math.max(0,start-40),start);
  const after=text.slice(end,Math.min(text.length,end+48));
  const context=(before+" "+after).normalize("NFKC").toLowerCase();
  try{
    return new RegExp(pattern,"iu").test(context);
  }catch{
    return false;
  }
}

function buildTextFinding(
  term:WatchTerm,
  field:"title"|"details",
  text:string,
  start:number,
  end:number,
):FindingDraft{
  const matched=text.slice(start,end);
  return {
    finding_key:"term:"+term.id+":"+field+":"+start+":"+end,
    watch_term_id:term.id,
    flag_code:term.flag_code,
    category:term.category,
    severity:term.severity,
    score_weight:scoreForFlag(term.flag_code),
    reason:(field==="title"?"タイトル":"概要")+"に「"+matched+"」",
    matched_field:field,
    matched_text:matched,
    match_start:start,
    match_end:end,
    source_class:"structure",
    rule_version:term.rule_version,
  };
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
    matches.push(buildTextFinding(term,field,text,range.start,range.end));
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
  for(const match of text.matchAll(expression)){
    if(match.index===undefined||!match[0]) continue;
    const start=match.index;
    const end=start+match[0].length;
    if(negativeNearby(text,start,end,term.negative_pattern)) continue;
    matches.push(buildTextFinding(term,field,text,start,end));
  }
  return matches;
}

function textFindings(row:WatchMeetup,terms:WatchTerm[]){
  const findings:FindingDraft[]=[];
  for(const term of terms){
    const pairs:Array<["title"|"details",string]>=[
      ["title",row.title],
      ["details",row.details??""],
    ];
    for(const [field,value] of pairs){
      if(!value) continue;
      findings.push(...(term.regex?regexMatches(value,term,field):literalMatches(value,term,field)));
    }
  }
  return findings;
}

export function durationMinutes(row:{starts_at:string|null;ends_at:string|null}){
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

function finding(
  flag_code:string,
  category:string,
  severity:number,
  reason:string,
  source_class:"structure"|"activity"|"repeat"|"reserved",
  ruleVersion:number,
):FindingDraft{
  return {
    finding_key:"rule:"+flag_code,
    watch_term_id:null,
    flag_code,
    category,
    severity,
    score_weight:scoreForFlag(flag_code),
    reason,
    matched_field:null,
    matched_text:null,
    match_start:null,
    match_end:null,
    source_class,
    rule_version:ruleVersion,
  };
}

function officialGate(
  row:WatchMeetup,
  window:OfficialEventWindow|null,
  settings:WatchSettings,
){
  if(!window||!row.starts_at) return {skip:false,outside:null as FindingDraft|null};
  const meetupStart=Date.parse(row.starts_at);
  const officialStart=Date.parse(window.starts_at);
  const officialEnd=Date.parse(window.ends_at);
  if(!Number.isFinite(meetupStart)||!Number.isFinite(officialStart)||!Number.isFinite(officialEnd)){
    return {skip:false,outside:null as FindingDraft|null};
  }

  const grace=Math.max(0,Number(settings.rule_config.official_grace_minutes??60)||60);
  const strongOutside=Math.max(grace,Number(settings.rule_config.official_strong_outside_minutes??120)||120);
  if(meetupStart<officialStart) return {skip:true,outside:null as FindingDraft|null};
  if(meetupStart<=officialEnd+grace*60000) return {skip:true,outside:null as FindingDraft|null};

  const minutesAfter=Math.round((meetupStart-officialEnd)/60000);
  const severity=minutesAfter>strongOutside?3:2;
  return {
    skip:false,
    outside:finding(
      "OFFICIAL_TIME_OUTSIDE",
      "official_time",
      severity,
      "公式イベント終了から"+minutesAfter+"分後に開始",
      "structure",
      settings.rule_version,
    ),
  };
}

export function evaluateStructure(
  row:WatchMeetup,
  terms:WatchTerm[],
  related:RelatedMeetup[],
  settings:WatchSettings,
  officialWindow:OfficialEventWindow|null,
){
  const gate=officialGate(row,officialWindow,settings);
  if(gate.skip) return [];

  const findings=textFindings(row,terms);
  if(gate.outside) findings.push(gate.outside);

  const duration=durationMinutes(row);
  if(duration!==null&&duration<=60){
    findings.push(finding(
      "TIME_SHORT",
      "time",
      1,
      "開催時間が60分以下（"+Math.round(duration)+"分）",
      "structure",
      settings.rule_version,
    ));
  }
  if(duration!==null&&duration<=30){
    findings.push(finding(
      "TIME_VERY_SHORT",
      "time",
      2,
      "開催時間が30分以下（"+Math.round(duration)+"分）",
      "structure",
      settings.rule_version,
    ));
  }

  if(row.starts_at&&row.campfire_created_at){
    const start=Date.parse(row.starts_at);
    const created=Date.parse(row.campfire_created_at);
    const threshold=Math.max(1,Number(settings.rule_config.created_last_minute_minutes??10)||10);
    const minutes=(start-created)/60000;
    if(Number.isFinite(minutes)&&minutes>=0&&minutes<=threshold){
      findings.push(finding(
        "CREATED_LAST_MINUTE",
        "creation",
        1,
        "Meetup開始"+Math.max(0,Math.round(minutes))+"分前に作成",
        "structure",
        settings.rule_version,
      ));
    }
  }

  if(row.starts_at&&duration!==null&&duration<=60){
    const sameDayShort=related.filter(other=>{
      if(other.id===row.id||!other.starts_at) return false;
      const otherDuration=durationMinutes(other);
      return otherDuration!==null
        && otherDuration<=60
        && jstDateKey(other.starts_at)===jstDateKey(row.starts_at as string);
    });
    if(sameDayShort.length>=1){
      findings.push(finding(
        "REPEAT_SAME_DAY",
        "repeat",
        2,
        "同じCommunityで60分以下のMeetupが同日に"+(sameDayShort.length+1)+"件",
        "repeat",
        settings.rule_version,
      ));
    }
  }

  if(row.starts_at){
    const currentStart=Date.parse(row.starts_at);
    const closeMinutes=Math.max(1,Number(settings.rule_config.repeat_close_minutes??30)||30);
    const prior=related
      .filter(other=>other.id!==row.id&&other.ends_at)
      .map(other=>({
        other,
        gap:(currentStart-Date.parse(other.ends_at as string))/60000,
      }))
      .filter(item=>Number.isFinite(item.gap)&&item.gap>=0&&item.gap<=closeMinutes)
      .sort((a,b)=>a.gap-b.gap)[0];
    if(prior){
      findings.push(finding(
        "REPEAT_CLOSE",
        "repeat",
        2,
        "前Meetup終了から"+Math.round(prior.gap)+"分で次のMeetupを開始",
        "repeat",
        settings.rule_version,
      ));
    }
  }

  return findings;
}

export function evaluateActivity(
  row:WatchMeetup,
  related:RelatedMeetup[],
  settings:WatchSettings,
  officialWindow:OfficialEventWindow|null,
){
  const gate=officialGate(row,officialWindow,settings);
  if(gate.skip) return [];

  const findings:FindingDraft[]=[];
  const endRaw=row.ends_at??row.starts_at;
  const end=endRaw?Date.parse(endRaw):NaN;
  if(!Number.isFinite(end)||end>Date.now()) return findings;

  if(row.checkin_count!==null&&row.checkin_count>=0&&row.checkin_count<=1){
    findings.push(finding(
      "LOW_CHECKIN",
      "activity",
      1,
      "Meetup終了後のCheck-inが"+row.checkin_count+"名",
      "activity",
      settings.rule_version,
    ));
  }

  const repeatDays=Math.max(1,Number(settings.rule_config.low_checkin_repeat_days??30)||30);
  const repeatMax=Math.max(0,Number(settings.rule_config.low_checkin_repeat_max??2)||2);
  const repeatCount=Math.max(2,Number(settings.rule_config.low_checkin_repeat_count??3)||3);
  const from=end-repeatDays*24*60*60*1000;
  const low=related.filter(other=>{
    const otherEnd=Date.parse((other.ends_at??other.starts_at)??"");
    return Number.isFinite(otherEnd)
      && otherEnd>=from
      && otherEnd<=end
      && otherEnd<=Date.now()
      && other.checkin_count!==null
      && other.checkin_count>=0
      && other.checkin_count<=repeatMax;
  });
  if(!low.some(other=>other.id===row.id)&&row.checkin_count!==null&&row.checkin_count<=repeatMax){
    low.push({
      id:row.id,
      starts_at:row.starts_at,
      ends_at:row.ends_at,
      rsvp_count:row.rsvp_count,
      checkin_count:row.checkin_count,
    });
  }
  if(low.length>=repeatCount){
    findings.push(finding(
      "LOW_CHECKIN_REPEAT",
      "activity",
      2,
      "30日以内にCheck-in 0〜2名のMeetupが"+low.length+"回",
      "activity",
      settings.rule_version,
    ));
  }

  return findings;
}

export function summarizeFindings(findings:Array<Pick<FindingDraft,"flag_code"|"severity"|"score_weight"|"reason">>){
  const flags=[...new Set(findings.map(item=>item.flag_code))].sort();
  const categoryScores=new Map<string,number>();
  for(const item of findings){
    const key=scoreCategory(item.flag_code);
    categoryScores.set(key,Math.max(categoryScores.get(key)??0,item.score_weight??scoreForFlag(item.flag_code)));
  }
  const score=[...categoryScores.values()].reduce((sum,value)=>sum+value,0);
  const strongStandalone=flags.some(flag=>STRONG_DISCORD_FLAGS.has(flag));
  const reviewRequired=score>=3;
  const highPriority=score>=5;
  const discordCandidate=highPriority||strongStandalone;
  const priorityLevel=highPriority?"high":reviewRequired?"review":"record";
  const reasons=[...findings]
    .sort((a,b)=>(b.score_weight??0)-(a.score_weight??0)||b.severity-a.severity)
    .map(item=>item.reason)
    .filter((value,index,array)=>array.indexOf(value)===index)
    .slice(0,3);

  return {
    flags,
    score,
    priority:Math.min(5,score),
    priorityLevel,
    reviewRequired,
    highPriority,
    discordCandidate,
    notifyFlags:discordCandidate?flags:[],
    isHotTrigger:flags.includes("TIME_SHORT"),
    reasonSummary:reasons.join(" / ")||null,
  };
}
