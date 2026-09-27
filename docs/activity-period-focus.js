(function(){
  "use strict";

  const SUPABASE_URL="https://wgiittrvgtiosogyhfcl.supabase.co";
  const SUPABASE_KEY="sb_publishable_QTCqijfNvnysUTMylNIyTA_6ngosaPN";
  let client=null;
  let requestToken=0;

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

  function bucketOf(period){
    if(period===30)return "day";
    if(period===90)return "week";
    if(period===null)return "year";
    return "month";
  }

  function unitOf(bucket){
    if(bucket==="day")return "日別";
    if(bucket==="week")return "週別";
    if(bucket==="year")return "年別";
    return "月別";
  }

  function pointLabel(value,bucket,count){
    const p=String(value||"").slice(0,10).split("-").map(Number);
    const y=p[0]||0,m=p[1]||1,d=p[2]||1;
    if(bucket==="day"||bucket==="week")return m+"/"+d;
    if(bucket==="year")return String(y);
    return count>12?String(y).slice(-2)+"/"+m:m+"月";
  }

  function chartHtml(rows,bucket,label){
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
      svg+='<rect x="'+(xx-barW/2)+'" y="'+yy+'" width="'+barW+'" height="'+Math.max(0,hh)+'" rx="4" fill="#fcd34d"><title>'+esc(pointLabel(r.bucket,bucket,rows.length)+' Meetup '+r.meetup_count+'回')+'</title></rect>';
      if(i%every===0||i===rows.length-1)svg+='<text x="'+xx+'" y="'+(H-22)+'" text-anchor="middle" font-size="10" font-weight="700" fill="#475569">'+esc(pointLabel(r.bucket,bucket,rows.length))+'</text>';
      line.push(xx+','+cy(r.checkin_count));
    });
    if(line.length>1)svg+='<polyline points="'+line.join(' ')+'" fill="none" stroke="#65a30d" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>';
    rows.forEach(function(r,i){
      svg+='<circle cx="'+x(i)+'" cy="'+cy(r.checkin_count)+'" r="4" fill="#65a30d" stroke="white" stroke-width="2"><title>'+esc(pointLabel(r.bucket,bucket,rows.length)+' Check-in '+r.checkin_count.toLocaleString("ja-JP"))+'</title></circle>';
    });
    svg+='<text x="'+L+'" y="14" font-size="10" font-weight="800" fill="#b45309">Meetup回数</text><text x="'+(W-R)+'" y="14" text-anchor="end" font-size="10" font-weight="800" fill="#4d7c0f">Check-in数</text></svg>';
    return '<section class="card section" data-activity-chart="1"><h2>📈 Activity推移</h2><p class="muted small strong">'+esc(unitOf(bucket))+' / Meetup回数とCheck-in数の推移</p><div class="trendlegend"><span>🟨 Meetup回数</span><span>🟢 Check-in数</span></div><div class="trendbox">'+svg+'</div></section>';
  }

  function communityId(){
    const raw=(location.hash||"").slice(1);
    if(!raw.startsWith("community:"))return "";
    try{return decodeURIComponent(raw.slice("community:".length))}catch(_e){return raw.slice("community:".length)}
  }

  function isActivity(){
    return Boolean(document.querySelector('.feature-app.activity.on'));
  }

  function chartPanel(){
    const tagged=document.querySelector('[data-activity-chart="1"]');
    if(tagged)return tagged;
    return [...document.querySelectorAll("section.card.section")].find(function(section){
      const h=section.querySelector("h2");
      return h&&h.textContent.trim().includes("Activity推移");
    })||null;
  }

  async function switchPeriod(button){
    const sb=getClient();
    const id=communityId();
    if(!sb||!id)return;

    const period=valueOf(button);
    const bucket=bucketOf(period);
    const label=periodLabel(period);
    const token=++requestToken;

    document.querySelectorAll("[data-community-period]").forEach(function(b){
      const active=b===button;
      b.classList.toggle("active",active);
      b.setAttribute("aria-pressed",active?"true":"false");
    });

    const panel=chartPanel();
    if(panel){
      panel.style.transition="opacity .12s ease";
      panel.style.opacity=".55";
    }

    try{
      const result=await sb.rpc("community_activity_trend",{
        p_community_id:id,
        p_bucket:bucket,
        p_days:period
      });
      if(token!==requestToken)return;
      if(result.error)throw result.error;

      const current=chartPanel();
      if(!current)return;
      const holder=document.createElement("div");
      holder.innerHTML=chartHtml(result.data||[],bucket,label);
      const next=holder.firstElementChild;
      current.replaceWith(next);
    }catch(err){
      console.warn("Activity period update failed",err);
      const current=chartPanel();
      if(current)current.style.opacity="1";
    }
  }

  // Activityだけは期間変更をその場で更新する。
  // 既存の onclick より先に捕まえて、Community画面全体の再描画を止める。
  document.addEventListener("click",function(event){
    const button=event.target&&event.target.closest?event.target.closest("[data-community-period]"):null;
    if(!button||!isActivity())return;
    event.preventDefault();
    event.stopImmediatePropagation();
    void switchPeriod(button);
  },true);
})();
