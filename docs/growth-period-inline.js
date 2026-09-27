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

  function communityId(){
    const raw=(location.hash||"").slice(1);
    if(!raw.startsWith("community:"))return "";
    try{return decodeURIComponent(raw.slice("community:".length))}catch(_e){return raw.slice("community:".length)}
  }

  function isGrowth(){
    return Boolean(document.querySelector('.feature-app.growth.on'));
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

  function panelHtml(rows,label,fallbackCount){
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

  async function switchPeriod(button){
    const sb=getClient();
    const id=communityId();
    if(!sb||!id)return;

    const period=valueOf(button);
    const label=periodLabel(period);
    const token=++requestToken;

    document.querySelectorAll("[data-community-period]").forEach(function(b){
      const active=b===button;
      b.classList.toggle("active",active);
      b.setAttribute("aria-pressed",active?"true":"false");
    });

    const panel=growthPanel();
    if(panel){
      panel.style.transition="opacity .12s ease";
      panel.style.opacity=".55";
    }

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
      if(token!==requestToken)return;
      if(results[0].error)throw results[0].error;
      if(results[1].error)throw results[1].error;

      const current=growthPanel();
      if(!current)return;
      const holder=document.createElement("div");
      holder.innerHTML=panelHtml(results[0].data||[],label,results[1].data&&results[1].data.member_count);
      const next=holder.firstElementChild;
      current.replaceWith(next);
    }catch(err){
      console.warn("Growth period update failed",err);
      const current=growthPanel();
      if(current)current.style.opacity="1";
    }
  }

  // GrowthもActivityと同様、期間変更はその場で更新する。
  // Community画面全体は再描画しないので、現在のスクロール位置を維持する。
  document.addEventListener("click",function(event){
    const button=event.target&&event.target.closest?event.target.closest("[data-community-period]"):null;
    if(!button||!isGrowth())return;
    event.preventDefault();
    event.stopImmediatePropagation();
    void switchPeriod(button);
  },true);
})();
