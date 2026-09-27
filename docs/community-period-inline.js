(function(){
  "use strict";

  const SUPABASE_URL="https://wgiittrvgtiosogyhfcl.supabase.co";
  const SUPABASE_KEY="sb_publishable_QTCqijfNvnysUTMylNIyTA_6ngosaPN";
  let client=null;
  const requestTokens={activity:0,growth:0,insights:0};

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

  function valueOf(button){
    return button.dataset.communityPeriod==="all"?null:Number(button.dataset.communityPeriod);
  }

  function periodLabel(period){
    if(period===30)return "1か月";
    if(period===90)return "3か月";
    if(period===180)return "6か月";
    if(period===365)return "1年";
    return "全期間";
  }

  function communityId(){
    const raw=(location.hash||"").slice(1);
    if(!raw.startsWith("community:"))return "";
    try{return decodeURIComponent(raw.slice("community:".length))}catch(_e){return raw.slice("community:".length)}
  }

  function currentFeature(){
    if(document.querySelector('.feature-app.activity.on'))return "activity";
    if(document.querySelector('.feature-app.growth.on'))return "growth";
    if(document.querySelector('.feature-app.insights.on'))return "insights";
    return "";
  }

  function setActiveButton(button){
    document.querySelectorAll("[data-community-period]").forEach(function(b){
      const active=b===button;
      b.classList.toggle("active",active);
      b.setAttribute("aria-pressed",active?"true":"false");
    });
  }

  function fade(panel){
    if(!panel)return;
    panel.style.transition="opacity .12s ease";
    panel.style.opacity=".55";
  }

  function restore(panel){
    if(panel)panel.style.opacity="1";
  }

  function activityBucket(period){
    if(period===30)return "day";
    if(period===90)return "week";
    if(period===null)return "year";
    return "month";
  }

  function activityUnit(bucket){
    if(bucket==="day")return "日別";
    if(bucket==="week")return "週別";
    if(bucket==="year")return "年別";
    return "月別";
  }

  function activityPointLabel(value,bucket,count){
    const p=String(value||"").slice(0,10).split("-").map(Number);
    const y=p[0]||0,m=p[1]||1,d=p[2]||1;
    if(bucket==="day"||bucket==="week")return m+"/"+d;
    if(bucket==="year")return String(y);
    return count>12?String(y).slice(-2)+"/"+m:m+"月";
  }

  function activityPanel(){
    const tagged=document.querySelector('[data-activity-chart="1"]');
    if(tagged)return tagged;
    return [...document.querySelectorAll("section.card.section")].find(function(section){
      const h=section.querySelector("h2");
      return h&&h.textContent.trim().includes("Activity推移");
    })||null;
  }

  function activityHtml(rows,bucket,label){
    rows=(rows||[]).map(function(r){
      return {bucket:r.bucket,meetup_count:Number(r.meetup_count)||0,checkin_count:Number(r.checkin_count)||0};
    });
    const W=900,H=290,L=48,R=62,T=25,B=46,PW=W-L-R,PH=H-T-B;
    const n=Math.max(1,rows.length),step=PW/n,barW=Math.min(25,Math.max(5,step*.34));
    const meetupMax=Math.max(1,...rows.map(function(r){return r.meetup_count}));
    const checkinMax=Math.max(1,...rows.map(function(r){return r.checkin_count}));
    const x=function(i){return L+step*i+step/2};
    const my=function(v){return T+PH-(v/meetupMax)*PH};
    const cy=function(v){return T+PH-(v/checkinMax)*PH};
    const every=rows.length<=14?1:Math.ceil(rows.length/10);
    let svg='<svg class="trendsvg" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(label+'のActivity推移')+'"><rect width="'+W+'" height="'+H+'" fill="white"/>';
    for(let i=0;i<5;i++){
      const ratio=i/4,y=T+PH-ratio*PH;
      svg+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+y+'" y2="'+y+'" stroke="#e5e7eb" stroke-dasharray="'+(i===0?'0':'4 5')+'"/>';
      svg+='<text x="'+(L-8)+'" y="'+(y+4)+'" text-anchor="end" font-size="10" fill="#64748b">'+Math.round(meetupMax*ratio)+'</text>';
      svg+='<text x="'+(W-R+8)+'" y="'+(y+4)+'" text-anchor="start" font-size="10" fill="#64748b">'+Math.round(checkinMax*ratio).toLocaleString("ja-JP")+'</text>';
    }
    const line=[];
    rows.forEach(function(r,i){
      const xx=x(i),yy=my(r.meetup_count),hh=T+PH-yy;
      svg+='<rect x="'+(xx-barW/2)+'" y="'+yy+'" width="'+barW+'" height="'+Math.max(0,hh)+'" rx="4" fill="#fcd34d"><title>'+esc(activityPointLabel(r.bucket,bucket,rows.length)+' Meetup '+r.meetup_count+'回')+'</title></rect>';
      if(i%every===0||i===rows.length-1)svg+='<text x="'+xx+'" y="'+(H-22)+'" text-anchor="middle" font-size="10" font-weight="700" fill="#475569">'+esc(activityPointLabel(r.bucket,bucket,rows.length))+'</text>';
      line.push(xx+','+cy(r.checkin_count));
    });
    if(line.length>1)svg+='<polyline points="'+line.join(' ')+'" fill="none" stroke="#65a30d" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>';
    rows.forEach(function(r,i){
      svg+='<circle cx="'+x(i)+'" cy="'+cy(r.checkin_count)+'" r="4" fill="#65a30d" stroke="white" stroke-width="2"><title>'+esc(activityPointLabel(r.bucket,bucket,rows.length)+' Check-in '+r.checkin_count.toLocaleString("ja-JP"))+'</title></circle>';
    });
    svg+='<text x="'+L+'" y="14" font-size="10" font-weight="800" fill="#b45309">Meetup回数</text><text x="'+(W-R)+'" y="14" text-anchor="end" font-size="10" font-weight="800" fill="#4d7c0f">Check-in数</text></svg>';
    return '<section class="card section" data-activity-chart="1"><h2>📈 Activity推移</h2><p class="muted small strong">'+esc(activityUnit(bucket))+' / Meetup回数とCheck-in数の推移</p><div class="trendlegend"><span>🟨 Meetup回数</span><span>🟢 Check-in数</span></div><div class="trendbox">'+svg+'</div></section>';
  }

  async function updateActivity(button,id,period,label){
    const sb=getClient();
    if(!sb)return;
    const bucket=activityBucket(period);
    const token=++requestTokens.activity;
    const panel=activityPanel();
    fade(panel);
    try{
      const result=await sb.rpc("community_activity_trend",{p_community_id:id,p_bucket:bucket,p_days:period});
      if(token!==requestTokens.activity)return;
      if(result.error)throw result.error;
      const current=activityPanel();
      if(!current)return;
      const holder=document.createElement("div");
      holder.innerHTML=activityHtml(result.data||[],bucket,label);
      current.replaceWith(holder.firstElementChild);
    }catch(err){
      console.warn("Activity period update failed",err);
      restore(activityPanel());
    }
  }

  function growthPanel(){
    const tagged=document.querySelector('[data-growth-panel="1"]');
    if(tagged)return tagged;
    return [...document.querySelectorAll("section.card.section")].find(function(section){
      if(section.id==="communityFeaturePanel")return false;
      const h=section.querySelector("h2");
      return h&&h.textContent.trim().includes("Community Growth");
    })||null;
  }

  function deltaText(value){
    if(value==null||!Number.isFinite(value))return "—";
    if(value===0)return "±0";
    return (value>0?"+":"")+value.toLocaleString("ja-JP");
  }

  function growthHtml(rows,label,fallbackCount){
    const points=(rows||[]).map(function(row){
      return {date:String(row.observed_on||""),count:Number(row.member_count)};
    }).filter(function(row){return row.date&&Number.isFinite(row.count)});
    const latest=points.length?points[points.length-1].count:(Number.isFinite(Number(fallbackCount))?Number(fallbackCount):null);
    const previous=points.length>1?points[points.length-2].count:null;
    const first=points.length>1?points[0].count:null;
    const previousDelta=latest!=null&&previous!=null?latest-previous:null;
    const periodDelta=latest!=null&&first!=null?latest-first:null;
    let chart="";
    if(!points.length){
      chart='<div class="notice section">人数履歴はまだありません。日次スナップショット取得後に表示されます。</div>';
    }else{
      const width=Math.max(560,points.length*36),height=190,left=54,right=22,top=22,bottom=38;
      const counts=points.map(function(row){return row.count});
      const min=Math.min.apply(null,counts),max=Math.max.apply(null,counts),spread=Math.max(1,max-min);
      const x=function(i){return points.length===1?width/2:left+(width-left-right)*(i/(points.length-1))};
      const y=function(v){return top+(height-top-bottom)*(1-(v-min)/spread)};
      const path=points.map(function(row,i){return (i?"L":"M")+x(i).toFixed(1)+" "+y(row.count).toFixed(1)}).join(" ");
      const labelStep=Math.max(1,Math.ceil(points.length/6));
      const labels=points.map(function(row,i){
        if(i!==0&&i!==points.length-1&&i%labelStep!==0)return "";
        const d=row.date.split("-");
        return '<text x="'+x(i).toFixed(1)+'" y="'+(height-12)+'" text-anchor="middle" font-size="10" fill="#64748b">'+esc((Number(d[1])||0)+"/"+(Number(d[2])||0))+'</text>';
      }).join("");
      const circles=points.map(function(row,i){
        return '<circle cx="'+x(i).toFixed(1)+'" cy="'+y(row.count).toFixed(1)+'" r="3.5" fill="#65a30d"><title>'+esc(row.date+"  "+row.count.toLocaleString("ja-JP")+"人")+'</title></circle>';
      }).join("");
      chart='<div class="trendbox"><svg class="trendsvg" viewBox="0 0 '+width+' '+height+'" role="img" aria-label="Community人数推移" style="min-width:'+width+'px">'+
        '<line x1="'+left+'" y1="'+top+'" x2="'+left+'" y2="'+(height-bottom)+'" stroke="#e2e8f0"/>'+
        '<line x1="'+left+'" y1="'+(height-bottom)+'" x2="'+(width-right)+'" y2="'+(height-bottom)+'" stroke="#e2e8f0"/>'+
        '<text x="8" y="'+(top+4)+'" font-size="10" fill="#64748b">'+esc(max.toLocaleString("ja-JP"))+'</text>'+
        '<text x="8" y="'+(height-bottom+4)+'" font-size="10" fill="#64748b">'+esc(min.toLocaleString("ja-JP"))+'</text>'+
        (points.length>1?'<path d="'+path+'" fill="none" stroke="#65a30d" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>':'')+circles+labels+'</svg></div>';
    }
    const started=points.length?points[0].date:"";
    return '<section class="card section" data-growth-panel="1"><div class="row between wraprow"><div><h2 style="word-break:keep-all;overflow-wrap:normal">🌱 Community Growth</h2><p class="muted small strong" style="margin:5px 0 0">Community人数の日次記録</p></div><span class="pill">同期は1日1回行われます</span></div>'+
      '<div class="grid g3 section"><div class="metric"><span class="tiny strong muted">現在のMember</span><b>'+(latest==null?'—':esc(latest.toLocaleString("ja-JP")))+'</b></div>'+
      '<div class="metric"><span class="tiny strong muted">前回比</span><b>'+esc(deltaText(previousDelta))+'</b><div class="tiny muted strong" style="margin-top:5px">前日の記録との差</div></div>'+
      '<div class="metric"><span class="tiny strong muted">期間内変化</span><b>'+esc(deltaText(periodDelta))+'</b><div class="tiny muted strong" style="margin-top:5px">'+(points.length>1?esc(label+"の最初の記録から"):"履歴2日目から算出")+'</div></div></div>'+chart+
      (started?'<div class="tiny muted strong" style="margin-top:9px">蓄積開始 '+esc(started.replace(/-/g,"/"))+'</div>':'')+'</section>';
  }

  async function updateGrowth(button,id,period,label){
    const sb=getClient();
    if(!sb)return;
    const token=++requestTokens.growth;
    const panel=growthPanel();
    fade(panel);
    try{
      const since=period===null?null:new Date(Date.now()-period*24*60*60*1000).toISOString().slice(0,10);
      let snapshots=sb.from("community_member_snapshots")
        .select("member_count,observed_on,observed_at")
        .eq("community_id",id)
        .order("observed_on",{ascending:true})
        .limit(period===null?500:400);
      if(since)snapshots=snapshots.gte("observed_on",since);
      const results=await Promise.all([
        snapshots,
        sb.from("communities").select("member_count").eq("id",id).maybeSingle()
      ]);
      if(token!==requestTokens.growth)return;
      if(results[0].error)throw results[0].error;
      if(results[1].error)throw results[1].error;
      const current=growthPanel();
      if(!current)return;
      const holder=document.createElement("div");
      holder.innerHTML=growthHtml(results[0].data||[],label,results[1].data&&results[1].data.member_count);
      current.replaceWith(holder.firstElementChild);
    }catch(err){
      console.warn("Growth period update failed",err);
      restore(growthPanel());
    }
  }

  function insightsPanel(){
    const tagged=document.querySelector('[data-insights-panel="1"]');
    if(tagged)return tagged;
    const head=document.getElementById("communityFeaturePanel");
    if(!head)return null;
    const next=head.nextElementSibling;
    return next&&next.matches&&next.matches("section.grid.g4.section")?next:null;
  }

  function insightsHtml(summary,label){
    summary=summary||{};
    const meetupCount=Number(summary.meetup_count||0);
    const caMeetups=Number(summary.ca_meetup_count||0);
    const totalRsvp=Number(summary.rsvp_count||0);
    const totalCheckin=Number(summary.checkin_count||0);
    const rate=totalRsvp>0?(totalCheckin/totalRsvp*100):null;
    const rateText=rate==null?"算出不可":(Math.abs(rate-Math.round(rate))<0.05?String(Math.round(rate)):rate.toFixed(1))+"%";
    return '<section class="grid g4 section" data-insights-panel="1">'+
      '<div class="metric"><span class="tiny strong muted">🔥 Meetup / '+esc(label)+'</span><b>'+meetupCount.toLocaleString("ja-JP")+'</b></div>'+
      '<div class="metric"><span class="tiny strong muted">🍀 CA Meetup / '+esc(label)+'</span><b>'+caMeetups.toLocaleString("ja-JP")+'</b></div>'+
      '<div class="metric"><span class="tiny strong muted">✅ Check-in / '+esc(label)+'</span><b>'+totalCheckin.toLocaleString("ja-JP")+'</b></div>'+
      '<div class="metric"><span class="tiny strong muted">📊 参加率 / '+esc(label)+'</span><b>'+esc(rateText)+'</b>'+
        (rate==null?'<div class="tiny muted strong" style="margin-top:5px">RSVP 0のため</div>':'<div class="tiny muted strong" style="margin-top:5px">RSVP → Check-in</div>')+
      '</div></section>';
  }

  async function updateInsights(button,id,period,label){
    const sb=getClient();
    if(!sb)return;
    const token=++requestTokens.insights;
    const panel=insightsPanel();
    fade(panel);
    try{
      const result=await sb.rpc("community_activity_summary",{p_community_id:id,p_days:period});
      if(token!==requestTokens.insights)return;
      if(result.error)throw result.error;
      const current=insightsPanel();
      if(!current)return;
      const holder=document.createElement("div");
      holder.innerHTML=insightsHtml((result.data&&result.data[0])||{},label);
      current.replaceWith(holder.firstElementChild);
    }catch(err){
      console.warn("Insights period update failed",err);
      restore(insightsPanel());
    }
  }

  document.addEventListener("click",function(event){
    const button=event.target&&event.target.closest?event.target.closest("[data-community-period]"):null;
    if(!button)return;
    const feature=currentFeature();
    if(!feature)return;
    const id=communityId();
    if(!id)return;

    event.preventDefault();
    event.stopImmediatePropagation();
    setActiveButton(button);

    const period=valueOf(button);
    const label=periodLabel(period);
    if(feature==="activity")void updateActivity(button,id,period,label);
    if(feature==="growth")void updateGrowth(button,id,period,label);
    if(feature==="insights")void updateInsights(button,id,period,label);
  },true);
})();
