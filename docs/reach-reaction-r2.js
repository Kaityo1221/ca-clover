(function(){
  "use strict";

  const VERSION="reach-reaction-r2-20260928";
  const MIN_REFERENCE=5;
  const MIN_TREND=10;
  const MIN_GROUP_SAMPLE=3;
  const STRONG_RATIO=1.25;
  const STRONG_DIFF=2;
  let mountSerial=0;
  let retryTimer=null;

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

  function formatGrowth(v){
    if(!Number.isFinite(v))return "—";
    return (v>0?"+":"")+Number(v).toLocaleString("ja-JP");
  }

  function confidence(count){
    if(count>=MIN_TREND)return {key:"trend",label:"傾向あり",tone:"strong"};
    if(count>=MIN_REFERENCE)return {key:"reference",label:"参考傾向",tone:"reference"};
    return {key:"detecting",label:"傾向検出中",tone:"detecting"};
  }

  function validGroups(groups){
    return (groups||[]).filter(function(g){
      return g&&g.sampleCount>=MIN_GROUP_SAMPLE&&Number.isFinite(g.median24h);
    });
  }

  function topGroup(groups){
    const list=validGroups(groups).slice().sort(function(a,b){
      if(b.median24h!==a.median24h)return b.median24h-a.median24h;
      return b.sampleCount-a.sampleCount;
    });
    return list[0]||null;
  }

  function isStrong(group,overall){
    if(!group||!Number.isFinite(group.median24h)||!Number.isFinite(overall))return false;
    const diff=group.median24h-overall;
    if(diff<STRONG_DIFF)return false;
    if(overall<=0)return group.median24h>=STRONG_DIFF;
    return group.median24h>=overall*STRONG_RATIO;
  }

  function deriveType(result){
    const summary=result&&result.summary?result.summary:{};
    const count=Number(summary.analyzable24hCount)||0;
    if(count<MIN_REFERENCE)return {type:"傾向検出中",dayType:null,daypart:null};

    const overall=summary.overallMedian24h;
    const dayType=topGroup(summary.byDayType);
    const daypart=topGroup(summary.byDaypart);
    const strongDayType=isStrong(dayType,overall)?dayType:null;
    const strongDaypart=isStrong(daypart,overall)?daypart:null;

    if(strongDayType&&strongDaypart){
      return {type:String(strongDayType.label)+String(strongDaypart.label)+"型",dayType:strongDayType,daypart:strongDaypart};
    }
    if(strongDayType)return {type:String(strongDayType.label)+"型",dayType:strongDayType,daypart:null};
    if(strongDaypart)return {type:String(strongDaypart.label)+"型",dayType:null,daypart:strongDaypart};
    return {type:"バランス型",dayType:null,daypart:null};
  }

  function detailLeaders(result){
    const summary=result.summary||{};
    const time=topGroup(summary.byTwoHour);
    const weekday=topGroup(summary.byWeekday);
    return {time,weekday};
  }

  function ensureStyle(){
    if(document.getElementById("caReachReactionR2Style"))return;
    const style=document.createElement("style");
    style.id="caReachReactionR2Style";
    style.textContent=`
      .reaction-r2{width:100%;max-width:100%;min-width:0;box-sizing:border-box;margin:18px 0 2px;border:1px solid #d8b4fe;border-radius:22px;padding:17px;background:linear-gradient(145deg,#faf5ff,#fff 58%,#f5f3ff);overflow:hidden}
      .reaction-r2-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
      .reaction-r2-kicker{font-size:10px;font-weight:950;letter-spacing:.06em;color:#7c3aed;text-transform:uppercase}
      .reaction-r2-confidence{display:inline-flex;align-items:center;border-radius:999px;padding:6px 10px;font-size:10px;font-weight:950;border:1px solid #ddd6fe;background:#fff;color:#6d28d9}
      .reaction-r2-confidence.reference{background:#fffbeb;border-color:#fde68a;color:#92400e}
      .reaction-r2-confidence.strong{background:#ecfdf5;border-color:#bbf7d0;color:#166534}
      .reaction-r2-main{margin-top:12px;padding:15px;border-radius:18px;background:rgba(255,255,255,.82);border:1px solid #ede9fe}
      .reaction-r2-main .lead{font-size:12px;font-weight:900;color:#64748b}
      .reaction-r2-main .type{margin-top:4px;font-size:27px;font-weight:950;line-height:1.15;color:#4c1d95;letter-spacing:-.02em;overflow-wrap:anywhere}
      .reaction-r2-main .note{margin-top:8px;font-size:11px;font-weight:850;line-height:1.65;color:#64748b}
      .reaction-r2-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:10px}
      .reaction-r2-stat{min-width:0;border:1px solid #ede9fe;border-radius:16px;padding:11px 12px;background:#fff}
      .reaction-r2-stat span{display:block;font-size:9px;font-weight:950;color:#7c3aed}
      .reaction-r2-stat b{display:block;margin-top:4px;font-size:17px;color:#4c1d95;overflow-wrap:anywhere}
      .reaction-r2-foot{margin-top:10px;font-size:10px;font-weight:850;line-height:1.6;color:#94a3b8}
      .reaction-r2-loading{padding:15px;border:1px dashed #c4b5fd;border-radius:18px;color:#6d28d9;background:#faf5ff;font-size:11px;font-weight:900}
      @media(max-width:480px){.reaction-r2{padding:14px}.reaction-r2-main .type{font-size:24px}.reaction-r2-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
    `;
    document.head.appendChild(style);
  }

  function cardHtml(result){
    const summary=result.summary||{};
    const count=Number(summary.analyzable24hCount)||0;
    const eligible=Number(summary.eligibleObservationCount)||0;
    const pending=Number(summary.pending24hCount)||0;
    const excluded=Number(summary.excludedCount)||0;
    const conf=confidence(count);
    const type=deriveType(result);
    const leaders=detailLeaders(result);

    let note="";
    if(count<MIN_REFERENCE){
      const remain=Math.max(0,MIN_REFERENCE-count);
      note="作成直後から追えるMeetupを蓄積しています。あと"+remain+"件で参考傾向を表示します。";
    }else if(type.type==="バランス型"){
      note="今のところ、特定の時間帯や平日・休日へ強く偏る傾向は見つかっていません。";
    }else{
      note="作成後24時間のRSVP増加中央値から、Communityの反応傾向を判定しています。";
    }

    const timeText=count>=MIN_REFERENCE&&leaders.time?leaders.time.label+" / "+formatGrowth(leaders.time.median24h):"蓄積中";
    const weekdayText=count>=MIN_REFERENCE&&leaders.weekday?leaders.weekday.label+"曜日 / "+formatGrowth(leaders.weekday.median24h):"蓄積中";

    return '<div class="reaction-r2-head"><div><div class="reaction-r2-kicker">Community Reaction</div><h3 style="margin:3px 0 0;color:#4c1d95;font-size:18px">🍀 メンバーは、いつ反応する？</h3></div><span class="reaction-r2-confidence '+esc(conf.tone)+'">'+esc(conf.label)+'</span></div>'+
      '<div class="reaction-r2-main"><div class="lead">あなたのCommunityは</div><div class="type">'+esc(type.type)+'</div><div class="note">'+esc(note)+'</div></div>'+
      '<div class="reaction-r2-grid">'+
        '<div class="reaction-r2-stat"><span>反応が良い時間帯</span><b>'+esc(timeText)+'</b></div>'+
        '<div class="reaction-r2-stat"><span>反応が良い曜日</span><b>'+esc(weekdayText)+'</b></div>'+
        '<div class="reaction-r2-stat"><span>24h RSVP中央値</span><b>'+esc(formatGrowth(summary.overallMedian24h))+'</b></div>'+
        '<div class="reaction-r2-stat"><span>分析対象</span><b>'+count.toLocaleString("ja-JP")+' Meetups</b></div>'+
      '</div>'+
      '<div class="reaction-r2-foot">JSTで判定 · 初回観測6時間以内を対象 · 24時間未到達 '+pending+'件 · 途中観測など除外 '+excluded+'件'+(eligible>count?' · 追跡中 '+(eligible-count)+'件':'')+'</div>';
  }

  async function mountOnce(){
    const feature=document.querySelector('.feature-app.reach.on');
    const root=document.getElementById("reach7Root");
    if(!feature||!root||!root.parentElement)return false;
    if(document.getElementById("reachReactionR2"))return true;
    if(!window.CAReachReactionR1||typeof window.CAReachReactionR1.loadCommunity!=="function")return false;
    const id=communityId();
    if(!id)return false;

    ensureStyle();
    const serial=++mountSerial;
    const box=document.createElement("section");
    box.id="reachReactionR2";
    box.className="reaction-r2";
    box.dataset.version=VERSION;
    box.innerHTML='<div class="reaction-r2-loading">Community Reactionを分析中...</div>';
    root.parentElement.insertBefore(box,root);

    try{
      const result=await window.CAReachReactionR1.loadCommunity(id);
      if(serial!==mountSerial||!document.body.contains(box))return true;
      box.innerHTML=cardHtml(result);
      window.CAReachReactionR2LastResult=result;
    }catch(err){
      console.warn("Community Reaction R2 failed",err);
      if(document.body.contains(box))box.innerHTML='<div class="reaction-r2-loading">Community Reactionの読み込みに失敗しました。Meetup個別データは引き続き確認できます。</div>';
    }
    return true;
  }

  function scheduleMount(){
    if(retryTimer)clearInterval(retryTimer);
    let attempts=0;
    const tryMount=function(){
      attempts++;
      void mountOnce().then(function(done){
        if(done&&retryTimer){clearInterval(retryTimer);retryTimer=null}
        else if(attempts>=30&&retryTimer){clearInterval(retryTimer);retryTimer=null}
      });
    };
    tryMount();
    retryTimer=setInterval(tryMount,200);
  }

  document.addEventListener("click",function(ev){
    const button=ev.target&&ev.target.closest?ev.target.closest("[data-community-feature='reach'],.feature-app.reach"):null;
    if(button)setTimeout(scheduleMount,0);
  },true);
  window.addEventListener("hashchange",function(){setTimeout(scheduleMount,0)});
  document.addEventListener("DOMContentLoaded",scheduleMount,{once:true});
  scheduleMount();

  window.CAReachReactionR2={VERSION,confidence,deriveType,cardHtml,mount:scheduleMount};
})();