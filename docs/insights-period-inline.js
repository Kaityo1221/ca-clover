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

  function isInsights(){
    return Boolean(document.querySelector('.feature-app.insights.on'));
  }

  function insightsPanel(){
    const tagged=document.querySelector('[data-insights-panel="1"]');
    if(tagged)return tagged;
    const head=document.getElementById("communityFeaturePanel");
    if(!head)return null;
    const next=head.nextElementSibling;
    if(next&&next.matches&&next.matches("section.grid.g4.section"))return next;
    return null;
  }

  function panelHtml(summary,label){
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

    const panel=insightsPanel();
    if(panel){
      panel.style.transition="opacity .12s ease";
      panel.style.opacity=".55";
    }

    try{
      const result=await sb.rpc("community_activity_summary",{
        p_community_id:id,
        p_days:period
      });
      if(token!==requestToken)return;
      if(result.error)throw result.error;

      const current=insightsPanel();
      if(!current)return;
      const holder=document.createElement("div");
      holder.innerHTML=panelHtml((result.data&&result.data[0])||{},label);
      const next=holder.firstElementChild;
      current.replaceWith(next);
    }catch(err){
      console.warn("Insights period update failed",err);
      const current=insightsPanel();
      if(current)current.style.opacity="1";
    }
  }

  // InsightsもActivity / Growthと同様、その場で期間だけ切り替える。
  document.addEventListener("click",function(event){
    const button=event.target&&event.target.closest?event.target.closest("[data-community-period]"):null;
    if(!button||!isInsights())return;
    event.preventDefault();
    event.stopImmediatePropagation();
    void switchPeriod(button);
  },true);
})();
