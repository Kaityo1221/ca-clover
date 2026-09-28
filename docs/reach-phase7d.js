(function(){
  "use strict";

  const SUPABASE_URL="https://wgiittrvgtiosogyhfcl.supabase.co";
  const SUPABASE_KEY="sb_publishable_QTCqijfNvnysUTMylNIyTA_6ngosaPN";
  const HOUR=60*60*1000;
  const DAY=24*HOUR;
  let client=null;
  let mountedSelect=null;
  let model=null;
  let loadToken=0;

  function getClient(){
    if(client)return client;
    if(!window.supabase)return null;
    client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{
      auth:{persistSession:true,autoRefreshToken:false,detectSessionInUrl:false}
    });
    return client;
  }

  function esc(v){
    return String(v==null?"":v).replace(/[&<>"']/g,function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c];
    });
  }

  function communityId(){
    const raw=(location.hash||"").slice(1);
    if(!raw.startsWith("community:"))return "";
    try{return decodeURIComponent(raw.slice("community:".length))}catch(_e){return raw.slice("community:".length)}
  }

  function ensureStyle(){
    if(document.getElementById("caReachPhase7DStyle"))return;
    const style=document.createElement("style");
    style.id="caReachPhase7DStyle";
    style.textContent=`
      .reach7d{width:100%;max-width:100%;min-width:0;padding:14px;border:1px solid #d9f99d;border-radius:18px;background:linear-gradient(145deg,#f7fee7,#fff);box-sizing:border-box}
      .reach7d-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap;min-width:0}
      .reach7d-title{margin:0;color:#365314;font-size:17px;font-weight:950}
      .reach7d-sub{margin:5px 0 0;color:#64748b;font-size:11px;font-weight:850;line-height:1.55}
      .reach7d-pill{display:inline-flex;align-items:center;border-radius:999px;padding:6px 9px;background:#ecfccb;border:1px solid #d9f99d;color:#4d7c0f;font-size:10px;font-weight:950;white-space:nowrap}
      .reach7d-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:12px;min-width:0}
      .reach7d-card{min-width:0;border:1px solid #e2e8f0;border-radius:15px;padding:11px;background:#fff;overflow:hidden}
      .reach7d-card.pending{background:#f8fafc}
      .reach7d-label{font-size:10px;font-weight:950;color:#64748b}
      .reach7d-value{margin-top:4px;font-size:20px;font-weight:950;color:#365314;overflow-wrap:anywhere}
      .reach7d-card.pending .reach7d-value{color:#64748b;font-size:16px}
      .reach7d-meta{margin-top:4px;font-size:9px;font-weight:850;color:#94a3b8;line-height:1.45;overflow-wrap:anywhere}
      .reach7d-next{margin-top:10px;padding:10px 12px;border-radius:14px;background:#fff;border:1px solid #ecfccb;color:#475569;font-size:11px;font-weight:900;line-height:1.55;overflow-wrap:anywhere}
      .reach7d-note{margin-top:8px;color:#64748b;font-size:10px;font-weight:850;line-height:1.55}
      .reach7d-ended{padding:12px 14px;border:1px dashed #cbd5e1;border-radius:16px;background:#f8fafc;color:#64748b;font-size:11px;font-weight:850;line-height:1.6}
      @media(max-width:760px){.reach7d-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
    `;
    document.head.appendChild(style);
  }

  function normalizeRows(rows){
    return (rows||[]).map(function(row){
      return {time:new Date(row.observed_at).getTime(),rsvp:Number(row.rsvp_count)||0,observed_at:row.observed_at};
    }).filter(function(row){return Number.isFinite(row.time)}).sort(function(a,b){return a.time-b.time});
  }

  function median(values){
    const list=values.filter(Number.isFinite).sort(function(a,b){return a-b});
    if(!list.length)return null;
    const mid=Math.floor(list.length/2);
    return list.length%2?list[mid]:(list[mid-1]+list[mid])/2;
  }

  function fmtNum(value){
    if(value==null||!Number.isFinite(value))return "—";
    return Number.isInteger(value)?value.toLocaleString("ja-JP"):value.toFixed(1);
  }

  function fmtDiff(value){
    if(value==null||!Number.isFinite(value))return "—";
    const rounded=Math.abs(value-Math.round(value))<0.05?Math.round(value):Number(value.toFixed(1));
    return (rounded>0?"+":"")+rounded.toLocaleString("ja-JP");
  }

  function nearestRow(rows,target,tolerance){
    let best=null,bestDiff=Infinity;
    rows.forEach(function(row){
      const diff=Math.abs(row.time-target);
      if(diff<bestDiff){best=row;bestDiff=diff}
    });
    return best&&bestDiff<=tolerance?{row:best,diff:bestDiff}:null;
  }

  function comparisonTolerance(remaining){
    if(remaining<=6*HOUR)return 90*60*1000;
    if(remaining<=DAY)return 4*HOUR;
    return 12*HOUR;
  }

  function sameStageMedian(selected,selectedRows){
    if(!selectedRows.length)return {median:null,count:0};
    const latest=selectedRows[selectedRows.length-1];
    const selectedStart=new Date(selected.starts_at).getTime();
    if(!Number.isFinite(selectedStart))return {median:null,count:0};
    const remaining=Math.max(0,selectedStart-latest.time);
    const tolerance=comparisonTolerance(remaining);
    const values=[];
    model.meetups.forEach(function(meetup){
      if(meetup.id===selected.id)return;
      const start=new Date(meetup.starts_at).getTime();
      if(!Number.isFinite(start)||start>=Date.now()||start>=selectedStart)return;
      const target=start-remaining;
      const created=meetup.campfire_created_at?new Date(meetup.campfire_created_at).getTime():NaN;
      if(Number.isFinite(created)&&target<created)return;
      const hit=nearestRow(model.rowsByMeetup.get(meetup.id)||[],target,tolerance);
      if(hit)values.push(hit.row.rsvp);
    });
    return {median:median(values),count:values.length};
  }

  function growth24h(rows){
    if(rows.length<2)return null;
    const latest=rows[rows.length-1];
    const hit=nearestRow(rows,latest.time-DAY,6*HOUR);
    if(!hit)return null;
    return latest.rsvp-hit.row.rsvp;
  }

  function nextCheckpoint(meetup){
    const now=Date.now();
    const start=new Date(meetup.starts_at).getTime();
    const created=meetup.campfire_created_at?new Date(meetup.campfire_created_at).getTime():NaN;
    if(!Number.isFinite(start)||start<=now)return null;
    const items=[];
    if(Number.isFinite(created))items.push({label:"+24h",time:created+DAY});
    items.push({label:"3日前",time:start-3*DAY});
    items.push({label:"前日",time:start-DAY});
    items.push({label:"1時間前",time:start-HOUR});
    items.push({label:"開催時",time:start});
    return items.filter(function(item){return item.time>now&&item.time<=start}).sort(function(a,b){return a.time-b.time})[0]||null;
  }

  function untilText(time){
    const diff=Math.max(0,time-Date.now());
    const hours=Math.floor(diff/HOUR);
    if(hours<1)return "1時間以内";
    if(hours<24)return "約"+hours+"時間後";
    const days=Math.floor(hours/24);
    const remain=hours%24;
    return remain?"約"+days+"日"+remain+"時間後":"約"+days+"日後";
  }

  function renderOps(select){
    if(!model)return;
    const body=document.getElementById("reach7Body");
    if(!body)return;
    const existing=body.querySelector("#reach7Ops");
    if(existing)existing.remove();

    const selected=model.meetupById.get(select.value);
    if(!selected)return;
    const rows=model.rowsByMeetup.get(selected.id)||[];
    if(!rows.length)return;
    const start=new Date(selected.starts_at).getTime();
    const wrap=body.querySelector(".reach7-wrap");
    if(!wrap)return;

    const section=document.createElement("section");
    section.id="reach7Ops";
    section.className="reach7d";

    if(!Number.isFinite(start)||start<=Date.now()){
      section.innerHTML='<div class="reach7d-ended">📡 開催前サマリーは開催前のMeetupで表示します。このMeetupは開催済みです。</div>';
    }else{
      const latest=rows[rows.length-1];
      const stage=sameStageMedian(selected,rows);
      const diff=stage.median==null?null:latest.rsvp-stage.median;
      const d24=growth24h(rows);
      const next=nextCheckpoint(selected);
      const hasComparison=stage.count>0&&stage.median!=null;
      const paceText=hasComparison
        ?(diff===0?"過去Meetupの同時期中央値と同じペースです。":diff>0?"過去Meetupの同時期中央値を "+fmtDiff(diff)+" 上回っています。":"過去Meetupの同時期中央値を "+Math.abs(diff).toLocaleString("ja-JP")+" 下回っています。")
        :"同時期の過去Meetupデータを蓄積中です。比較できる記録が増えると自動で表示します。";
      section.innerHTML='<div class="reach7d-head"><div><h3 class="reach7d-title">📡 開催前サマリー</h3><p class="reach7d-sub">いまのRSVPペースを、同じCommunityの過去Meetupと同じ「開催までの残り時間」で比べます。</p></div><span class="reach7d-pill">LIVE</span></div>'+
        '<div class="reach7d-grid">'+
          '<div class="reach7d-card"><div class="reach7d-label">現在RSVP</div><div class="reach7d-value">'+latest.rsvp.toLocaleString("ja-JP")+'</div><div class="reach7d-meta">最新観測値</div></div>'+
          '<div class="reach7d-card"><div class="reach7d-label">直近24h</div><div class="reach7d-value">'+(d24==null?'—':fmtDiff(d24))+'</div><div class="reach7d-meta">RSVPの増減</div></div>'+
          '<div class="reach7d-card '+(hasComparison?'':'pending')+'"><div class="reach7d-label">過去同時期中央値</div><div class="reach7d-value">'+(hasComparison?fmtNum(stage.median):'蓄積中')+'</div><div class="reach7d-meta">'+(hasComparison?'比較 '+stage.count+'件':'比較できる記録なし')+'</div></div>'+
          '<div class="reach7d-card '+(hasComparison?'':'pending')+'"><div class="reach7d-label">中央値との差</div><div class="reach7d-value">'+(hasComparison?fmtDiff(diff):'算出前')+'</div><div class="reach7d-meta">'+(hasComparison?'同時期との比較':'過去データ蓄積後に表示')+'</div></div>'+
        '</div>'+
        '<div class="reach7d-next">'+esc(paceText)+(next?'　次のチェックポイントは「'+esc(next.label)+'」で、'+esc(untilText(next.time))+'です。':'')+'</div>'+
        '<div class="reach7d-note">※ 比較は取得できたスナップショットだけを使用します。データが増えるほど比較精度が上がります。</div>';
    }

    const summary=wrap.querySelector(".reach7-summary");
    if(summary&&summary.nextSibling)wrap.insertBefore(section,summary.nextSibling);
    else wrap.appendChild(section);
  }

  async function loadModel(select){
    const sb=getClient();
    const id=communityId();
    if(!sb||!id)return;
    const token=++loadToken;
    try{
      const snapshotsResult=await sb.from("meetup_metric_snapshots")
        .select("meetup_id,rsvp_count,observed_at")
        .eq("community_id",id)
        .order("observed_at",{ascending:true})
        .limit(4000);
      if(snapshotsResult.error)throw snapshotsResult.error;
      if(token!==loadToken)return;
      const ids=[...new Set((snapshotsResult.data||[]).map(function(row){return row.meetup_id}).filter(Boolean))];
      if(!ids.length)return;
      const meetupResult=await sb.from("meetups")
        .select("id,title,starts_at,campfire_created_at")
        .in("id",ids);
      if(meetupResult.error)throw meetupResult.error;
      if(token!==loadToken)return;

      const rowsByMeetup=new Map();
      (snapshotsResult.data||[]).forEach(function(row){
        const list=rowsByMeetup.get(row.meetup_id)||[];
        list.push(row);
        rowsByMeetup.set(row.meetup_id,list);
      });
      rowsByMeetup.forEach(function(rows,key){rowsByMeetup.set(key,normalizeRows(rows))});
      const meetups=meetupResult.data||[];
      model={meetups:meetups,rowsByMeetup:rowsByMeetup,meetupById:new Map(meetups.map(function(m){return [m.id,m]}))};
      renderOps(select);
    }catch(err){
      console.warn("Reach Phase 7D failed",err);
    }
  }

  function mount(){
    const reachOn=document.querySelector('.feature-app.reach.on');
    const select=document.getElementById("reach7MeetupSelect");
    if(!reachOn||!select)return;
    ensureStyle();
    if(mountedSelect===select)return;

    mountedSelect=select;
    model=null;
    select.addEventListener("change",function(){
      setTimeout(function(){renderOps(select)},0);
    });
    void loadModel(select);
  }

  const observer=new MutationObserver(function(){mount()});
  observer.observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener("DOMContentLoaded",mount,{once:true});
  mount();
})();
