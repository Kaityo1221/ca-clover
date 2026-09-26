from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"pattern not found: {label}")
    return text.replace(old, new, 1)


monthly = Path("docs/monthly-clover.js")
s = monthly.read_text(encoding="utf-8")
s = replace_once(
    s,
    '  function hostStage(count){return count<=0?0:count===1?1:count===2?2:count===3?3:4}\n  function joinStage(count){return count<=0?0:count<5?1:count<15?2:count<30?3:4}\n  function exchangeStage(count){return count<=0?0:count===1?1:count===2?2:count<5?3:4}\n  function continueStage(count){return count<=0?0:count===1?1:count===2?2:count===3?3:4}',
    '  function hostStage(count){return count<=0?0:count<3?1:count<5?2:count<8?3:4}\n  function joinStage(count){return count<=0?0:count<50?1:count<200?2:count<500?3:4}\n  function exchangeStage(count){return count<=0?0:count<2?1:count<4?2:count<6?3:4}\n  function continueStage(count){return count<=0?0:count===1?1:count===2?2:count===3?3:4}',
    "stage thresholds",
)
monthly.write_text(s, encoding="utf-8")


home = Path("docs/home-clover.js")
s = home.read_text(encoding="utf-8")
s = replace_once(
    s,
    'script.src="./monthly-clover.js?v=20260926-growth1";',
    'script.src="./monthly-clover.js?v=20260926-stage2";',
    "monthly cache version",
)

start = s.index('  async function loadModel(sb,uid,communityId,totalCommunities){')
end = s.index('\n  function weeklyMetric(', start)
new_load_model = r'''  async function loadModel(sb,uid,communityId,totalCommunities){
    const now=new Date();
    const monthStart=startOfMonth(now),monthEnd=startOfNextMonth(now);
    const weekStart=startOfWeek(now),weekEnd=endOfWeek(now);
    const [meetupResult,firstExchangeResult,allCollectionsResult,communityResult]=await Promise.all([
      sb.from("meetups")
        .select("id,title,starts_at,checkin_count,rsvp_count,is_ca_meetup")
        .eq("community_id",communityId)
        .gte("starts_at",monthStart.toISOString())
        .lt("starts_at",monthEnd.toISOString())
        .order("starts_at",{ascending:true}),
      sb.from("stamp_collections")
        .select("id,stamp_ca_member_id,community_id,first_acquired_at,first_event_name,first_location")
        .eq("owner_user_id",uid)
        .gte("first_acquired_at",monthStart.toISOString())
        .lt("first_acquired_at",monthEnd.toISOString())
        .order("first_acquired_at",{ascending:true}),
      sb.from("stamp_collections")
        .select("id,stamp_ca_member_id")
        .eq("owner_user_id",uid),
      sb.from("communities").select("id,name,avatar_url").eq("id",communityId).maybeSingle()
    ]);
    if(meetupResult.error)throw meetupResult.error;

    const meetups=meetupResult.data||[];
    const firstExchanges=firstExchangeResult.error?[]:(firstExchangeResult.data||[]);
    const allCollections=allCollectionsResult.error?[]:(allCollectionsResult.data||[]);
    const collectionMember=new Map(allCollections.map(x=>[x.id,x.stamp_ca_member_id]));
    const collectionIds=allCollections.map(x=>x.id).filter(Boolean);
    let reunions=[];
    if(collectionIds.length){
      const reunionResult=await sb.from("stamp_reunions")
        .select("id,collection_id,met_at,local_date,timezone,location,event_name,reunion_source")
        .in("collection_id",collectionIds)
        .gte("met_at",monthStart.toISOString())
        .lt("met_at",monthEnd.toISOString())
        .order("met_at",{ascending:true});
      if(!reunionResult.error)reunions=reunionResult.data||[];
    }

    const localDateKey=value=>{
      const d=new Date(value);
      if(!Number.isFinite(d.getTime()))return "";
      return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
    };
    const exchangeEventMap=new Map();
    firstExchanges.forEach(x=>{
      if(!x.stamp_ca_member_id)return;
      const day=localDateKey(x.first_acquired_at);
      if(!day)return;
      const key=x.stamp_ca_member_id+"|"+day;
      if(!exchangeEventMap.has(key))exchangeEventMap.set(key,{
        id:x.id,
        stamp_ca_member_id:x.stamp_ca_member_id,
        occurred_at:x.first_acquired_at,
        local_date:day,
        event_name:x.first_event_name||null,
        location:x.first_location||null,
        kind:"first"
      });
    });
    reunions.forEach(r=>{
      const memberId=collectionMember.get(r.collection_id);
      if(!memberId)return;
      const day=r.local_date||localDateKey(r.met_at);
      if(!day)return;
      const key=memberId+"|"+day;
      if(!exchangeEventMap.has(key))exchangeEventMap.set(key,{
        id:r.id,
        stamp_ca_member_id:memberId,
        occurred_at:r.met_at,
        local_date:day,
        event_name:r.event_name||null,
        location:r.location||null,
        kind:"reunion"
      });
    });
    const exchangeEvents=[...exchangeEventMap.values()].sort((a,b)=>new Date(a.occurred_at)-new Date(b.occurred_at));

    const checkins=meetups.reduce((sum,m)=>sum+number(m.checkin_count),0);
    const activeWeeks=new Set(meetups.map(m=>weekKey(m.starts_at)).filter(Boolean)).size;
    const metrics={meetups:meetups.length,checkins,exchanges:exchangeEvents.length,activeWeeks};
    const stages=window.CAMonthlyClover.stagesFromMetrics(metrics);
    const weekMeetups=meetups.filter(m=>inRange(m.starts_at,weekStart,weekEnd));
    const weekExchanges=exchangeEvents.filter(x=>inRange(x.occurred_at,weekStart,weekEnd));
    const week={
      meetups:weekMeetups.length,
      checkins:weekMeetups.reduce((sum,m)=>sum+number(m.checkin_count),0),
      exchanges:weekExchanges.length,
      activeWeeks:weekMeetups.length?1:0,
      start:weekStart,end:new Date(weekEnd.getTime()-1)
    };
    const details={
      host:metrics.meetups?"今月 "+metrics.meetups+"回開催":"今月はまだ開催記録なし",
      join:metrics.checkins?"Check-in "+metrics.checkins.toLocaleString("ja-JP")+"人":"Check-in記録なし",
      exchange:metrics.exchanges?"交流 "+metrics.exchanges+"回":"今月はまだ交流記録なし",
      continue:activeWeeks?"活動した週 "+activeWeeks+"週":"今月はまだ活動週なし"
    };
    return {
      community:communityResult.data||{id:communityId,name:"Community",avatar_url:null},
      totalCommunities,now,monthStart,monthEnd,meetups,uniqueExchanges:firstExchanges,exchangeEvents,metrics,stages,week,details,
      exchangeShared:totalCommunities>1
    };
  }
'''
s = s[:start] + new_load_model + s[end:]

