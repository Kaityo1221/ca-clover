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
  let mountToken=0;

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

  function fmtDateTime(value){
    const d=new Date(value);
    if(!Number.isFinite(d.getTime()))return "—";
    return new Intl.DateTimeFormat("ja-JP",{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit",hour12:false}).format(d);
  }

  function fmtMeetupLabel(meetup){
    const d=new Date(meetup.starts_at);
    const date=Number.isFinite(d.getTime())?(d.getMonth()+1)+"/"+d.getDate():"日付不明";
    return date+"  "+(meetup.title||"Meetup");
  }

  function ensureStyle(){
    if(document.getElementById("caReachPhase7Style"))return;
    const style=document.createElement("style");
    style.id="caReachPhase7Style";
    style.textContent=`
      .reach7-wrap,.reach7-picker,#reach7Root,#reach7Body{width:100%;max-width:100%;min-width:0;box-sizing:border-box}
      .reach7-wrap{display:grid;gap:18px;overflow-x:hidden}
      .reach7-picker{display:grid;gap:8px}
      .reach7-picker label{font-size:11px;font-weight:950;color:#64748b}
      .reach7-select{width:100%;max-width:100%;min-width:0;border:1px solid #ddd6fe;border-radius:16px;padding:13px 14px;background:#fff;color:#4338ca;font-weight:900;outline:none}
      .reach7-select:focus{border-color:#a78bfa;box-shadow:0 0 0 4px rgba(167,139,250,.13)}
      .reach7-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;width:100%;min-width:0}
      .reach7-metric{min-width:0;border:1px solid #ede9fe;border-radius:18px;padding:14px;background:linear-gradient(145deg,#fff,#faf5ff);overflow:hidden}
      .reach7-metric span{display:block;font-size:10px;font-weight:950;color:#7c3aed}
      .reach7-metric b{display:block;margin-top:5px;font-size:23px;color:#4c1d95;letter-spacing:-.02em}
      .reach7-meta{display:flex;gap:8px;flex-wrap:wrap;align-items:center;min-width:0}
      .reach7-badge{display:inline-flex;align-items:center;border-radius:999px;padding:6px 10px;font-size:11px;font-weight:950;background:#f5f3ff;color:#6d28d9;border:1px solid #ddd6fe}
      .reach7-badge.partial{background:#fff7ed;color:#c2410c;border-color:#fed7aa}
      .reach7-checkpoint-title{margin:0;color:#4c1d95;font-size:17px;font-weight:950}
      .reach7-checkpoints{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;padding-bottom:2px;width:100%;min-width:0}
      .reach7-checkpoint{border:1px solid #ddd6fe;border-radius:16px;padding:11px 12px;background:#fff;min-width:0;overflow:hidden}
      .reach7-checkpoint .label{font-size:10px;font-weight:950;color:#7c3aed}.reach7-checkpoint .value{font-size:20px;font-weight:950;color:#4c1d95;margin-top:4px}.reach7-checkpoint .sub{font-size:9px;font-weight:850;color:#94a3b8;margin-top:3px;white-space:normal;overflow-wrap:anywhere}
      .reach7-checkpoint.pending{background:#f8fafc;border-color:#e2e8f0}.reach7-checkpoint.pending .label,.reach7-checkpoint.pending .value{color:#64748b}
      .reach7-chartbox{width:100%;max-width:100%;min-width:0;overflow:hidden;border:1px solid #ede9fe;border-radius:20px;background:#fff;margin-top:12px}
      .reach7-svg{display:block;width:100%;max-width:100%;min-width:0;height:auto}
      .reach7-note{font-size:11px;font-weight:850;color:#64748b;line-height:1.65;margin-top:10px;overflow-wrap:anywhere}
      .reach7-empty{padding:18px;border:1px dashed #c4b5fd;border-radius:18px;background:#faf5ff;color:#6d28d9;font-size:12px;font-weight:900;line-height:1.7;overflow-wrap:anywhere}
      @media(max-width:760px){
        .reach7-metric{padding:12px}.reach7-metric b{font-size:21px}
        .reach7-checkpoints{grid-template-columns:repeat(2,minmax(0,1fr))}
        .reach7-checkpoints>.reach7-checkpoint:last-child:nth-child(odd){grid-column:1/-1}
      }
    `;
    document.head.appendChild(style);
  }

  function checkpointTarget(checkpoint,meetup){
    const start=new Date(meetup.starts_at).getTime();
    const created=meetup.campfire_created_at?new Date(meetup.campfire_created_at).getTime():NaN;
    if(checkpoint.kind==="after-create")return Number.isFinite(created)?created+checkpoint.offset:NaN;
    return Number.isFinite(start)?start+checkpoint.offset:NaN;
  }

  function nearestRow(rows,target){
    let best=null,bestDiff=Infinity;
    rows.forEach(function(row){
      const diff=Math.abs(row.time-target);
      if(diff<bestDiff){best=row;bestDiff=diff}
    });
    return {row:best,diff:bestDiff};
  }

  function checkpointData(rows,meetup){
    const now=Date.now();
    const start=new Date(meetup.starts_at).getTime();
    const created=meetup.campfire_created_at?new Date(meetup.campfire_created_at).getTime():NaN;
    return CHECKPOINTS.map(function(checkpoint){
      const target=checkpointTarget(checkpoint,meetup);
      if(!Number.isFinite(target))return {...checkpoint,target,state:"unknown"};
      if(checkpoint.kind==="after-create"&&Number.isFinite(start)&&target>start)return {...checkpoint,target,state:"not-applicable"};
      if(Number.isFinite(created)&&target<created)return {...checkpoint,target,state:"before-create"};
      if(target>now)return {...checkpoint,target,state:"future"};
      const nearest=nearestRow(rows,target);
      if(!nearest.row||nearest.diff>checkpoint.tolerance)return {...checkpoint,target,state:"missing"};
      return {
        ...checkpoint,
        target,
        state:"observed",
        row:nearest.row,
        diff:nearest.diff,
        approx:nearest.diff>15*60*1000
      };
    });
  }

  function checkpointCardHtml(item){
    if(item.state==="observed"){
      return '<div class="reach7-checkpoint"><div class="label">'+esc(item.label)+'</div><div class="value">'+(item.approx?'≈':'')+item.row.rsvp.toLocaleString("ja-JP")+'</div><div class="sub">観測 '+esc(fmtDateTime(item.row.observed_at))+'</div></div>';
    }
    const text=item.state==="future"?"まだ":item.state==="before-create"?"未作成":item.state==="not-applicable"?"対象外":item.state==="missing"?"記録なし":"不明";
    const sub=item.state==="future"?"チェックポイント未到達":item.state==="before-create"?"Meetup作成前":item.state==="not-applicable"?"開催まで24時間未満":item.state==="missing"?"近い実測値なし":"時刻を判定できません";
    return '<div class="reach7-checkpoint pending"><div class="label">'+esc(item.label)+'</div><div class="value">'+esc(text)+'</div><div class="sub">'+esc(sub)+'</div></div>';
  }

  function chartHtml(points,meetup){
    if(!points.length)return '<div class="reach7-empty">このMeetupはまだRSVPの観測データがありません。</div>';

    const rows=points.map(function(p){
      return {time:new Date(p.observed_at).getTime(),rsvp:Number(p.rsvp_count)||0,checkin:Number(p.checkin_count)||0,observed_at:p.observed_at};
    }).filter(function(p){return Number.isFinite(p.time)}).sort(function(a,b){return a.time-b.time});
    if(!rows.length)return '<div class="reach7-empty">表示できる観測データがありません。</div>';

    const checkpoints=checkpointData(rows,meetup);
    const W=900,H=300,L=55,R=24,T=28,B=48,PW=W-L-R,PH=H-T-B;
    const minX=rows[0].time,maxX=rows[rows.length-1].time;
    const xSpan=Math.max(1,maxX-minX);
    const maxY=Math.max(1,...rows.map(function(r){return r.rsvp}));
    const x=function(v){return L+((v-minX)/xSpan)*PW};
    const y=function(v){return T+PH-(v/maxY)*PH};
    const labelEvery=rows.length<=8?1:Math.ceil(rows.length/6);
    let svg='<svg class="reach7-svg" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="RSVPの伸び">';
    svg+='<rect width="'+W+'" height="'+H+'" fill="white"/>';
    for(let i=0;i<5;i++){
      const ratio=i/4,yy=T+PH-ratio*PH;
      svg+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+yy+'" y2="'+yy+'" stroke="#ede9fe" stroke-dasharray="'+(i===0?'0':'4 5')+'"/>';
      svg+='<text x="'+(L-9)+'" y="'+(yy+4)+'" text-anchor="end" font-size="10" fill="#7c3aed">'+Math.round(maxY*ratio)+'</text>';
    }
    const line=rows.map(function(r){return x(r.time).toFixed(1)+','+y(r.rsvp).toFixed(1)});
    if(line.length>1)svg+='<polyline points="'+line.join(' ')+'" fill="none" stroke="#8b5cf6" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>';
    rows.forEach(function(r,i){
      const xx=x(r.time),yy=y(r.rsvp);
      svg+='<circle cx="'+xx.toFixed(1)+'" cy="'+yy.toFixed(1)+'" r="5" fill="#8b5cf6" stroke="white" stroke-width="2"><title>'+esc(fmtDateTime(r.observed_at)+' RSVP '+r.rsvp)+'</title></circle>';
      if(i%labelEvery===0||i===rows.length-1){
        svg+='<text x="'+xx.toFixed(1)+'" y="'+(H-20)+'" text-anchor="middle" font-size="10" font-weight="800" fill="#64748b">'+esc(fmtDateTime(r.observed_at))+'</text>';
      }
    });
    checkpoints.filter(function(item){return item.state==="observed"&&item.row}).forEach(function(item,index){
      const xx=x(item.row.time),yy=y(item.row.rsvp),labelY=34+(index%2)*14;
      svg+='<line x1="'+xx.toFixed(1)+'" x2="'+xx.toFixed(1)+'" y1="'+(T+8)+'" y2="'+(T+PH)+'" stroke="#c4b5fd" stroke-width="1.5" stroke-dasharray="5 5"/>';
      svg+='<circle cx="'+xx.toFixed(1)+'" cy="'+yy.toFixed(1)+'" r="8" fill="white" stroke="#6d28d9" stroke-width="2.5"><title>'+esc(item.label+' '+(item.approx?'約 ':'')+item.row.rsvp+' RSVP')+'</title></circle>';
      svg+='<text x="'+xx.toFixed(1)+'" y="'+labelY+'" text-anchor="middle" font-size="9" font-weight="950" fill="#6d28d9">'+esc(item.label)+'</text>';
    });
    svg+='<text x="'+L+'" y="16" font-size="11" font-weight="900" fill="#6d28d9">RSVP</text></svg>';

    const first=rows[0],last=rows[rows.length-1];
    const latestCheckin=rows.reduce(function(value,row){return Math.max(value,row.checkin)},0);
    const growth=last.rsvp-first.rsvp;
    const created=meetup.campfire_created_at?new Date(meetup.campfire_created_at).getTime():NaN;
    const partial=Number.isFinite(created)&&first.time-created>6*60*60*1000;
    const status=!Number.isFinite(created)?"作成時刻不明":partial?"途中から蓄積":"作成後から観測";

    return '<div class="reach7-wrap">'+
      '<div class="reach7-meta"><span class="reach7-badge '+(partial?'partial':'')+'">'+esc(status)+'</span><span class="reach7-badge">実測 '+rows.length+'点</span><span class="reach7-badge">開催 '+esc(fmtDateTime(meetup.starts_at))+'</span></div>'+
      '<div class="reach7-summary">'+
        '<div class="reach7-metric"><span>初回観測</span><b>'+first.rsvp.toLocaleString("ja-JP")+'</b></div>'+
        '<div class="reach7-metric"><span>最新RSVP</span><b>'+last.rsvp.toLocaleString("ja-JP")+'</b></div>'+
        '<div class="reach7-metric"><span>観測内の伸び</span><b>'+(growth>=0?'+':'')+growth.toLocaleString("ja-JP")+'</b></div>'+
        '<div class="reach7-metric"><span>Check-in</span><b>'+latestCheckin.toLocaleString("ja-JP")+'</b></div>'+
      '</div>'+
      '<div><h3 class="reach7-checkpoint-title">⏱ RSVPチェックポイント</h3><p class="muted small strong" style="margin:5px 0 9px">告知後と開催前の節目で、RSVPがどこまで伸びたかを確認</p><div class="reach7-checkpoints">'+checkpoints.map(checkpointCardHtml).join('')+'</div></div>'+
      '<div><h2 style="font-size:19px">📣 RSVPの伸び</h2><p class="muted small strong" style="margin:5px 0 0">実際に取得したスナップショットを時系列で表示</p><div class="reach7-chartbox">'+svg+'</div><div class="reach7-note">※「≈」はチェックポイント時刻と観測時刻に15分以上の差がある値です。近い観測がない場合は「記録なし」と表示します。</div></div>'+
    '</div>';
  }

  async function loadReach(root,token){
    const sb=getClient();
    const id=communityId();
    if(!sb||!id)return;
    root.innerHTML='<div class="reach7-empty">Reachデータを読み込み中...</div>';

    try{
      const snapshotResult=await sb.from("meetup_metric_snapshots")
        .select("meetup_id,rsvp_count,checkin_count,observed_at")
        .eq("community_id",id)
        .order("observed_at",{ascending:false})
        .limit(2000);
      if(snapshotResult.error)throw snapshotResult.error;
      if(token!==mountToken)return;

      const snapshots=snapshotResult.data||[];
      const ids=[...new Set(snapshots.map(function(row){return row.meetup_id}).filter(Boolean))];
      if(!ids.length){
        root.innerHTML='<div class="reach7-empty">まだReach用のRSVP履歴がありません。スナップショットが貯まるとここに表示されます。</div>';
        return;
      }

      const meetupResult=await sb.from("meetups")
        .select("id,title,starts_at,ends_at,campfire_created_at,rsvp_count,checkin_count,campfire_live_event_name")
        .in("id",ids)
        .order("starts_at",{ascending:false});
      if(meetupResult.error)throw meetupResult.error;
      if(token!==mountToken)return;

      const byMeetup=new Map();
      snapshots.forEach(function(row){
        const list=byMeetup.get(row.meetup_id)||[];
        list.push(row);
        byMeetup.set(row.meetup_id,list);
      });
      const meetups=(meetupResult.data||[]).filter(function(m){return (byMeetup.get(m.id)||[]).length>0});
      if(!meetups.length){
        root.innerHTML='<div class="reach7-empty">表示できるMeetupがありません。</div>';
        return;
      }

      const now=Date.now();
      const future=meetups.filter(function(m){const t=new Date(m.starts_at).getTime();return Number.isFinite(t)&&t>=now}).sort(function(a,b){return new Date(a.starts_at)-new Date(b.starts_at)});
      const initial=(future[0]||meetups[0]).id;

      root.innerHTML='<div class="reach7-picker"><label for="reach7MeetupSelect">Meetupを選択</label><select id="reach7MeetupSelect" class="reach7-select">'+meetups.map(function(m){return '<option value="'+esc(m.id)+'" '+(m.id===initial?'selected':'')+'>'+esc(fmtMeetupLabel(m))+'</option>'}).join('')+'</select></div><div id="reach7Body" class="section"></div>';
      const select=root.querySelector("#reach7MeetupSelect");
      const body=root.querySelector("#reach7Body");

      function renderSelected(){
        const meetup=meetups.find(function(m){return m.id===select.value})||meetups[0];
        body.innerHTML=chartHtml(byMeetup.get(meetup.id)||[],meetup);
      }
      select.addEventListener("change",renderSelected);
      renderSelected();
    }catch(err){
      console.warn("Reach failed",err);
      root.innerHTML='<div class="reach7-empty">Reachデータの読み込みに失敗しました。少し時間を置いて再度開いてください。</div>';
    }
  }

  function mount(){
    const feature=document.querySelector('.feature-app.reach.on');
    const head=document.getElementById("communityFeaturePanel");
    if(!feature||!head)return;
    const current=head.nextElementSibling;
    if(!current||!current.matches("section.card.section"))return;
    if(current.dataset.reachPhase7==="1")return;

    ensureStyle();
    current.dataset.reachPhase7="1";
    current.innerHTML='<h2>📣 Reach</h2><p class="muted strong">Meetup作成後のRSVPの伸びを確認します。</p><div id="reach7Root" class="section"></div>';
    const root=current.querySelector("#reach7Root");
    const token=++mountToken;
    void loadReach(root,token);
  }

  const observer=new MutationObserver(function(){mount()});
  observer.observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener("DOMContentLoaded",mount,{once:true});
  mount();
})();
