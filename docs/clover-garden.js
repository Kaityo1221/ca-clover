(function(){
  "use strict";

  const SUPABASE_URL="https://wgiittrvgtiosogyhfcl.supabase.co";
  const SUPABASE_KEY="sb_publishable_QTCqijfNvnysUTMylNIyTA_6ngosaPN";
  const ROOT_ID="homeCloverRoot";
  const GARDEN_ID="cloverGardenBase";
  const ARCHIVE_START=new Date(2026,8,1); // 2026-09-01 JST
  const SEEN_KEY_PREFIX="ca-clover-garden-seen:";
  const LUCKY_CLOVER_CHANCE=0.005; // 0.5% per Garden view. Decorative only, never saved.
  let client=null;
  let running=false;
  let renderSeq=0;
  let lastRoot=null;
  let modalKeyHandler=null;

  const SLOT_LAYOUT=[
    [14,18,-10],[41,15,7],[70,20,-5],
    [22,40,9],[52,37,-7],[80,42,11],
    [12,63,5],[39,64,-12],[68,63,7],
    [24,82,-5],[54,81,11],[81,82,-8]
  ];

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
      .clover-garden-base{position:relative;border:1px solid #d8e4c8;border-radius:28px;padding:18px;background:linear-gradient(145deg,#fffdf8,#fbf8ef);box-shadow:0 16px 42px rgba(74,90,55,.08);overflow:hidden}
      .clover-garden-base:before{content:"";position:absolute;inset:0;pointer-events:none;opacity:.34;background-image:radial-gradient(circle at 20% 20%,rgba(118,97,70,.08) 0 1px,transparent 1.2px),radial-gradient(circle at 70% 50%,rgba(118,97,70,.06) 0 .8px,transparent 1px);background-size:23px 21px,17px 19px;mix-blend-mode:multiply}
      .clover-garden-head{position:relative;z-index:1;display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.clover-garden-title{margin:0;color:#31511f;font-size:clamp(22px,4.5vw,29px);font-weight:950;letter-spacing:-.025em}.clover-garden-sub{margin:5px 0 0;color:#7b8b73;font-size:11px;font-weight:850;line-height:1.6}.clover-garden-badge{flex:0 0 auto;border:1px solid #e2d7be;background:#fff9e9;color:#8b7659;border-radius:999px;padding:6px 10px;font-size:10px;font-weight:950;letter-spacing:.08em}
      .clover-garden-empty{position:relative;z-index:1;margin-top:15px;border:1px dashed #d6ccb8;border-radius:20px;padding:18px;background:rgba(255,252,242,.78);color:#746f62;font-size:12px;font-weight:850;line-height:1.72;text-align:center}.clover-garden-years{position:relative;z-index:1;display:grid;gap:18px;margin-top:16px}
      .clover-year-sheet{position:relative;min-height:430px;border:1px solid #d9ccb3;border-radius:8px 17px 10px 14px;padding:18px 16px 20px;overflow:hidden;background-color:#fbf2d8;background-image:linear-gradient(100deg,rgba(255,255,255,.32),transparent 20%,rgba(139,108,66,.025) 58%,transparent 82%),repeating-linear-gradient(0deg,rgba(115,91,57,.018) 0 1px,transparent 1px 4px),radial-gradient(circle at 12% 18%,rgba(96,71,42,.05) 0 .8px,transparent 1px),radial-gradient(circle at 76% 64%,rgba(96,71,42,.04) 0 .7px,transparent .9px);background-size:auto,auto,19px 17px,23px 21px;box-shadow:0 10px 24px rgba(90,72,48,.09),inset 0 0 34px rgba(143,107,60,.045);transform:rotate(-.18deg)}
      .clover-year-sheet:before,.clover-year-sheet:after{content:"";position:absolute;top:-7px;width:64px;height:18px;background:rgba(228,211,168,.64);border:1px solid rgba(173,147,101,.18);box-shadow:0 2px 5px rgba(95,70,40,.04);z-index:4}.clover-year-sheet:before{left:18px;transform:rotate(-5deg)}.clover-year-sheet:after{right:22px;transform:rotate(6deg)}
      .clover-sheet-head{position:relative;z-index:3;display:flex;align-items:flex-end;justify-content:space-between;gap:10px}.clover-sheet-year{font-family:"Hiragino Mincho ProN","Yu Mincho",serif;color:#715e43;font-size:22px;font-weight:800;letter-spacing:.06em}.clover-sheet-community{max-width:58%;color:#9b876a;font-size:9px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:right}.clover-sheet-rule{position:absolute;left:17px;right:17px;top:52px;border-top:1px solid rgba(127,103,72,.13)}
      .clover-sheet-field{position:absolute;left:10px;right:10px;top:62px;bottom:12px}.clover-sheet-field:before{content:"herbarium";position:absolute;right:8px;bottom:2px;color:rgba(113,94,67,.17);font:700 10px/1 Georgia,serif;letter-spacing:.18em;text-transform:uppercase}
      .clover-specimen{position:absolute;left:var(--x);top:var(--y);width:104px;height:116px;border:0;background:transparent;padding:0;margin:0;transform:translate(-50%,-50%) rotate(var(--rot));transform-origin:50% 58%;cursor:pointer;-webkit-tap-highlight-color:transparent;z-index:var(--z);filter:drop-shadow(0 4px 4px rgba(64,79,46,.08));transition:transform .32s ease,filter .32s ease}.clover-specimen:active{transform:translate(-50%,-50%) rotate(var(--rot)) scale(.96)}
      .clover-specimen:hover{filter:drop-shadow(0 7px 8px rgba(64,79,46,.12))}.clover-specimen.is-dropping{animation:cloverGardenDrop var(--drop-duration,2.2s) cubic-bezier(.18,.72,.16,1) both;z-index:30}.clover-specimen.is-year-shuffling{animation:cloverYearShuffle 1.55s cubic-bezier(.2,.75,.22,1) both}
      @keyframes cloverGardenDrop{0%{opacity:0;transform:translate(calc(-50% + var(--drop-x,0px)),calc(-50% - 240px)) rotate(calc(var(--rot) - 24deg)) scale(.88)}42%{opacity:1;transform:translate(calc(-50% + var(--drift-x,0px)),calc(-50% - 38px)) rotate(calc(var(--rot) + 11deg)) scale(1.035,.97)}64%{transform:translate(calc(-50% + var(--drift-x2,0px)),calc(-50% + 7px)) rotate(calc(var(--rot) - 4deg)) scale(.985,1.025)}80%{transform:translate(-50%,calc(-50% - 4px)) rotate(calc(var(--rot) + 2deg)) scale(1.012,.994)}100%{opacity:1;transform:translate(-50%,-50%) rotate(var(--rot)) scale(1)}}
      @keyframes cloverYearShuffle{0%{transform:translate(-50%,-50%) rotate(var(--rot))}48%{transform:translate(calc(-50% + var(--shuffle-x)),calc(-50% + var(--shuffle-y))) rotate(calc(var(--rot) + var(--shuffle-r))) scale(1.015)}100%{transform:translate(-50%,-50%) rotate(var(--rot))}}
      .clover-specimen-plant{position:absolute;left:8px;top:4px;width:88px;height:88px;transform:rotate(-2deg)}.clover-specimen-stem{position:absolute;left:43px;top:50px;width:6px;height:51px;border-radius:999px;background:linear-gradient(90deg,#83c769,#3f9650);transform:rotate(15deg);transform-origin:50% 0;box-shadow:inset 1px 0 rgba(255,255,255,.5);z-index:0}
      .clover-specimen-leaf{position:absolute;width:40px;height:40px;border-radius:74% 43% 74% 43%;transform-origin:92% 92%;border:1px solid rgba(37,119,57,.24);box-shadow:inset 4px 4px 10px rgba(255,255,255,.18),inset -4px -5px 9px rgba(24,92,45,.09);opacity:var(--leaf-opacity);filter:saturate(var(--sat));z-index:2}.clover-specimen-leaf:after{content:"";position:absolute;left:9px;top:8px;width:19px;height:25px;border-left:1px solid rgba(235,248,184,.38);border-radius:50%;transform:rotate(-42deg)}
      .clover-specimen-leaf.stage-0{background:linear-gradient(145deg,#eff5db,#c8dda5);--leaf-opacity:.58;--sat:.70}.clover-specimen-leaf.stage-1{background:linear-gradient(145deg,#e0f2b2,#9dcf69);--leaf-opacity:.78;--sat:.86}.clover-specimen-leaf.stage-2{background:linear-gradient(145deg,#c8ec78,#69b84f);--leaf-opacity:.9;--sat:.98}.clover-specimen-leaf.stage-3{background:linear-gradient(145deg,#aee85c,#3fa34b);--leaf-opacity:.97;--sat:1.06}.clover-specimen-leaf.stage-4{background:linear-gradient(145deg,#9ce147,#218841);--leaf-opacity:1;--sat:1.13}
      .clover-specimen-leaf.top{left:24px;top:1px;transform:rotate(45deg) scale(var(--leaf-scale))}.clover-specimen-leaf.right{left:47px;top:24px;transform:rotate(135deg) scale(var(--leaf-scale))}.clover-specimen-leaf.bottom{left:24px;top:47px;transform:rotate(225deg) scale(var(--leaf-scale))}.clover-specimen-leaf.left{left:1px;top:24px;transform:rotate(315deg) scale(var(--leaf-scale))}.clover-specimen-center{position:absolute;left:38px;top:38px;width:12px;height:12px;border-radius:50%;background:#4fa147;border:1px solid rgba(225,241,154,.72);box-shadow:0 2px 5px rgba(50,91,42,.12);z-index:3}
      .clover-specimen-tag{position:absolute;left:6px;right:2px;bottom:0;min-height:27px;padding:4px 5px 3px;border:1px solid rgba(144,119,83,.14);border-radius:2px 5px 3px 4px;background:rgba(255,252,237,.83);box-shadow:0 2px 5px rgba(102,78,48,.05);transform:rotate(-1.5deg);color:#6f604e;text-align:center}.clover-specimen-month{display:block;font-family:"Hiragino Mincho ProN","Yu Mincho",serif;font-size:11px;font-weight:800;line-height:1.1}.clover-specimen-name{display:block;margin-top:2px;font-size:7px;font-weight:800;color:#998871;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .clover-year-complete{position:absolute;left:50%;bottom:14px;z-index:40;transform:translate(-50%,18px);opacity:0;pointer-events:none;padding:8px 13px;border:1px solid rgba(124,100,66,.18);border-radius:999px;background:rgba(255,250,232,.94);color:#6d5c43;font-size:11px;font-weight:950;box-shadow:0 8px 20px rgba(84,67,43,.10)}.clover-year-complete.show{animation:cloverCompleteMessage 4.2s ease both}@keyframes cloverCompleteMessage{0%{opacity:0;transform:translate(-50%,18px)}14%,76%{opacity:1;transform:translate(-50%,0)}100%{opacity:0;transform:translate(-50%,-5px)}}
      .clover-lucky{position:absolute;left:var(--lucky-left);top:0;width:54px;height:64px;z-index:90;border:0;background:transparent;padding:0;margin:0;cursor:pointer;-webkit-tap-highlight-color:transparent;transform-origin:50% 50%;filter:drop-shadow(0 4px 6px rgba(38,104,48,.18));animation:cloverLuckyFall var(--lucky-duration,6.1s) cubic-bezier(.23,.57,.22,1) both;will-change:transform,opacity,filter}
      .clover-lucky:before{content:"";position:absolute;left:50%;top:25px;width:58px;height:58px;border-radius:50%;transform:translate(-50%,-50%);background:radial-gradient(circle,rgba(203,255,126,.38),rgba(179,244,91,.14) 42%,transparent 72%);opacity:.18;animation:cloverLuckyGlow 1.45s ease-in-out 2.4s 2 alternate;pointer-events:none}
      .clover-lucky-leaf{position:absolute;left:19px;top:10px;width:22px;height:22px;border:1px solid rgba(37,122,59,.28);border-radius:76% 42% 76% 42%;background:linear-gradient(145deg,#c8f47c 0%,#67cb51 48%,#239244 100%);box-shadow:inset 3px 3px 6px rgba(255,255,255,.26),inset -3px -3px 6px rgba(23,92,43,.08);transform-origin:90% 90%}.clover-lucky-leaf.a{transform:rotate(45deg) translate(-8px,-8px)}.clover-lucky-leaf.b{transform:rotate(135deg) translate(-8px,-8px)}.clover-lucky-leaf.c{transform:rotate(225deg) translate(-8px,-8px)}.clover-lucky-leaf.d{transform:rotate(315deg) translate(-8px,-8px)}
      .clover-lucky-center{position:absolute;left:25px;top:20px;width:8px;height:8px;border-radius:50%;background:#4bb447;border:1px solid rgba(230,250,154,.72)}.clover-lucky-stem{position:absolute;left:29px;top:27px;width:4px;height:34px;border-radius:999px;background:linear-gradient(90deg,#8bd46b,#2b8d49);transform:rotate(18deg);transform-origin:50% 0;z-index:-1}
      .clover-lucky.is-caught{animation:cloverLuckyTap .48s cubic-bezier(.2,.8,.24,1) forwards!important}.clover-lucky.is-caught:before{animation:cloverLuckyCaughtGlow .48s ease forwards!important}
      @keyframes cloverLuckyFall{0%{opacity:0;transform:translate3d(-50%,-72px,0) rotate(-24deg) scale(.82)}9%{opacity:1}48%{opacity:1;transform:translate3d(calc(-50% + var(--lucky-drift-a)),var(--lucky-mid),0) rotate(126deg) scale(1)}68%{opacity:1;transform:translate3d(calc(-50% + var(--lucky-drift-b)),var(--lucky-late),0) rotate(202deg) scale(1.03);filter:drop-shadow(0 0 10px rgba(138,221,74,.48)) brightness(1.08)}82%{opacity:.96;transform:translate3d(calc(-50% + var(--lucky-roll)),calc(var(--lucky-late) + 28px),0) rotate(290deg) scale(.96)}100%{opacity:0;transform:translate3d(calc(-50% + var(--lucky-exit)),var(--lucky-fall),0) rotate(430deg) scale(.72)}}
      @keyframes cloverLuckyGlow{0%{opacity:.12;transform:translate(-50%,-50%) scale(.8)}100%{opacity:.62;transform:translate(-50%,-50%) scale(1.28)}}
      @keyframes cloverLuckyTap{0%{opacity:1;transform:translate3d(-50%,0,0) rotate(0) scale(1)}48%{opacity:1;transform:translate3d(-50%,-8px,0) rotate(15deg) scale(1.22)}100%{opacity:0;transform:translate3d(-50%,-16px,0) rotate(28deg) scale(.42)}}
      @keyframes cloverLuckyCaughtGlow{0%{opacity:.28;transform:translate(-50%,-50%) scale(.8)}55%{opacity:.86;transform:translate(-50%,-50%) scale(1.6)}100%{opacity:0;transform:translate(-50%,-50%) scale(2)}}
      .clover-garden-note{position:relative;z-index:1;margin-top:10px;color:#98a08e;font-size:9px;font-weight:800;line-height:1.55}
      .clover-garden-modal{position:fixed;inset:0;z-index:9998;display:grid;place-items:center;padding:18px;background:rgba(34,48,28,.34);backdrop-filter:blur(7px)}.clover-garden-dialog{position:relative;width:min(390px,100%);border:1px solid #dfd1b9;border-radius:25px;padding:20px;background:linear-gradient(145deg,#fffdf8,#fff9e9);box-shadow:0 28px 70px rgba(38,48,31,.24)}.clover-garden-close{position:absolute;right:12px;top:12px;width:34px;height:34px;border:1px solid #e4dbc8;border-radius:50%;background:#fffdf7;color:#806f59;font-size:18px;font-weight:900}.clover-garden-dialog h3{margin:0;padding-right:42px;color:#4a633a;font-size:20px}.clover-garden-dialog-sub{margin:4px 0 14px;color:#97866e;font-size:10px;font-weight:850}.clover-garden-metrics{display:grid;grid-template-columns:1fr 1fr;gap:8px}.clover-garden-metric{border:1px solid #e7dfd0;border-radius:16px;padding:11px;background:rgba(255,255,255,.78)}.clover-garden-metric b{display:block;color:#49623c;font-size:15px}.clover-garden-metric span{display:block;margin-top:3px;color:#887b69;font-size:9px;font-weight:850}.clover-garden-stage-row{display:flex;gap:4px;margin-top:7px}.clover-garden-stage-dot{width:7px;height:7px;border-radius:50%;background:#e3e1d4}.clover-garden-stage-dot.on{background:#6ab34d}
      @media(max-width:680px){.clover-garden-base{padding:16px}.clover-year-sheet{min-height:500px;padding-left:12px;padding-right:12px}.clover-sheet-field{left:2px;right:2px;top:64px}.clover-specimen{width:86px;height:105px}.clover-specimen-plant{left:3px;top:5px;transform:scale(.86) rotate(-2deg);transform-origin:top left}.clover-specimen-tag{left:0;right:0}.clover-sheet-community{max-width:52%}}
      @media(prefers-reduced-motion:reduce){.clover-specimen.is-dropping,.clover-specimen.is-year-shuffling,.clover-year-complete.show{animation:none!important}.clover-year-complete.show{opacity:1;transform:translate(-50%,0)}.clover-lucky{display:none!important}}
    `;
    document.head.appendChild(style);
  }

  function monthStart(date){return new Date(date.getFullYear(),date.getMonth(),1)}
  function addMonths(date,count){return new Date(date.getFullYear(),date.getMonth()+count,1)}
  function monthKey(date){return date.getFullYear()+"-"+String(date.getMonth()+1).padStart(2,"0")+"-01"}
  function monthLabel(value){const d=new Date(value+"T00:00:00");return Number.isFinite(d.getTime())?(d.getMonth()+1)+"月":""}
  function esc(v){return String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"})[c])}
  function clampStage(v){return Math.max(0,Math.min(4,Number(v)||0))}
  function snapshotKey(s){return s.community_id+"|"+s.month_start}
  function hash(value){let h=2166136261;for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
  function jitter(seed,range){return ((hash(seed)%1001)/1000-.5)*range*2}
  function leafScale(stage){return (.78+clampStage(stage)*.055).toFixed(3)}

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

  function seenState(uid,snapshots){
    const key=SEEN_KEY_PREFIX+uid;
    let state=null;
    try{state=JSON.parse(localStorage.getItem(key)||"null")}catch(_){state=null}
    const all=snapshots.map(snapshotKey);
    let fresh=[];
    if(!state||!state.initialized){
      if(all.length)fresh=[all[all.length-1]];
      state={initialized:true,seen:all};
    }else{
      const seen=new Set(Array.isArray(state.seen)?state.seen:[]);
      fresh=all.filter(k=>!seen.has(k));
      state={initialized:true,seen:[...new Set([...seen,...all])].slice(-120)};
    }
    try{localStorage.setItem(key,JSON.stringify(state))}catch(_){ }
    return new Set(fresh);
  }

  function specimenHtml(s,communityName,isNew,index){
    const d=new Date(s.month_start+"T00:00:00");
    const month=Math.max(1,Math.min(12,d.getMonth()+1));
    const slot=SLOT_LAYOUT[month-1];
    const seed=snapshotKey(s);
    const x=(slot[0]+jitter(seed+"x",2.5)).toFixed(2)+"%";
    const y=(slot[1]+jitter(seed+"y",2.1)).toFixed(2)+"%";
    const rot=(slot[2]+jitter(seed+"r",3.2)).toFixed(2)+"deg";
    const dropDuration=(1.85+(hash(seed+"d")%71)/100).toFixed(2)+"s";
    const driftX=(jitter(seed+"dx",17)).toFixed(1)+"px";
    const driftX2=(jitter(seed+"dx2",8)).toFixed(1)+"px";
    const dropX=(jitter(seed+"drop",34)).toFixed(1)+"px";
    const shuffleX=(jitter(seed+"sx",8)).toFixed(1)+"px";
    const shuffleY=(jitter(seed+"sy",6)).toFixed(1)+"px";
    const shuffleR=(jitter(seed+"sr",3.5)).toFixed(1)+"deg";
    const stages=[s.host_stage,s.join_stage,s.exchange_stage,s.continue_stage].map(clampStage);
    const plant='<span class="clover-specimen-plant" aria-hidden="true"><i class="clover-specimen-stem"></i>'+
      '<i class="clover-specimen-leaf top stage-'+stages[0]+'" style="--leaf-scale:'+leafScale(stages[0])+'"></i>'+
      '<i class="clover-specimen-leaf right stage-'+stages[1]+'" style="--leaf-scale:'+leafScale(stages[1])+'"></i>'+
      '<i class="clover-specimen-leaf bottom stage-'+stages[2]+'" style="--leaf-scale:'+leafScale(stages[2])+'"></i>'+
      '<i class="clover-specimen-leaf left stage-'+stages[3]+'" style="--leaf-scale:'+leafScale(stages[3])+'"></i><i class="clover-specimen-center"></i></span>';
    return '<button type="button" class="clover-specimen'+(isNew?' is-dropping':'')+'" data-snapshot-index="'+index+'" style="--x:'+x+';--y:'+y+';--rot:'+rot+';--z:'+(10+month)+';--drop-duration:'+dropDuration+';--drift-x:'+driftX+';--drift-x2:'+driftX2+';--drop-x:'+dropX+';--shuffle-x:'+shuffleX+';--shuffle-y:'+shuffleY+';--shuffle-r:'+shuffleR+'" aria-label="'+esc(month+'月のCloverを開く')+'">'+plant+'<span class="clover-specimen-tag"><span class="clover-specimen-month">'+month+'月</span><span class="clover-specimen-name">'+esc(communityName||"Community")+'</span></span></button>';
  }

  function stageDots(stage){
    let html='<div class="clover-garden-stage-row" aria-label="Stage '+clampStage(stage)+'">';
    for(let i=1;i<=4;i++)html+='<i class="clover-garden-stage-dot'+(i<=clampStage(stage)?' on':'')+'"></i>';
    return html+'</div>';
  }

  function closeModal(){
    document.querySelector(".clover-garden-modal")?.remove();
    if(modalKeyHandler){document.removeEventListener("keydown",modalKeyHandler);modalKeyHandler=null}
  }

  function openSnapshotModal(snapshot,communityName){
    closeModal();
    const month=monthLabel(snapshot.month_start);
    const modal=document.createElement("div");
    modal.className="clover-garden-modal";
    modal.innerHTML='<div class="clover-garden-dialog" role="dialog" aria-modal="true" aria-label="'+esc(month+'のClover')+'"><button class="clover-garden-close" type="button" aria-label="閉じる">×</button><h3>'+esc(month+'のClover')+'</h3><div class="clover-garden-dialog-sub">'+esc(communityName||"Community")+' ・ '+esc(String(snapshot.month_start||"").slice(0,4))+'年</div><div class="clover-garden-metrics">'+
      '<div class="clover-garden-metric"><b>🔥 '+Number(snapshot.meetup_count||0)+'回</b><span>開催</span>'+stageDots(snapshot.host_stage)+'</div>'+
      '<div class="clover-garden-metric"><b>✅ '+Number(snapshot.checkin_count||0).toLocaleString("ja-JP")+'人</b><span>Check-in</span>'+stageDots(snapshot.join_stage)+'</div>'+
      '<div class="clover-garden-metric"><b>🤝 '+Number(snapshot.exchange_count||0)+'回</b><span>交流</span>'+stageDots(snapshot.exchange_stage)+'</div>'+
      '<div class="clover-garden-metric"><b>🌱 '+Number(snapshot.active_week_count||0)+'週</b><span>継続</span>'+stageDots(snapshot.continue_stage)+'</div></div></div>';
    modal.addEventListener("click",e=>{if(e.target===modal||e.target.closest(".clover-garden-close"))closeModal()});
    document.body.appendChild(modal);
    modal.querySelector(".clover-garden-close")?.focus();
    modalKeyHandler=e=>{if(e.key==="Escape")closeModal()};
    document.addEventListener("keydown",modalKeyHandler);
  }

  function groupSnapshots(snapshots){
    const groups=new Map();
    snapshots.forEach(s=>{
      const year=String(s.month_start||"").slice(0,4);
      const key=s.community_id+"|"+year;
      if(!groups.has(key))groups.set(key,{communityId:s.community_id,year,items:[]});
      groups.get(key).items.push(s);
    });
    return [...groups.values()].sort((a,b)=>Number(b.year)-Number(a.year)||a.communityId.localeCompare(b.communityId));
  }


  function maybeSpawnLuckyClover(section){
    if(!section||section.querySelector(".clover-lucky"))return;
    if(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
    if(Math.random()>=LUCKY_CLOVER_CHANCE)return;

    const lucky=document.createElement("button");
    lucky.type="button";
    lucky.className="clover-lucky";
    lucky.setAttribute("aria-label","小さな四つ葉");
    lucky.title="🍀";
    lucky.innerHTML='<i class="clover-lucky-stem" aria-hidden="true"></i><i class="clover-lucky-leaf a" aria-hidden="true"></i><i class="clover-lucky-leaf b" aria-hidden="true"></i><i class="clover-lucky-leaf c" aria-hidden="true"></i><i class="clover-lucky-leaf d" aria-hidden="true"></i><i class="clover-lucky-center" aria-hidden="true"></i>';

    const width=Math.max(280,section.clientWidth||320);
    const height=Math.max(280,section.clientHeight||420);
    const start=24+Math.random()*52;
    const direction=Math.random()<.5?-1:1;
    lucky.style.setProperty("--lucky-left",start.toFixed(2)+"%");
    lucky.style.setProperty("--lucky-duration",(5.6+Math.random()*1.25).toFixed(2)+"s");
    lucky.style.setProperty("--lucky-mid",Math.round(height*.42)+"px");
    lucky.style.setProperty("--lucky-late",Math.round(height*.66)+"px");
    lucky.style.setProperty("--lucky-fall",Math.round(height+110)+"px");
    lucky.style.setProperty("--lucky-drift-a",Math.round((Math.random()-.5)*42)+"px");
    lucky.style.setProperty("--lucky-drift-b",Math.round((Math.random()-.5)*58)+"px");
    lucky.style.setProperty("--lucky-roll",Math.round(direction*(34+Math.random()*28))+"px");
    lucky.style.setProperty("--lucky-exit",Math.round(direction*(width*.72+90))+"px");

    const remove=()=>{if(lucky.isConnected)lucky.remove()};
    lucky.addEventListener("click",()=>{
      if(lucky.classList.contains("is-caught"))return;
      lucky.classList.add("is-caught");
      setTimeout(remove,520);
    });
    lucky.addEventListener("animationend",e=>{
      if(e.animationName==="cloverLuckyFall"||e.animationName==="cloverLuckyTap")remove();
    });

    const delay=900+Math.random()*2600;
    setTimeout(()=>{
      if(section.isConnected&&!section.querySelector(".clover-lucky"))section.appendChild(lucky);
    },delay);
  }

  function renderGarden(root,snapshots,communityMap,now,uid){
    let section=document.getElementById(GARDEN_ID);
    if(section)section.remove();
    section=document.createElement("section");
    section.id=GARDEN_ID;
    section.className="clover-garden-base";
    const freshKeys=seenState(uid,snapshots);
    const groups=groupSnapshots(snapshots);
    const multi=communityMap.size>1;
    let body='';
    if(!snapshots.length){
      body='<div class="clover-garden-empty">🌱 最初のCloverは、月が変わるとここに残ります。<br>9月の活動は10月になったら、最初の1枚としてこのシートに置かれます。</div>';
    }else{
      body='<div class="clover-garden-years">'+groups.map(group=>{
        const name=communityMap.get(group.communityId)||"Community";
        const items=group.items.slice().sort((a,b)=>String(a.month_start).localeCompare(String(b.month_start)));
        const hasFresh=items.some(s=>freshKeys.has(snapshotKey(s)));
        const complete=items.length>=12&&items.some(s=>String(s.month_start).slice(5,7)==="12");
        const specimens=items.map(s=>specimenHtml(s,name,freshKeys.has(snapshotKey(s)),snapshots.indexOf(s))).join('');
        return '<article class="clover-year-sheet" data-year="'+esc(group.year)+'" data-community-id="'+esc(group.communityId)+'" data-has-fresh="'+(hasFresh?'1':'0')+'" data-complete="'+(complete?'1':'0')+'"><div class="clover-sheet-head"><div class="clover-sheet-year">'+esc(group.year)+'年</div>'+(multi?'<div class="clover-sheet-community">'+esc(name)+'</div>':'')+'</div><div class="clover-sheet-rule"></div><div class="clover-sheet-field">'+specimens+'</div><div class="clover-year-complete">'+esc(group.year)+'年のCloverがそろいました。</div></article>';
      }).join('')+'</div>';
    }
    section.innerHTML='<div class="clover-garden-head"><div><h2 class="clover-garden-title">🍀 Clover Garden</h2><p class="clover-garden-sub">ひと月ごとのCloverを、押し花のように1年のシートへ残していきます。</p></div><span class="clover-garden-badge">HERBARIUM</span></div>'+body+'<div class="clover-garden-note">過去月は、あとから同期されたMeetupがあれば再計算して更新します。</div>';
    root.appendChild(section);

    section.querySelectorAll("[data-snapshot-index]").forEach(btn=>btn.addEventListener("click",()=>{
      const s=snapshots[Number(btn.dataset.snapshotIndex)];
      if(s)openSnapshotModal(s,communityMap.get(s.community_id)||"Community");
    }));

    if(!window.matchMedia||!window.matchMedia("(prefers-reduced-motion: reduce)").matches){
      section.querySelectorAll(".clover-year-sheet[data-has-fresh='1']").forEach((sheet,sheetIndex)=>{
        const fresh=sheet.querySelectorAll(".clover-specimen.is-dropping");
        fresh.forEach((el,i)=>{el.style.animationDelay=(sheetIndex*.12+i*.22)+"s"});
        if(sheet.dataset.complete==="1"){
          const maxDelay=Math.max(0,fresh.length-1)*220+2450;
          setTimeout(()=>{
            sheet.querySelectorAll(".clover-specimen").forEach((el,i)=>{
              el.style.animationDelay=(i*24)+"ms";
              el.classList.add("is-year-shuffling");
              setTimeout(()=>el.classList.remove("is-year-shuffling"),1750+i*24);
            });
            const msg=sheet.querySelector(".clover-year-complete");
            if(msg){msg.classList.add("show");setTimeout(()=>msg.classList.remove("show"),4300)}
          },maxDelay);
        }
      });
    }
    maybeSpawnLuckyClover(section);
  }

  async function run(){
    if(running)return;
    const root=document.getElementById(ROOT_ID);
    if(!root||root.dataset.ready!=="1")return;
    if(root===lastRoot&&root.querySelector("#"+GARDEN_ID))return;
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
      if(liveRoot&&liveRoot.dataset.ready==="1"){
        renderGarden(liveRoot,refreshed,communityMap,new Date(),uid);
        lastRoot=liveRoot;
      }
    }catch(err){
      console.warn("Clover Garden archive skipped",err);
    }finally{
      running=false;
    }
  }

  function schedule(){setTimeout(run,100)}
  const observer=new MutationObserver(schedule);
  observer.observe(document.documentElement,{subtree:true,childList:true});
  window.addEventListener("hashchange",()=>{renderSeq++;lastRoot=null;closeModal();document.getElementById(GARDEN_ID)?.remove();schedule()});
  window.addEventListener("pageshow",schedule);
  schedule();
})();
