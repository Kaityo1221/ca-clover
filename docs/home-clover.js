(function(){
  "use strict";

  const SUPABASE_URL="https://wgiittrvgtiosogyhfcl.supabase.co";
  const SUPABASE_KEY="sb_publishable_QTCqijfNvnysUTMylNIyTA_6ngosaPN";
  const ROOT_ID="homeCloverRoot";
  const AXIS_META={
    host:{label:"開催",icon:"🗓️",tone:"orange"},
    join:{label:"参加",icon:"👥",tone:"blue"},
    exchange:{label:"交流",icon:"🤝",tone:"rose"},
    continue:{label:"継続",icon:"↻",tone:"green"}
  };

  let client=null;
  let rendering=false;
  let renderToken=0;
  const activeGrowthControllers=new Set();

  function getClient(){
    if(client)return client;
    if(!window.supabase)return null;
    client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{
      auth:{persistSession:true,autoRefreshToken:false,detectSessionInUrl:false}
    });
    return client;
  }

  function ensureMonthlyScript(){
    if(window.CAMonthlyClover)return Promise.resolve(true);
    return new Promise(resolve=>{
      const existing=document.querySelector('script[data-ca-monthly-clover]');
      if(existing){
        existing.addEventListener("load",()=>resolve(Boolean(window.CAMonthlyClover)),{once:true});
        existing.addEventListener("error",()=>resolve(false),{once:true});
        return;
      }
      const script=document.createElement("script");
      script.src="./monthly-clover.js?v=20260926-growth1";
      script.async=true;
      script.dataset.caMonthlyClover="1";
      script.onload=()=>resolve(Boolean(window.CAMonthlyClover));
      script.onerror=()=>resolve(false);
      document.head.appendChild(script);
    });
  }

  function ensureStyle(){
    if(document.getElementById("caHomeCloverStyle"))return;
    const style=document.createElement("style");
    style.id="caHomeCloverStyle";
    style.textContent=`
      .home-clover-wrap{display:grid;gap:18px}
      .home-clover-community-label{display:flex;align-items:center;gap:9px;margin:2px 2px -5px;color:#557c4b;font-size:12px;font-weight:950}
      .home-clover-community-label img{width:28px;height:28px;border-radius:9px;object-fit:cover;border:1px solid #d9f99d;background:#f7fee7}
      .home-clover-wrap .ca-monthly-clover-card{border-color:#fed7aa;background:radial-gradient(circle at 83% 18%,rgba(190,242,100,.24),transparent 22%),linear-gradient(145deg,#fff8ed 0%,#fffef8 54%,#f2fbed 100%);box-shadow:0 18px 46px rgba(130,88,35,.09)}
      .home-clover-wrap .ca-monthly-clover-title{font-size:clamp(23px,4.8vw,32px);letter-spacing:-.025em;color:#274515}
      .home-clover-wrap .ca-monthly-clover-month{color:#b45309;background:#fff8ed;border-color:#fed7aa;font-size:13px}
      .home-week-card{position:relative;overflow:hidden;background:linear-gradient(135deg,#f5fff1,#fff,#eefcf7);border:1px solid #bbf7d0;border-radius:25px;padding:18px;box-shadow:0 14px 38px rgba(34,111,65,.07)}
      .home-week-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
      .home-week-title{margin:0;color:#274515;font-size:clamp(21px,4.5vw,28px);font-weight:950;letter-spacing:-.02em}
      .home-week-range{color:#679c57;font-size:12px;font-weight:950;white-space:nowrap;margin-top:4px}
      .home-week-sub{color:#64748b;font-size:12px;font-weight:850;margin:3px 0 0}
      .home-week-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin-top:14px}
      .home-week-metric{border:1px solid rgba(226,232,240,.92);border-radius:17px;padding:11px;background:rgba(255,255,255,.82);min-width:0}
      .home-week-metric .label{font-size:11px;font-weight:950;display:flex;align-items:center;gap:5px}.home-week-metric .value{font-size:18px;font-weight:950;margin-top:5px;letter-spacing:-.02em}.home-week-metric .desc{font-size:10px;font-weight:850;color:#94a3b8;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .home-week-metric.orange .label,.home-week-metric.orange .value{color:#ea580c}.home-week-metric.blue .label,.home-week-metric.blue .value{color:#0284c7}.home-week-metric.rose .label,.home-week-metric.rose .value{color:#e11d48}.home-week-metric.green .label,.home-week-metric.green .value{color:#16a34a}
      .home-clover-growth{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:12px;padding:10px 12px 10px 13px;border-radius:16px;background:rgba(255,247,237,.88);border:1px solid #fed7aa;color:#c2410c;font-size:12px;font-weight:950;text-align:left}.home-clover-growth-message{flex:1;min-width:0}.home-clover-skip{border:1px solid #fdba74;background:rgba(255,255,255,.9);color:#9a3412;border-radius:999px;padding:6px 10px;font-size:11px;font-weight:950;line-height:1;box-shadow:0 3px 10px rgba(154,52,18,.06)}.home-clover-skip[hidden]{display:none!important}
      .home-clover-status{padding:16px;border-radius:22px;background:#fff;border:1px solid #ecfccb;color:#64748b;font-size:12px;font-weight:850;text-align:center}
      .home-clover-modal{position:fixed;inset:0;z-index:160;background:rgba(15,23,42,.42);padding:16px;display:grid;place-items:center}
      .home-clover-modal-card{width:min(440px,100%);max-height:calc(100dvh - 32px);overflow:auto;background:#fffaf2;border:1px solid #eadfce;border-radius:25px;padding:20px;box-shadow:0 30px 80px rgba(15,23,42,.22)}
      .home-clover-modal-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.home-clover-modal-close{border:0;width:38px;height:38px;border-radius:999px;background:#f1f5f9;font-weight:950;font-size:18px}
      .home-clover-modal-list{display:grid;gap:8px;margin-top:12px}.home-clover-modal-row{padding:10px 12px;border-radius:14px;background:#fff;border:1px solid #eef0e9;font-size:12px;font-weight:850;color:#53606e}.home-clover-modal-row b{color:#365314}
      @media(max-width:680px){.home-week-grid{grid-template-columns:1fr 1fr}.home-week-card{padding:16px}.home-clover-wrap .ca-monthly-clover-card{padding:16px}}
      @media(prefers-reduced-motion:reduce){.ca-month-leaf.is-flipping .ca-month-leaf-scale{animation:none!important}}
    `;
    document.head.appendChild(style);
  }

  function startOfMonth(date){return new Date(date.getFullYear(),date.getMonth(),1)}
  function startOfNextMonth(date){return new Date(date.getFullYear(),date.getMonth()+1,1)}
  function startOfWeek(date){
    const d=new Date(date.getFullYear(),date.getMonth(),date.getDate());
    const day=(d.getDay()+6)%7;
    d.setDate(d.getDate()-day);
    d.setHours(0,0,0,0);
    return d;
  }
  function endOfWeek(date){const d=startOfWeek(date);d.setDate(d.getDate()+7);return d}
  function fmtMd(date){return (date.getMonth()+1)+"/"+date.getDate()}
  function monthKey(date){return date.getFullYear()+"-"+String(date.getMonth()+1).padStart(2,"0")}
  function weekKey(value){
    const d=new Date(value); if(!Number.isFinite(d.getTime()))return "";
    const start=startOfWeek(d);
    return start.getFullYear()+"-"+String(start.getMonth()+1).padStart(2,"0")+"-"+String(start.getDate()).padStart(2,"0");
  }
  function inRange(value,start,end){const t=new Date(value).getTime();return Number.isFinite(t)&&t>=start.getTime()&&t<end.getTime()}
  function number(v){return Number(v)||0}
  function esc(v){return String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"})[c])}

  async function loadModel(sb,uid,communityId,totalCommunities){
    const now=new Date();
    const monthStart=startOfMonth(now),monthEnd=startOfNextMonth(now);
    const weekStart=startOfWeek(now),weekEnd=endOfWeek(now);
    const [meetupResult,exchangeResult,communityResult]=await Promise.all([
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
      sb.from("communities").select("id,name,avatar_url").eq("id",communityId).maybeSingle()
    ]);
    if(meetupResult.error)throw meetupResult.error;
    const meetups=meetupResult.data||[];
    const exchanges=exchangeResult.error?[]:(exchangeResult.data||[]);
    const uniqueExchangeMap=new Map();
    exchanges.forEach(x=>{if(x.stamp_ca_member_id&&!uniqueExchangeMap.has(x.stamp_ca_member_id))uniqueExchangeMap.set(x.stamp_ca_member_id,x)});
    const uniqueExchanges=[...uniqueExchangeMap.values()];
    const checkins=meetups.reduce((sum,m)=>sum+number(m.checkin_count),0);
    const activeWeeks=new Set(meetups.map(m=>weekKey(m.starts_at)).filter(Boolean)).size;
    const metrics={meetups:meetups.length,checkins,exchanges:uniqueExchanges.length,activeWeeks};
    const stages=window.CAMonthlyClover.stagesFromMetrics(metrics);
    const weekMeetups=meetups.filter(m=>inRange(m.starts_at,weekStart,weekEnd));
    const weekExchanges=uniqueExchanges.filter(x=>inRange(x.first_acquired_at,weekStart,weekEnd));
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
      exchange:metrics.exchanges?"新しい交流 "+metrics.exchanges+"人":"今月はまだ新しい交換なし",
      continue:activeWeeks?"活動した週 "+activeWeeks+"週":"今月はまだ活動週なし"
    };
    return {
      community:communityResult.data||{id:communityId,name:"Community",avatar_url:null},
      totalCommunities,now,monthStart,monthEnd,meetups,uniqueExchanges,metrics,stages,week,details,
      exchangeShared:totalCommunities>1
    };
  }

  function weeklyMetric(key,value,desc){
    const m=AXIS_META[key];
    return '<div class="home-week-metric '+m.tone+'"><div class="label"><span>'+m.icon+'</span>'+m.label+'</div><div class="value">'+esc(value)+'</div><div class="desc">'+esc(desc)+'</div></div>';
  }

  function weeklyHtml(model){
    const w=model.week;
    return '<section class="home-week-card" data-home-week="1">'+
      '<div class="home-week-head"><div><h2 class="home-week-title">🍀 今週のClover</h2><p class="home-week-sub">今週の主な活動の変化を表示しています。</p></div><div class="home-week-range">'+fmtMd(w.start)+' - '+fmtMd(w.end)+'</div></div>'+
      '<div class="home-week-grid">'+
        weeklyMetric("host","+"+w.meetups+"回",w.meetups?"Meetup開催":"開催なし")+
        weeklyMetric("join","+"+w.checkins,w.checkins?"Check-in":"Check-inなし")+
        weeklyMetric("exchange","+"+w.exchanges+"人",w.exchanges?"新しい交換":"交換なし")+
        weeklyMetric("continue","+"+w.activeWeeks+"週",w.activeWeeks?"今週も活動":"活動記録なし")+
      '</div></section>';
  }

  function stageStorageKey(uid,communityId,date){return "ca-clover-stage:"+uid+":"+communityId+":"+monthKey(date)}
  function previousStages(uid,communityId,date){
    try{const raw=localStorage.getItem(stageStorageKey(uid,communityId,date));return raw?JSON.parse(raw):null}catch(_){return null}
  }
  function saveStages(uid,communityId,date,stages){
    try{localStorage.setItem(stageStorageKey(uid,communityId,date),JSON.stringify(stages))}catch(_){}
  }
  function grownAxes(before,after){
    if(!before)return [];
    return window.CAMonthlyClover.AXES.filter(a=>number(after[a.key])>number(before[a.key])).map(a=>a.key);
  }
  function cancelAllGrowthAnimations(save){
    [...activeGrowthControllers].forEach(controller=>controller.cancel(Boolean(save)));
  }

  function monthDetailRows(model,key){
    if(key==="host"){
      return model.meetups.length?model.meetups.map(m=>'<div class="home-clover-modal-row"><b>'+esc(new Date(m.starts_at).toLocaleDateString("ja-JP"))+"</b>　"+esc(m.title||"Meetup")+'</div>').join(""):'<div class="home-clover-modal-row">今月はまだMeetup開催記録がありません。</div>';
    }
    if(key==="join"){
      return model.meetups.length?model.meetups.map(m=>'<div class="home-clover-modal-row"><b>'+esc(new Date(m.starts_at).toLocaleDateString("ja-JP"))+"</b>　Check-in "+number(m.checkin_count).toLocaleString("ja-JP")+'</div>').join(""):'<div class="home-clover-modal-row">今月はまだCheck-in記録がありません。</div>';
    }
    if(key==="exchange"){
      const note=model.exchangeShared?'<div class="home-clover-modal-row">※ 複数Community担当のため、交流はCAアカウント共通の記録です。</div>':"";
      return note+(model.uniqueExchanges.length?model.uniqueExchanges.map(x=>'<div class="home-clover-modal-row"><b>'+esc(new Date(x.first_acquired_at).toLocaleDateString("ja-JP"))+'</b>　'+esc(x.first_event_name||x.first_location||"CA Stamp Rally交換")+'</div>').join(""):'<div class="home-clover-modal-row">今月はまだ新しい交換記録がありません。</div>');
    }
    const weeks=[...new Set(model.meetups.map(m=>weekKey(m.starts_at)).filter(Boolean))];
    return weeks.length?weeks.map((w,i)=>'<div class="home-clover-modal-row"><b>活動週 '+(i+1)+'</b>　'+esc(w)+'</div>').join(""):'<div class="home-clover-modal-row">今月はまだ活動週がありません。</div>';
  }

  function openAxisModal(model,key){
    document.getElementById("homeCloverModal")?.remove();
    const meta=AXIS_META[key];
    if(!meta)return;
    const back=document.createElement("div");
    back.id="homeCloverModal";
    back.className="home-clover-modal";
    back.innerHTML='<section class="home-clover-modal-card"><div class="home-clover-modal-head"><div><div class="tiny strong" style="color:#8e7758">今月のClover</div><h2 style="margin-top:6px">'+meta.icon+' '+meta.label+'の葉</h2><p class="small muted strong">'+esc(model.details[key]||"")+'</p></div><button type="button" class="home-clover-modal-close" aria-label="閉じる">×</button></div><div class="home-clover-modal-list">'+monthDetailRows(model,key)+'</div></section>';
    document.body.appendChild(back);
    const close=()=>back.remove();
    back.querySelector(".home-clover-modal-close").onclick=close;
    back.onclick=e=>{if(e.target===back)close()};
  }

  function bindModel(root,model,uid){
    root.querySelectorAll("[data-clover-axis]").forEach(btn=>btn.addEventListener("click",()=>openAxisModal(model,btn.dataset.cloverAxis)));
    root.querySelectorAll(".ca-month-leaf[data-axis]").forEach(leaf=>{
      leaf.setAttribute("tabindex","0");
      leaf.setAttribute("role","button");
      leaf.addEventListener("click",()=>openAxisModal(model,leaf.dataset.axis));
      leaf.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();openAxisModal(model,leaf.dataset.axis)}});
    });

    const before=previousStages(uid,model.community.id,model.now);
    const grown=grownAxes(before,model.stages);
    const growth=root.querySelector("[data-growth-message]");
    const skip=root.querySelector("[data-growth-skip]");
    const reduced=Boolean(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    if(growth){
      growth.textContent=grown.length?'🌱 今回、'+grown.length+'枚の葉が育ちました。':'🍀 今月の活動がCloverに育っています。';
    }

    // 初回表示は現在値を基準として保存し、成長演出は行わない。
    if(!before){
      saveStages(uid,model.community.id,model.now,model.stages);
      return;
    }
    if(!grown.length||reduced){
      saveStages(uid,model.community.id,model.now,model.stages);
      return;
    }

    if(skip)skip.hidden=false;
    let cancelled=false;
    let completed=false;
    let timers=[];
    const clearTimers=()=>{
      timers.forEach(id=>clearTimeout(id));
      timers=[];
    };
    const finish=()=>{
      if(completed)return;
      completed=true;
      clearTimers();
      root.querySelectorAll(".ca-month-leaf.is-flipping").forEach(leaf=>leaf.classList.remove("is-flipping"));
      if(skip)skip.hidden=true;
      saveStages(uid,model.community.id,model.now,model.stages);
      activeGrowthControllers.delete(controller);
    };
    const controller={
      cancel(save){
        if(completed)return;
        cancelled=true;
        clearTimers();
        root.querySelectorAll(".ca-month-leaf.is-flipping").forEach(leaf=>leaf.classList.remove("is-flipping"));
        if(skip)skip.hidden=true;
        if(save)saveStages(uid,model.community.id,model.now,model.stages);
        completed=true;
        activeGrowthControllers.delete(controller);
      }
    };
    activeGrowthControllers.add(controller);
    if(skip)skip.addEventListener("click",()=>controller.cancel(true),{once:true});

    const schedule=(fn,ms)=>{
      const id=setTimeout(()=>{
        timers=timers.filter(x=>x!==id);
        if(!cancelled)fn();
      },ms);
      timers.push(id);
    };
    let index=0;
    const playNext=()=>{
      if(cancelled)return;
      if(index>=grown.length){
        finish();
        return;
      }
      const key=grown[index++];
      window.CAMonthlyClover.flip(root,key);
      schedule(playNext,1060);
    };

    schedule(playNext,420);
  }

  function monthHtml(model){
    const label=model.totalCommunities>1?'<div class="home-clover-community-label">'+(model.community.avatar_url?'<img src="'+esc(model.community.avatar_url)+'" alt="">':'🍀')+'<span>'+esc(model.community.name)+'</span></div>':"";
    const monthly=window.CAMonthlyClover.cardHtml({date:model.now,stages:model.stages,details:model.details});
    return label+monthly+'<div class="home-clover-growth"><span class="home-clover-growth-message" data-growth-message aria-live="polite">🍀 今月の活動がCloverに育っています。</span><button type="button" class="home-clover-skip" data-growth-skip hidden>Skip</button></div>'+weeklyHtml(model);
  }

  function findCommunitySection(){
    const headings=[...document.querySelectorAll("h2")];
    const h=headings.find(x=>x.textContent.trim()==="あなたのCommunity");
    return h?h.closest("section"):null;
  }
  function findLab(){
    return [...document.querySelectorAll("section.card.section")].find(s=>s.textContent.includes("CA Stamp Rally LAB"))||null;
  }

  async function renderHomeClover(){
    if(rendering)return;
    if((location.hash||"#my")!=="#my")return;
    const communitySection=findCommunitySection();
    if(!communitySection)return;
    const buttons=[...communitySection.querySelectorAll("[data-community]")];
    if(!buttons.length)return;
    const existing=document.getElementById(ROOT_ID);
    if(existing&&existing.dataset.ready==="1"){
      const lab=findLab(); if(lab&&existing.nextElementSibling!==lab)existing.after(lab);
      return;
    }
    rendering=true;
    const token=++renderToken;
    try{
      ensureStyle();
      const ok=await ensureMonthlyScript();
      if(!ok||token!==renderToken)return;
      const sb=getClient(); if(!sb)return;
      const sessionResult=await sb.auth.getSession();
      const session=sessionResult.data?.session;
      if(!session||token!==renderToken)return;
      let root=document.getElementById(ROOT_ID);
      if(!root){root=document.createElement("section");root.id=ROOT_ID;root.className="section home-clover-wrap";communitySection.after(root)}
      root.dataset.ready="0";
      root.innerHTML='<div class="home-clover-status">🍀 今月のCloverを育てています...</div>';
      const communityIds=buttons.map(b=>b.dataset.community).filter(Boolean);
      const models=[];
      for(const id of communityIds){
        try{models.push(await loadModel(sb,session.user.id,id,communityIds.length))}catch(err){console.warn("Monthly Clover load failed",id,err)}
      }
      if(token!==renderToken)return;
      if(!models.length){root.innerHTML='<div class="home-clover-status">今月のCloverを読み込めませんでした。</div>';return}
      root.innerHTML=models.map(monthHtml).join("");
      models.forEach((model,i)=>{
        const monthlyCards=root.querySelectorAll("[data-monthly-clover]");
        const card=monthlyCards[i];
        if(card){
          const scope=document.createElement("div");
          card.parentNode.insertBefore(scope,card);
          scope.appendChild(card);
          const growth=card.nextElementSibling;
          const week=growth?.nextElementSibling;
          if(growth)scope.appendChild(growth);
          if(week)scope.appendChild(week);
          bindModel(scope,model,session.user.id);
        }
      });
      root.dataset.ready="1";
      const lab=findLab(); if(lab)root.after(lab);
    }finally{
      rendering=false;
    }
  }

  let timer=null;
  function schedule(){clearTimeout(timer);timer=setTimeout(()=>void renderHomeClover(),120)}
  const observer=new MutationObserver(schedule);
  function start(){
    observer.observe(document.body,{childList:true,subtree:true});
    window.addEventListener("hashchange",()=>{cancelAllGrowthAnimations(false);renderToken++;document.getElementById(ROOT_ID)?.remove();schedule()});
    schedule();
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();