s = replace_once(
    s,
    '        weeklyMetric("exchange","+"+w.exchanges+"人",w.exchanges?"新しい交換":"交換なし")+',
    '        weeklyMetric("exchange","+"+w.exchanges+"回",w.exchanges?"交流":"交流なし")+',
    "weekly exchange label",
)

old_exchange_branch = '''    if(key==="exchange"){
      const note=model.exchangeShared?'<div class="home-clover-modal-row">※ 複数Community担当のため、交流はCAアカウント共通の記録です。</div>':"";
      return note+(model.uniqueExchanges.length?model.uniqueExchanges.map(x=>'<div class="home-clover-modal-row"><b>'+esc(new Date(x.first_acquired_at).toLocaleDateString("ja-JP"))+'</b>　'+esc(x.first_event_name||x.first_location||"CA Stamp Rally交換")+'</div>').join(""):'<div class="home-clover-modal-row">今月はまだ新しい交換記録がありません。</div>');
    }'''
new_exchange_branch = '''    if(key==="exchange"){
      const shared=model.exchangeShared?'<div class="home-clover-modal-row">※ 複数Community担当のため、交流はCAアカウント共通の記録です。</div>':"";
      const rule='<div class="home-clover-modal-row">同じ相手でも別日の交換・再会は交流として数えます。同じ相手・同じ日は1回です。</div>';
      const events=model.exchangeEvents||[];
      return shared+rule+(events.length?events.map(x=>'<div class="home-clover-modal-row"><b>'+esc(new Date(x.occurred_at).toLocaleDateString("ja-JP"))+'</b>　'+(x.kind==="reunion"?'再会':'初交換')+' ・ '+esc(x.event_name||x.location||"CA Stamp Rally交換")+'</div>').join(""):'<div class="home-clover-modal-row">今月はまだ交流記録がありません。</div>');
    }'''
s = replace_once(s, old_exchange_branch, new_exchange_branch, "exchange modal")
home.write_text(s, encoding="utf-8")


index = Path("docs/index.html")
s = index.read_text(encoding="utf-8")
s = replace_once(
    s,
    '<script src="./home-clover.js?v=20260926-growth1" defer></script>',
    '<script src="./home-clover.js?v=20260926-stage2" defer></script>',
    "home cache version",
)
index.write_text(s, encoding="utf-8")
