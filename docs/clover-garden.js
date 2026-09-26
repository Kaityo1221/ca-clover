(function(){
  "use strict";

  const SUPABASE_URL="https://wgiittrvgtiosogyhfcl.supabase.co";
  const SUPABASE_KEY="sb_publishable_QTCqijfNvnysUTMylNIyTA_6ngosaPN";
  const ROOT_ID="homeCloverRoot";
  const GARDEN_ID="cloverGardenBase";
  const ARCHIVE_START=new Date(2026,8,1); // 2026-09-01 JST
  let client=null;
  let running=false;
  let renderSeq=0;

  function getClient(){
    if(client)return client;
    if(!window.supabase)return null;
    client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{
      auth:{persistSession:true,autoRefreshToken:false,detectSessionInUrl:false}
    });
    return client;
  }

  function ensureStyle(){
    if(document.getElementById("caCloverGardenStyle"))return;
    const style=document.createElement("style");
    style.id="caCloverGardenStyle";
    style.textContent=`
      .clover-garden-base{position:relative;overflow:hidden;border:1px solid #d9e8c7;border-radius:25px;padding:18px;background:radial-gradient(circle at 84% 18%,rgba(190,242,100,.22),transparent 22%),linear-gradient(145deg,#fffaf1,#fffef8 54%,#f5fbef);box-shadow:0 14px 38px rgba(74,110,47,.07)}
      .clover-garden-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.clover-garden-title{margin:0;color:#31511f;font-size:clamp(21px,4.5vw,28px);font-weight:950;letter-spacing:-.02em}.clover-garden-sub{margin:4px 0 0;color:#7b8b73;font-size:11px;font-weight:850;line-height:1.55}.clover-garden-badge{flex:0 0 auto;border:1px solid #d9f99d;background:#f7fee7;color:#4d7c0f;border-radius:999px;padding:6px 10px;font-size:10px;font-weight:950}
      .clover-garden-empty{margin-top:14px;border:1px dashed #d7e5ca;border-radius:18px;padding:14px;background:rgba(255,255,255,.68);color:#708063;font-size:12px;font-weight:850;line-height:1.65;text-align:center}.clover-garden-years{display:grid;gap:14px;margin-top:15px}.clover-garden-year{display:grid;gap:8px}.clover-garden-year-label{color:#7a6b5d;font-size:11px;font-weight:950}.clover-garden-strip{display:flex;gap:10px;overflow-x:auto;padding:2px 1px 7px;scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch}.clover-garden-strip::-webkit-scrollbar{height:4px}.clover-garden-strip::-webkit-scrollbar-thumb{background:#d9e8c7;border-radius:999px}
      .clover-garden-month{flex:0 0 112px;scroll-snap-align:start;border:1px solid #e8eadf;border-radius:18px;background:rgba(255,255,255,.86);padding:10px;box-shadow:0 6px 18px rgba(71,85,57,.05)}.clover-garden-month-name{display:flex;align-items:center;justify-content:space-between;gap:6px;color:#4b5d42;font-size:11px;font-weight:950}.clover-garden-community{margin-top:3px;color:#9a8b7e;font-size:9px;font-weight:850;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.clover-mini{position:relative;width:64px;height:64px;margin:8px auto 4px}.clover-mini-leaf{position:absolute;width:29px;height:29px;background:linear-gradient(145deg,#b7df79,#3ca65d);border-radius:72% 38% 72% 38%;box-shadow:inset 2px 2px 7px rgba(255,255,255,.34),0 2px 6px rgba(40,90,40,.08);opacity:calc(.30 + (var(--stage) * .175));transform:scale(calc(.78 + (var(--stage) * .055)))}.clover-mini-leaf.top{left:18px;top:2px;transform:rotate(45deg) scale(calc(.78 + (var(--stage) * .055)))}.clover-mini-leaf.right{right:2px;top:18px;transform:rotate(135deg) scale(calc(.78 + (var(--stage) * .055)))}.clover-mini-leaf.bottom{left:18px;bottom:2px;transform:rotate(225deg) scale(calc(.78 + (var(--stage) * .055)))}.clover-mini-leaf.left{left:2px;top:18px;transform:rotate(315deg) scale(calc(.78 + (var(--stage) * .055)))}.clover-mini-center{position:absolute;left:28px;top:28px;width:8px;height:8px;border-radius:999px;background:#4f8f45;box-shadow:0 1px 4px rgba(35,80,35,.18)}.clover-garden-note{margin-top:8px;color:#95a08d;font-size:9px;font-weight:800;line-height:1.5}
      @media(max-width:680px){.clover-garden-base{padding:16px}.clover-garden-month{flex-basis:104px}}
    `;
    document.head.appendChild(style);
  }

  function monthStart(date){return new Date(date.getFullYear(),date.getMonth(),1)}
  function addMonths(date,count){return new Date(date.getFullYear(),date.getMonth()+count,1)}
  function monthKey(date){return date.getFullYear()+"-"+String(date.getMonth()+1).padStart(2,"0")+"-01"}
  function monthLabel(value){const d=new Date(value+"T00:00:00");return Number.isFinite(d.getTime())?(d.getMonth()+1)+"月":""}
  function esc(v){return String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"})[c])}

  function communityIds(){
    return [...new Set([...document.querySelectorAll("[data-community]")].map(el=>el.getAttribute("data-community")).filter(Boolean))];
  }

  function archivedMonths(now){
    const end=monthStart(now);
    const months=[];
    for(let d=monthStart(ARCHIVE_START);d<end;d=addMonths(d,1))months.push(new Date(d));
    return months;
  }

  async function getSnapshots(sb,uid,ids){
    if(!ids.length)return [];
    const r=await sb.from("monthly_clover_snapshots")
      .select("id,owner_user_id,community_id,month_start,meetup_count,checkin_count,exchange_count,active_week_count,host_stage,join_stage,exchange_stage,continue_stage,rules_version,refreshed_at")
      .eq("owner_user_id",uid)
      .in("community_id",ids)
      .order("month_start",{ascending:true});
    if(r.error)throw r.error;
    return r.data||[];
  }

  async function refreshArchives(sb,uid,ids,existing,now){
    const months=archivedMonths(now);
    if(!months.length)return existing;
    const existingKeys=new Set(existing.map(x=>x.community_id+"|"+x.month_start));
    const recentCutoff=addMonths(monthStart(now),-2);
    const tasks=[];
    ids.forEach(communityId=>months.forEach(month=>{
      const key=communityId+"|"+monthKey(month);
      if(!existingKeys.has(key)||month>=recentCutoff){
        tasks.push(sb.rpc("refresh_monthly_clover_snapshot",{p_community_id:communityId,p_month_start:monthKey(month)}));
      }
    }));
    if(tasks.length)await Promise.all(tasks.map(p=>p.catch? p.catch(()=>null):p));
    return getSnapshots(sb,uid,ids);
  }

  function mini(snapshot){
    const stages=[snapshot.host_stage,snapshot.join_stage,snapshot.exchange_stage,snapshot.continue_stage].map(v=>Math.max(0,Math.min(4,Number(v)||0)));
    return '<div class="clover-mini" aria-label="開催 '+stages[0]+'、参加 '+stages[1]+'、交流 '+stages[2]+'、継続 '+stages[3]+'">'+
      '<i class="clover-mini-leaf top" style="--stage:'+stages[0]+'"></i>'+
      '<i class="clover-mini-leaf right" style="--stage:'+stages[1]+'"></i>'+
      '<i class="clover-mini-leaf bottom" style="--stage:'+stages[2]+'"></i>'+
      '<i class="clover-mini-leaf left" style="--stage:'+stages[3]+'"></i>'+
      '<i class="clover-mini-center"></i></div>';
  }

  function renderGarden(root,snapshots,communityMap,now){
    let section=document.getElementById(GARDEN_ID);
    if(section)section.remove();
    section=document.createElement("section");
    section.id=GARDEN_ID;
    section.className="clover-garden-base";
    const years=new Map();
    snapshots.forEach(s=>{
      const year=String(s.month_start||"").slice(0,4)||String(now.getFullYear());
      if(!years.has(year))years.set(year,[]);
      years.get(year).push(s);
    });
    const multi=communityMap.size>1;
    let body='';
    if(!snapshots.length){
      body='<div class="clover-garden-empty">🌱 最初のCloverは、月が変わるとここに残ります。<br>9月の活動は10月になったら保存されます。</div>';
    }else{
      body='<div class="clover-garden-years">'+[...years.entries()].sort((a,b)=>Number(b[0])-Number(a[0])).map(([year,items])=>{
        const cards=items.map(s=>'<div class="clover-garden-month"><div class="clover-garden-month-name"><span>'+esc(monthLabel(s.month_start))+'のClover</span><span>🍀</span></div>'+(multi?'<div class="clover-garden-community">'+esc(communityMap.get(s.community_id)||'Community')+'</div>':'')+mini(s)+'</div>').join('');
        return '<div class="clover-garden-year"><div class="clover-garden-year-label">'+esc(year)+'年</div><div class="clover-garden-strip">'+cards+'</div></div>';
      }).join('')+'</div>';
    }
    section.innerHTML='<div class="clover-garden-head"><div><h2 class="clover-garden-title">🍀 Clover Garden</h2><p class="clover-garden-sub">月末のCloverを、消さずに少しずつ残していきます。</p></div><span class="clover-garden-badge">ARCHIVE</span></div>'+body+'<div class="clover-garden-note">過去月は、あとから同期されたMeetupがあれば再計算して更新します。</div>';
    root.appendChild(section);
  }

  async function run(){
    if(running)return;
    const root=document.getElementById(ROOT_ID);
    if(!root||root.dataset.ready!=="1")return;
    const ids=communityIds();
    if(!ids.length)return;
    const sb=getClient();
    if(!sb)return;
    running=true;
    const seq=++renderSeq;
    try{
      ensureStyle();
      const auth=await sb.auth.getSession();
      const session=auth&&auth.data&&auth.data.session;
      if(!session)return;
      const uid=session.user.id;
      const [snapshotsResult,communityResult]=await Promise.all([
        getSnapshots(sb,uid,ids),
        sb.from("communities").select("id,name").in("id",ids)
      ]);
      if(seq!==renderSeq)return;
      const refreshed=await refreshArchives(sb,uid,ids,snapshotsResult,new Date());
      if(seq!==renderSeq)return;
      const communityMap=new Map(((communityResult&&communityResult.data)||[]).map(x=>[x.id,x.name]));
      const liveRoot=document.getElementById(ROOT_ID);
      if(liveRoot&&liveRoot.dataset.ready==="1")renderGarden(liveRoot,refreshed,communityMap,new Date());
    }catch(err){
      console.warn("Clover Garden archive skipped",err);
    }finally{
      running=false;
    }
  }

  function schedule(){setTimeout(run,100)}
  const observer=new MutationObserver(schedule);
  observer.observe(document.documentElement,{subtree:true,childList:true});
  window.addEventListener("hashchange",()=>{renderSeq++;document.getElementById(GARDEN_ID)?.remove();schedule()});
  window.addEventListener("pageshow",schedule);
  schedule();
})();
