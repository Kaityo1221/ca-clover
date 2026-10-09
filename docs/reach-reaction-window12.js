(function(){
  "use strict";

  const VERSION="reach-reaction-window12-20260928";
  const WINDOW_MONTHS=12;
  const PAGE_SIZE=1000;
  const MAX_SNAPSHOT_PAGES=50;
  const SUPABASE_URL="https://wgiittrvgtiosogyhfcl.supabase.co";
  const SUPABASE_KEY="sb_publishable_QTCqijfNvnysUTMylNIyTA_6ngosaPN";
  let client=null;
  const pendingLoads=new Map();

  function getClient(){
    if(client)return client;
    if(!window.supabase)return null;
    client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{
      auth:{persistSession:true,autoRefreshToken:false,detectSessionInUrl:false}
    });
    return client;
  }

  function jstParts(value){
    const d=value instanceof Date?value:new Date(value);
    if(!Number.isFinite(d.getTime()))return null;
    const parts=new Intl.DateTimeFormat("en-US",{
      timeZone:"Asia/Tokyo",
      year:"numeric",month:"2-digit",day:"2-digit",
      hour:"2-digit",minute:"2-digit",second:"2-digit",
      hourCycle:"h23"
    }).formatToParts(d);
    const out={};
    parts.forEach(function(p){if(p.type!=="literal")out[p.type]=p.value});
    return {
      year:Number(out.year),month:Number(out.month),day:Number(out.day),
      hour:Number(out.hour),minute:Number(out.minute),second:Number(out.second)
    };
  }

  function daysInMonth(year,month){
    return new Date(Date.UTC(year,month,0)).getUTCDate();
  }

  function cutoffFor(nowValue){
    const now=nowValue==null?new Date():new Date(nowValue);
    if(!Number.isFinite(now.getTime()))throw new Error("Invalid analysis window end");
    const p=jstParts(now);
    const targetYear=p.year-1;
    const day=Math.min(p.day,daysInMonth(targetYear,p.month));
    // JSTの同月同日同時刻を1年前へ戻し、UTC instantへ変換する。
    return new Date(Date.UTC(targetYear,p.month-1,day,p.hour-9,p.minute,p.second));
  }

  async function fetchSnapshots(sb,communityId,cutoffIso){
    const rows=[];
    for(let page=0;page<MAX_SNAPSHOT_PAGES;page++){
      const from=page*PAGE_SIZE,to=from+PAGE_SIZE-1;
      const r=await sb.from("meetup_metric_snapshots")
        .select("meetup_id,rsvp_count,checkin_count,observed_at,source")
        .eq("community_id",communityId)
        .gte("observed_at",cutoffIso)
        .order("observed_at",{ascending:true})
        .range(from,to);
      if(r.error)throw r.error;
      const chunk=r.data||[];
      rows.push(...chunk);
      if(chunk.length<PAGE_SIZE)return {rows,truncated:false};
    }
    return {rows,truncated:true};
  }

  async function loadCommunity12Months(communityId,options){
    const core=window.CAReachReactionR1;
    if(!core||typeof core.analyzeCommunityData!=="function")throw new Error("Reach Reaction R1 is not available");
    const sb=getClient();
    if(!sb)throw new Error("Supabase client is not available");
    if(!communityId)throw new Error("communityId is required");

    options=options||{};
    const now=options.now==null?new Date():new Date(options.now);
    if(!Number.isFinite(now.getTime()))throw new Error("Invalid analysis time");
    const cutoff=cutoffFor(now);
    const cutoffIso=cutoff.toISOString();

    const meetupResult=await sb.from("meetups")
      .select("id,title,starts_at,ends_at,campfire_created_at,rsvp_count,checkin_count")
      .eq("community_id",communityId)
      .gte("campfire_created_at",cutoffIso)
      .lte("campfire_created_at",now.toISOString())
      .order("campfire_created_at",{ascending:false,nullsFirst:false})
      .limit(1000);
    if(meetupResult.error)throw meetupResult.error;

    const snapshotResult=await fetchSnapshots(sb,communityId,cutoffIso);
    const result=core.analyzeCommunityData(meetupResult.data||[],snapshotResult.rows,{...options,now:now.toISOString()});
    result.communityId=communityId;
    result.analysisWindow={
      months:WINDOW_MONTHS,
      label:"直近12か月",
      timeZone:"Asia/Tokyo",
      startsAt:cutoffIso,
      endsAt:now.toISOString()
    };
    result.summary.analysisWindowMonths=WINDOW_MONTHS;
    result.summary.analysisWindowLabel="直近12か月";
    result.summary.analysisWindowStart=cutoffIso;
    result.summary.analysisWindowEnd=now.toISOString();
    result.snapshotRows=snapshotResult.rows.length;
    result.snapshotRowsTruncated=snapshotResult.truncated;
    return result;
  }

  // Deduplicate simultaneous R2/R3/R4 reads on mobile without retaining user data.
  function sharedLoadCommunity(communityId,options){
    if(options&&Object.keys(options).length)return loadCommunity12Months(communityId,options);
    const existing=pendingLoads.get(communityId);
    if(existing)return existing;
    const promise=loadCommunity12Months(communityId).finally(function(){
      if(pendingLoads.get(communityId)===promise)pendingLoads.delete(communityId);
    });
    pendingLoads.set(communityId,promise);
    return promise;
  }

  function install(){
    const core=window.CAReachReactionR1;
    if(!core)return false;
    core.loadCommunity=sharedLoadCommunity;
    core.ANALYSIS_WINDOW_MONTHS=WINDOW_MONTHS;
    core.ANALYSIS_WINDOW_LABEL="直近12か月";
    return true;
  }

  if(!install()){
    let attempts=0;
    const timer=setInterval(function(){
      attempts++;
      if(install()||attempts>=50)clearInterval(timer);
    },100);
  }

  window.CAReachReactionWindow12={VERSION,WINDOW_MONTHS,cutoffFor,loadCommunity:sharedLoadCommunity};
})();