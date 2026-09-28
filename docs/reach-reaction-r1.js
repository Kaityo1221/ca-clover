(function(){
  "use strict";

  const VERSION="reach-reaction-r1-20260928";
  const TIME_ZONE="Asia/Tokyo";
  const HOUR=60*60*1000;
  const FIRST_OBSERVATION_LIMIT=6*HOUR;
  const CHECKPOINT_TOLERANCE=3*HOUR;
  const PAGE_SIZE=1000;
  const MAX_SNAPSHOT_PAGES=20;
  const SUPABASE_URL="https://wgiittrvgtiosogyhfcl.supabase.co";
  const SUPABASE_KEY="sb_publishable_QTCqijfNvnysUTMylNIyTA_6ngosaPN";
  const WEEKDAYS=["月","火","水","木","金","土","日"];
  const DAYPARTS=["深夜","朝","昼","夜"];
  const DAYTYPES=["平日","休日"];
  const holidayCache=new Map();
  let client=null;

  function getClient(){
    if(client)return client;
    if(!window.supabase)return null;
    client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{
      auth:{persistSession:true,autoRefreshToken:false,detectSessionInUrl:false}
    });
    return client;
  }

  function pad2(v){return String(v).padStart(2,"0")}
  function dateKey(y,m,d){return y+"-"+pad2(m)+"-"+pad2(d)}
  function keyParts(key){const p=String(key).split("-").map(Number);return {year:p[0],month:p[1],day:p[2]}}
  function addDays(key,amount){
    const p=keyParts(key);
    const d=new Date(Date.UTC(p.year,p.month-1,p.day+amount));
    return dateKey(d.getUTCFullYear(),d.getUTCMonth()+1,d.getUTCDate());
  }
  function dayOfWeek(key){
    const p=keyParts(key);
    return new Date(Date.UTC(p.year,p.month-1,p.day)).getUTCDay();
  }
  function isoDayOfWeek(key){const d=dayOfWeek(key);return d===0?7:d}
  function nthWeekday(year,month,weekday,nth){
    const first=new Date(Date.UTC(year,month-1,1)).getUTCDay();
    return 1+((weekday-first+7)%7)+(nth-1)*7;
  }
  function vernalEquinoxDay(year){
    return Math.floor(20.8431+0.242194*(year-1980)-Math.floor((year-1980)/4));
  }
  function autumnEquinoxDay(year){
    return Math.floor(23.2488+0.242194*(year-1980)-Math.floor((year-1980)/4));
  }

  function baseNationalHolidays(year){
    const map=new Map();
    function add(month,day,name){map.set(dateKey(year,month,day),name)}
    add(1,1,"元日");
    add(1,nthWeekday(year,1,1,2),"成人の日");
    add(2,11,"建国記念の日");
    if(year>=2020)add(2,23,"天皇誕生日");
    if(year>=1980&&year<=2099)add(3,vernalEquinoxDay(year),"春分の日");
    add(4,29,"昭和の日");
    add(5,3,"憲法記念日");
    add(5,4,"みどりの日");
    add(5,5,"こどもの日");
    if(year===2020){
      add(7,23,"海の日");
      add(7,24,"スポーツの日");
      add(8,10,"山の日");
    }else if(year===2021){
      add(7,22,"海の日");
      add(7,23,"スポーツの日");
      add(8,8,"山の日");
    }else{
      add(7,nthWeekday(year,7,1,3),"海の日");
      add(8,11,"山の日");
      add(10,nthWeekday(year,10,1,2),"スポーツの日");
    }
    add(9,nthWeekday(year,9,1,3),"敬老の日");
    if(year>=1980&&year<=2099)add(9,autumnEquinoxDay(year),"秋分の日");
    add(11,3,"文化の日");
    add(11,23,"勤労感謝の日");
    return map;
  }

  function buildJapanHolidayMap(year){
    if(holidayCache.has(year))return holidayCache.get(year);
    const base=baseNationalHolidays(year);
    const result=new Map(base);

    // 祝日法第3条第3項: 前後を「国民の祝日」に挟まれた日は休日。
    let key=dateKey(year,1,2);
    const end=dateKey(year,12,30);
    while(key<=end){
      if(!base.has(key)&&base.has(addDays(key,-1))&&base.has(addDays(key,1))){
        result.set(key,"休日（祝日法第3条第3項）");
      }
      key=addDays(key,1);
    }

    // 祝日法第3条第2項: 日曜の国民の祝日の後、最も近い国民の祝日でない日を休日。
    base.forEach(function(_name,holidayKey){
      if(dayOfWeek(holidayKey)!==0)return;
      let substitute=addDays(holidayKey,1);
      while(base.has(substitute))substitute=addDays(substitute,1);
      if(!result.has(substitute))result.set(substitute,"休日（振替）");
    });

    holidayCache.set(year,result);
    return result;
  }

  function jstParts(value){
    const d=value instanceof Date?value:new Date(value);
    if(!Number.isFinite(d.getTime()))return null;
    const parts=new Intl.DateTimeFormat("en-US",{
      timeZone:TIME_ZONE,
      year:"numeric",month:"2-digit",day:"2-digit",
      hour:"2-digit",minute:"2-digit",second:"2-digit",
      hourCycle:"h23"
    }).formatToParts(d);
    const out={};
    parts.forEach(function(p){if(p.type!=="literal")out[p.type]=p.value});
    const year=Number(out.year),month=Number(out.month),day=Number(out.day),hour=Number(out.hour),minute=Number(out.minute),second=Number(out.second);
    if(!Number.isFinite(year)||!Number.isFinite(month)||!Number.isFinite(day)||!Number.isFinite(hour))return null;
    return {year,month,day,hour,minute,second,key:dateKey(year,month,day)};
  }

  function classifyCreatedAt(value){
    const p=jstParts(value);
    if(!p)return null;
    const isoDow=isoDayOfWeek(p.key);
    const weekday=WEEKDAYS[isoDow-1];
    const holidayMap=buildJapanHolidayMap(p.year);
    const holidayName=holidayMap.get(p.key)||null;
    const weekend=isoDow>=6;
    const slotStart=Math.floor(p.hour/2)*2;
    let daypart="夜";
    if(p.hour<6)daypart="深夜";
    else if(p.hour<12)daypart="朝";
    else if(p.hour<18)daypart="昼";
    return {
      timeZone:TIME_ZONE,
      dateKey:p.key,
      year:p.year,
      month:p.month,
      day:p.day,
      hour:p.hour,
      minute:p.minute,
      isoWeekday:isoDow,
      weekday,
      isWeekend:weekend,
      isJapanHoliday:Boolean(holidayName),
      holidayName,
      dayType:(weekend||holidayName)?"休日":"平日",
      daypart,
      slotStart,
      slotEnd:slotStart+2,
      twoHourKey:pad2(slotStart)+"-"+pad2(slotStart+2),
      twoHourLabel:slotStart+"〜"+(slotStart+2)+"時"
    };
  }

  function normalizeSnapshots(rows){
    const sorted=(rows||[]).map(function(row){
      const time=new Date(row.observed_at).getTime();
      return {...row,time,rsvp:Number(row.rsvp_count)||0,checkin:Number(row.checkin_count)||0};
    }).filter(function(row){return Number.isFinite(row.time)}).sort(function(a,b){return a.time-b.time});
    const out=[];
    sorted.forEach(function(row){
      const prev=out[out.length-1];
      if(prev&&prev.time===row.time){out[out.length-1]=row;return}
      out.push(row);
    });
    return out;
  }

  function nearestSnapshot(rows,target){
    let best=null,bestDiff=Infinity;
    rows.forEach(function(row){
      const diff=Math.abs(row.time-target);
      if(diff<bestDiff){best=row;bestDiff=diff}
    });
    return {row:best,diff:bestDiff};
  }

  function analyzeMeetup(meetup,snapshotRows,options){
    options=options||{};
    const now=options.now==null?Date.now():new Date(options.now).getTime();
    const created=meetup.campfire_created_at?new Date(meetup.campfire_created_at).getTime():NaN;
    const starts=meetup.starts_at?new Date(meetup.starts_at).getTime():NaN;
    const classification=Number.isFinite(created)?classifyCreatedAt(meetup.campfire_created_at):null;
    const allRows=normalizeSnapshots(snapshotRows);
    const rows=Number.isFinite(created)?allRows.filter(function(row){return row.time>=created}):allRows;
    const result={
      meetupId:meetup.id,
      title:meetup.title||"Meetup",
      campfireCreatedAt:meetup.campfire_created_at||null,
      startsAt:meetup.starts_at||null,
      classification,
      snapshotCount:rows.length,
      analysisStatus:"excluded",
      exclusionReason:null,
      firstObservedAt:null,
      firstObservationLagMinutes:null,
      initialRsvp:null,
      sixHour:null,
      twentyFourHour:null,
      growth6h:null,
      growth24h:null,
      eligibleObservation:false,
      matured24h:Number.isFinite(created)&&Number.isFinite(now)&&now>=created+24*HOUR
    };

    if(!Number.isFinite(created)){
      result.exclusionReason="missing_created_at";
      return result;
    }
    if(!rows.length){
      result.exclusionReason="no_snapshot_after_creation";
      return result;
    }

    const first=rows[0];
    const firstLag=first.time-created;
    result.firstObservedAt=first.observed_at;
    result.firstObservationLagMinutes=Math.round(firstLag/60000);
    result.initialRsvp=first.rsvp;
    if(firstLag>FIRST_OBSERVATION_LIMIT){
      result.exclusionReason="first_observation_over_6h";
      return result;
    }
    result.eligibleObservation=true;

    const target6=created+6*HOUR;
    if(Number.isFinite(now)&&now>=target6){
      const n6=nearestSnapshot(rows,target6);
      if(n6.row&&n6.diff<=CHECKPOINT_TOLERANCE){
        result.sixHour={observedAt:n6.row.observed_at,rsvp:n6.row.rsvp,targetDiffMinutes:Math.round(n6.diff/60000)};
        result.growth6h=n6.row.rsvp-first.rsvp;
      }
    }

    const target24=created+24*HOUR;
    if(Number.isFinite(now)&&now<target24){
      result.analysisStatus="pending";
      result.exclusionReason="waiting_for_24h";
      return result;
    }

    const n24=nearestSnapshot(rows,target24);
    if(!n24.row||n24.diff>CHECKPOINT_TOLERANCE){
      result.exclusionReason="missing_24h_checkpoint";
      return result;
    }
    result.twentyFourHour={observedAt:n24.row.observed_at,rsvp:n24.row.rsvp,targetDiffMinutes:Math.round(n24.diff/60000)};
    result.growth24h=n24.row.rsvp-first.rsvp;
    result.analysisStatus="analyzable";
    result.exclusionReason=null;

    if(Number.isFinite(starts)&&Number.isFinite(now)&&starts<=now){
      result.isHeld=true;
      result.latestObservedRsvp=rows[rows.length-1].rsvp;
      result.initialResponseRatio=result.latestObservedRsvp>0?first.rsvp/result.latestObservedRsvp:null;
    }else{
      result.isHeld=false;
      result.latestObservedRsvp=rows[rows.length-1].rsvp;
      result.initialResponseRatio=null;
    }
    return result;
  }

  function median(values){
    const nums=(values||[]).filter(function(v){return Number.isFinite(v)}).slice().sort(function(a,b){return a-b});
    if(!nums.length)return null;
    const mid=Math.floor(nums.length/2);
    return nums.length%2?nums[mid]:(nums[mid-1]+nums[mid])/2;
  }

  function groupRows(rows,keyFn,labelFn,order){
    const map=new Map();
    rows.forEach(function(row){
      const key=keyFn(row);
      if(key==null)return;
      const list=map.get(key)||[];
      list.push(row);
      map.set(key,list);
    });
    let keys=[...map.keys()];
    if(order){
      const pos=new Map(order.map(function(v,i){return [String(v),i]}));
      keys.sort(function(a,b){return (pos.get(String(a))??999)-(pos.get(String(b))??999)});
    }else keys.sort();
    return keys.map(function(key){
      const list=map.get(key)||[];
      const growth24=list.map(function(r){return r.growth24h}).filter(Number.isFinite);
      const growth6=list.map(function(r){return r.growth6h}).filter(Number.isFinite);
      return {
        key,
        label:labelFn?labelFn(key,list[0]):String(key),
        sampleCount:growth24.length,
        median24h:median(growth24),
        sixHourSampleCount:growth6.length,
        median6h:median(growth6)
      };
    });
  }

  function aggregateAnalyses(analyses){
    const analyzable=analyses.filter(function(row){return row.analysisStatus==="analyzable"});
    const eligible=analyses.filter(function(row){return row.eligibleObservation});
    const pending=analyses.filter(function(row){return row.analysisStatus==="pending"});
    const excluded=analyses.filter(function(row){return row.analysisStatus==="excluded"});
    const exclusionReasons={};
    analyses.forEach(function(row){
      if(!row.exclusionReason)return;
      exclusionReasons[row.exclusionReason]=(exclusionReasons[row.exclusionReason]||0)+1;
    });
    const slotOrder=Array.from({length:12},function(_v,i){return pad2(i*2)+"-"+pad2(i*2+2)});
    const byTwoHour=groupRows(analyzable,function(r){return r.classification&&r.classification.twoHourKey},function(_k,r){return r.classification.twoHourLabel},slotOrder);
    const byDaypart=groupRows(analyzable,function(r){return r.classification&&r.classification.daypart},null,DAYPARTS);
    const byWeekday=groupRows(analyzable,function(r){return r.classification&&r.classification.weekday},null,WEEKDAYS);
    const byDayType=groupRows(analyzable,function(r){return r.classification&&r.classification.dayType},null,DAYTYPES);
    const byWeekdayTwoHour=groupRows(analyzable,function(r){
      return r.classification?r.classification.weekday+"|"+r.classification.twoHourKey:null;
    },function(_k,r){return r.classification.weekday+" "+r.classification.twoHourLabel});
    return {
      timeZone:TIME_ZONE,
      totalMeetups:analyses.length,
      eligibleObservationCount:eligible.length,
      analyzable24hCount:analyzable.length,
      pending24hCount:pending.length,
      excludedCount:excluded.length,
      exclusionReasons,
      overallMedian24h:median(analyzable.map(function(r){return r.growth24h})),
      overallMedian6h:median(analyzable.map(function(r){return r.growth6h})),
      byTwoHour,
      byDaypart,
      byWeekday,
      byDayType,
      byWeekdayTwoHour
    };
  }

  function analyzeCommunityData(meetups,snapshots,options){
    const byMeetup=new Map();
    (snapshots||[]).forEach(function(row){
      const list=byMeetup.get(row.meetup_id)||[];
      list.push(row);
      byMeetup.set(row.meetup_id,list);
    });
    const analyses=(meetups||[]).filter(function(m){return (byMeetup.get(m.id)||[]).length>0||m.campfire_created_at}).map(function(meetup){
      return analyzeMeetup(meetup,byMeetup.get(meetup.id)||[],options);
    });
    return {version:VERSION,summary:aggregateAnalyses(analyses),meetups:analyses};
  }

  async function fetchSnapshots(sb,communityId){
    const rows=[];
    let truncated=false;
    for(let page=0;page<MAX_SNAPSHOT_PAGES;page++){
      const from=page*PAGE_SIZE,to=from+PAGE_SIZE-1;
      const r=await sb.from("meetup_metric_snapshots")
        .select("meetup_id,rsvp_count,checkin_count,observed_at,source")
        .eq("community_id",communityId)
        .order("observed_at",{ascending:true})
        .range(from,to);
      if(r.error)throw r.error;
      const chunk=r.data||[];
      rows.push(...chunk);
      if(chunk.length<PAGE_SIZE)return {rows,truncated:false};
    }
    truncated=true;
    return {rows,truncated};
  }

  async function loadCommunity(communityId,options){
    const sb=getClient();
    if(!sb)throw new Error("Supabase client is not available");
    if(!communityId)throw new Error("communityId is required");
    const snapshotResult=await fetchSnapshots(sb,communityId);
    const meetupResult=await sb.from("meetups")
      .select("id,title,starts_at,ends_at,campfire_created_at,rsvp_count,checkin_count")
      .eq("community_id",communityId)
      .order("campfire_created_at",{ascending:false,nullsFirst:false})
      .limit(1000);
    if(meetupResult.error)throw meetupResult.error;
    const result=analyzeCommunityData(meetupResult.data||[],snapshotResult.rows,options);
    result.snapshotRows=snapshotResult.rows.length;
    result.snapshotRowsTruncated=snapshotResult.truncated;
    return result;
  }

  window.CAReachReactionR1={
    VERSION,
    TIME_ZONE,
    FIRST_OBSERVATION_LIMIT_HOURS:FIRST_OBSERVATION_LIMIT/HOUR,
    CHECKPOINT_TOLERANCE_HOURS:CHECKPOINT_TOLERANCE/HOUR,
    classifyCreatedAt,
    buildJapanHolidayMap,
    analyzeMeetup,
    analyzeCommunityData,
    aggregateAnalyses,
    median,
    loadCommunity
  };
})();
