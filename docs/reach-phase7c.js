(function(){
  "use strict";

  const SUPABASE_URL="https://wgiittrvgtiosogyhfcl.supabase.co";
  const SUPABASE_KEY="sb_publishable_QTCqijfNvnysUTMylNIyTA_6ngosaPN";
  const HOUR=60*60*1000;
  const CHECKPOINTS=[
    {key:"plus24",label:"+24h",kind:"after-create",offset:24*HOUR,tolerance:12*HOUR},
    {key:"minus3d",label:"3日前",kind:"before-start",offset:-72*HOUR,tolerance:12*HOUR},
    {key:"minus1d",label:"前日",kind:"before-start",offset:-24*HOUR,tolerance:12*HOUR},
    {key:"minus1h",label:"1時間前",kind:"before-start",offset:-1*HOUR,tolerance:2*HOUR},
    {key:"start",label:"開催時",kind:"before-start",offset:0,tolerance:2*HOUR}
  ];
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
    if(document.getElementById("caReachPhase7CStyle"))return;
    const style=document.createElement("style");
    style.id="caReachPhase7CStyle";
    style.textContent=`
      .reach7c{margin-top:18px;padding-top:18px;border-top:1px solid #ede9fe;width:100%;max-width:100%;min-width:0;box-sizing:border-box;overflow-x:clip}
      .reach7c-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap;min-width:0}
      .reach7c-title{margin:0;color:#4c1d95;font-size:18px;font-weight:950;overflow-wrap:anywhere}
      .reach7c-sub{margin:5px 0 0;color:#64748b;font-size:11px;font-weight:850;line-height:1.6;overflow-wrap:anywhere}
      .reach7c-pill{display:inline-flex;align-items:center;border-radius:999px;padding:6px 10px;background:#f5f3ff;border:1px solid #ddd6fe;color:#6d28d9;font-size:10px;font-weight:950;white-space:nowrap}
      .reach7c-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin-top:12px;width:100%;max-width:100%;min-width:0}
      .reach7c-card{border:1px solid #ede9fe;border-radius:16px;padding:11px;background:linear-gradient(145deg,#fff,#faf5ff);min-width:0;max-width:100%;overflow:hidden}
      .reach7c-card.pending{background:#f8fafc;border-color:#e2e8f0}
      .reach7c-label{font-size:10px;font-weight:950;color:#7c3aed}
      .reach7c-current{font-size:19px;font-weight:950;color:#4c1d95;margin-top:5px;overflow-wrap:anywhere}
      .reach7c-base{font-size:10px;font-weight:850;color:#64748b;margin-top:5px;line-height:1.45;overflow-wrap:anywhere}
      .reach7c-diff{font-size:11px;font-weight:950;margin-top:4px;color:#475569;overflow-wrap:anywhere}
      .reach7c-card.pending .reach7c-base,.reach7c-card.pending .reach7c-diff{color:#94a3b8}
      .reach7c-empty{margin-top:12px;padding:13px 14px;border:1px dashed #c4b5fd;border-radius:16px;background:#faf5ff;color:#6d28d9;font-size:11px;font-weight:850;line-height:1.65;overflow-wrap:anywhere}
      .reach7c-pattern{margin-top:10px;padding:12px 14px;border-radius:16px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;font-size:11px;font-weight:900;line-height:1.65;overflow-wrap:anywhere}
      @media(max-width:760px){.reach7c-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.reach7c-card:last-child{grid-column:1/-1}}
    `;
    document.head.appendChild(style);
  }

  function normalizeRows(rows){
    return (rows||[]).map(function(row){
      return {time:new Date(row.observed_at).getTime(),rsvp:Number(row.rsvp_count)||0,observed_at:row.observed_at};
    }).filter(function(row){return Number.isFinite(row.time)}).sort(function(a,b){return a.time-b.time});
  }

  function targetTime(checkpoint,meetup){
    const start=new Date(meetup.starts_at).getTime();
    const created=meetup.campfire_created_at?new Date(meetup.campfire_created_at).getTime():NaN;
    if(checkpoint.kind==="after-create")return Number.isFinite(created)?created+checkpoint.offset:NaN;
    return Number.isFinite(start)?start+checkpoint.offset:NaN;
  }

  function checkpointValue(rows,checkpoint,meetup,ignoreFuture){
    const target=targetTime(checkpoint,meetup);
    if(!Number.isFinite(target))return null;
    const start=new Date(meetup.starts_at).getTime();
    const created=meetup.campfire_created_at?new Date(meetup.campfire_created_at).getTime():NaN;
    if(checkpoint.kind==="after-create"&&Number.isFinite(start)&&target>start)return null;
    if(Number.isFinite(created)&&target<created)return null;
    if(!ignoreFuture&&target>Date.now())return null;
    let best=null,bestDiff=Infinity;
    rows.forEach(function(row){
      const diff=Math.abs(row.time-target);
      if(diff<bestDiff){best=row;bestDiff=diff}
    });
    if(!best||bestDiff>checkpoint.tolerance)return null;
    return {value:best.rsvp,target,row:best,diff:bestDiff};
  }

  function median(values){
    const list=values.filter(Number.isFinite).sort(function(a,b){return a-b});
    if(!list.length)return null;
    const mid=Math.floor(list.length/2);
    return list.length%2?list[mid]:(list[mid-1]+list[mid])/2;
  }

  function fmtValue(value){
    if(value==null||!Number.isFinite(value))return "—";
    return Number.isInteger(value)?value.toLocaleString("ja-JP"):value.toFixed(1);
  }

  function fmtDiff(value){
    if(value==null||!Number.isFinite(value))return "比較不可";
    const rounded=Math.abs(value-Math.round(value))<0.05?Math.round(value):Number(value.toFixed(1));
    return (rounded>0?"+":"")+rounded.toLocaleString("ja-JP");
  }

  function growthPattern(selectedRows,meetup){
    const observed=CHECKPOINTS.map(function(cp){
      const hit=checkpointValue(selectedRows,cp,meetup,false);
      return hit?{label:cp.label,target:hit.target,value:hit.value}:null;
    }).filter(Boolean).sort(function(a,b){return a.target-b.target});
    if(observed.length<2)return "";
    let best=null;
    for(let i=1;i<observed.length;i++){
      const delta=observed[i].value-observed[i-1].value;
      if(delta<=0)continue;
      if(!best||delta>best.delta)best={from:observed[i-1],to:observed[i],delta};
    }
    if(!best)return "";
    return '今回もっともRSVPが増えた観測区間は「'+esc(best.from.label)+' → '+esc(best.to.label)+'」で、+'+best.delta.toLocaleString("ja-JP")+'でした。';
  }

  function renderComparison(select){
    if(!model)return;
    const body=document.getElementById("reach7Body");
    if(!body)return;
    const old=body.querySelector("#reach7Compare");
    if(old)old.remove();

    const selected=model.meetupById.get(select.value);
    if(!selected)return;
    const selectedRows=model.rowsByMeetup.get(selected.id)||[];
    const selectedStart=new Date(selected.starts_at).getTime();
    const now=Date.now();
    const candidates=model.meetups.filter(function(m){
      if(m.id===selected.id)return false;
      const start=new Date(m.starts_at).getTime();
      return Number.isFinite(start)&&start<now&&start<selectedStart;
    }).sort(function(a,b){return new Date(b.starts_at)-new Date(a.starts_at)}).slice(0,8);

    const comparison=document.createElement("section");
    comparison.id="reach7Compare";
    comparison.className="reach7c";

    if(!candidates.length){
      comparison.innerHTML='<div class="reach7c-head"><div><h3 class="reach7c-title">📊 過去Meetupとの比較</h3><p class="reach7c-sub">同じCommunityの過去Meetupと、同じチェックポイントで比べます。</p></div></div><div class="reach7c-empty">比較できる過去Meetupの蓄積がまだありません。データが増えると自動で比較できるようになります。</div>';
      body.appendChild(comparison);
      return;
    }

    const cards=CHECKPOINTS.map(function(cp){
      const currentHit=checkpointValue(selectedRows,cp,selected,false);
      const baseValues=[];
      candidates.forEach(function(m){
        const hit=checkpointValue(model.rowsByMeetup.get(m.id)||[],cp,m,true);
        if(hit)baseValues.push(hit.value);
      });
      const base=median(baseValues);
      const current=currentHit?currentHit.value:null;
      const diff=current!=null&&base!=null?current-base:null;
      if(!baseValues.length){
        return '<div class="reach7c-card pending"><div class="reach7c-label">'+esc(cp.label)+'</div><div class="reach7c-current">今回 '+esc(fmtValue(current))+'</div><div class="reach7c-base">過去データ 蓄積中</div><div class="reach7c-diff">比較できる記録なし</div></div>';
      }
      return '<div class="reach7c-card"><div class="reach7c-label">'+esc(cp.label)+'</div><div class="reach7c-current">今回 '+esc(fmtValue(current))+'</div><div class="reach7c-base">過去中央値 '+esc(fmtValue(base))+'<br>比較 '+baseValues.length+'件</div><div class="reach7c-diff">差 '+esc(fmtDiff(diff))+'</div></div>';
    }).join("");

    const pattern=growthPattern(selectedRows,selected);
    comparison.innerHTML='<div class="reach7c-head"><div><h3 class="reach7c-title">📊 過去Meetupとの比較</h3><p class="reach7c-sub">同じCommunityの直近の過去Meetupを、チェックポイントごとの中央値で比較します。</p></div><span class="reach7c-pill">最大 '+candidates.length+'件</span></div><div class="reach7c-grid">'+cards+'</div>'+(pattern?'<div class="reach7c-pattern">'+pattern+'</div>':'');
    body.appendChild(comparison);
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
      model={meetups,rowsByMeetup,meetupById:new Map(meetups.map(function(m){return [m.id,m]}))};
      renderComparison(select);
    }catch(err){
      console.warn("Reach comparison failed",err);
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
      setTimeout(function(){renderComparison(select)},0);
    });
    void loadModel(select);
  }

  const observer=new MutationObserver(function(){mount()});
  observer.observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener("DOMContentLoaded",mount,{once:true});
  mount();
})();
