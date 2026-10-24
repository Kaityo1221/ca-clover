/* Reaction v2, Phase 1: Community DNA. Presentation-only; old RSVP analytics remain intact. */
(function(){
  "use strict";
  const TYPE_CONFIG={
  "平日朝型": {
    "emoji": "🌅",
    "alias": "モーニングスイッチ",
    "tone": "morning"
  },
  "平日昼型": {
    "emoji": "☀️",
    "alias": "ランチタイムブースト",
    "tone": "day"
  },
  "平日夜型": {
    "emoji": "🌆",
    "alias": "アフター6",
    "tone": "evening"
  },
  "平日深夜型": {
    "emoji": "🌌",
    "alias": "真夜中の作戦会議",
    "tone": "midnight"
  },
  "休日朝型": {
    "emoji": "🌄",
    "alias": "サンライズスタート",
    "tone": "morning"
  },
  "休日昼型": {
    "emoji": "🌻",
    "alias": "ひだまりブースト",
    "tone": "day"
  },
  "休日夜型": {
    "emoji": "🌙",
    "alias": "ムーンライトフィーバー",
    "tone": "evening"
  },
  "休日深夜型": {
    "emoji": "✨",
    "alias": "ミッドナイトクラブ",
    "tone": "midnight"
  },
  "平日型": {
    "emoji": "🏙️",
    "alias": "ウィークデーブースター",
    "tone": "balanced"
  },
  "休日型": {
    "emoji": "🎈",
    "alias": "ホリデースター",
    "tone": "balanced"
  },
  "朝型": {
    "emoji": "🌅",
    "alias": "おはようスイッチ",
    "tone": "morning"
  },
  "昼型": {
    "emoji": "☀️",
    "alias": "サンシャイン",
    "tone": "day"
  },
  "夜型": {
    "emoji": "🌙",
    "alias": "ナイトフィーバー",
    "tone": "evening"
  },
  "深夜型": {
    "emoji": "✨",
    "alias": "ミッドナイトシグナル",
    "tone": "midnight"
  },
  "バランス型": {
    "emoji": "🍀",
    "alias": "オールラウンダー",
    "tone": "balanced"
  },
  "診断中": {
    "emoji": "🌱",
    "alias": "成長観測中",
    "tone": "balanced"
  }
};
  const MIN_REFERENCE=5,MIN_TREND=10,MIN_GROUP_SAMPLE=3,STRONG_RATIO=1.25,STRONG_DIFF=2;
  const STYLE_ID="caReactionV2Style";
  function esc(v){return String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
  function fmt(v){return Number.isFinite(v)?(v>0?"+":"")+Number(v).toLocaleString("ja-JP"):"—";}
  function validGroups(groups){return (groups||[]).filter(g=>g&&Number(g.sampleCount)>=MIN_GROUP_SAMPLE&&Number.isFinite(g.median24h));}
  function topGroup(groups){return validGroups(groups).slice().sort((a,b)=>b.median24h-a.median24h||b.sampleCount-a.sampleCount)[0]||null;}
  function isStrong(g,overall){
    if(!g||!Number.isFinite(overall))return false;
    const diff=g.median24h-overall;
    return diff>=STRONG_DIFF&&(overall<=0?g.median24h>=STRONG_DIFF:g.median24h>=overall*STRONG_RATIO);
  }
  function deriveType(summary){
    summary=summary||{};
    const count=Number(summary.analyzable24hCount)||0;
    if(count<MIN_REFERENCE)return {type:"診断中",day:null,part:null};
    const topDay=topGroup(summary.byDayType),topPart=topGroup(summary.byDaypart);
    const day=isStrong(topDay,summary.overallMedian24h)?topDay:null;
    const part=isStrong(topPart,summary.overallMedian24h)?topPart:null;
    const name=(day?day.label:"")+(part?part.label:"");
    return {type:name?name+"型":"バランス型",day,part};
  }
  function describe(result,summary){
    if(result.type==="診断中"){
      const remaining=Math.max(0,MIN_REFERENCE-(Number(summary.analyzable24hCount)||0));
      return "診断に使えるMeetupを記録中です。あと"+remaining+"件の24時間分析データが揃うと、参考診断を開始します。";
    }
    if(result.type==="バランス型")return "現在の観測では、曜日・時間帯のどちらにも明確に強い偏りは見つかっていません。";
    if(result.day&&result.part)return result.day.label+"の作成と"+result.part.label+"の作成、それぞれで24時間のRSVP増加が高い傾向があります。";
    if(result.day)return result.day.label+"に作成したMeetupの24時間RSVP増加が高い傾向があります。";
    return result.part.label+"に作成したMeetupの24時間RSVP増加が高い傾向があります。";
  }
  function ensureStyle(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement("style");
    style.id=STYLE_ID;
    style.textContent=`
      .reaction2-hero{--accent:#6d28d9;position:relative;isolation:isolate;overflow:hidden;border:1px solid #e9d5ff;border-radius:27px;padding:clamp(20px,4vw,34px);background:linear-gradient(135deg,#f4f0ff 0%,#faf7ff 55%,#fff 100%);box-shadow:0 14px 38px rgba(71,37,116,.08)}
      .reaction2-hero:before{content:"";position:absolute;z-index:-1;top:-65px;right:-50px;width:220px;height:220px;background:rgba(255,255,255,.7);border-radius:50%;box-shadow:0 0 80px rgba(255,255,255,.5)}
      .reaction2-hero[data-tone="morning"]{--accent:#b45309;background:linear-gradient(135deg,#fff0cd,#fff8ec 58%,#fff)}
      .reaction2-hero[data-tone="day"]{--accent:#9a600a;background:linear-gradient(135deg,#fff5c1,#fffce9 58%,#fff)}
      .reaction2-hero[data-tone="evening"]{--accent:#6d28d9;background:linear-gradient(135deg,#eee0ff,#f4eafa 58%,#fff)}
      .reaction2-hero[data-tone="midnight"]{--accent:#4338ca;background:linear-gradient(135deg,#dde5ff,#f1edff 58%,#fff)}
      .reaction2-top{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
      .reaction2-kicker{font-size:11px;letter-spacing:.14em;font-weight:950;color:var(--accent)}
      .reaction2-confidence{font-size:11px;font-weight:900;padding:6px 11px;border-radius:999px;border:1px solid rgba(91,33,182,.15);background:rgba(255,255,255,.82);color:#475569}
      .reaction2-center{text-align:center;margin:28px auto 22px;max-width:680px}
      .reaction2-intro{margin:0 0 12px;color:#475569;font-weight:900;font-size:clamp(13px,3.5vw,16px)}
      .reaction2-title{margin:0;color:#27213c;font-size:clamp(29px,8vw,53px);letter-spacing:-.05em;line-height:1.25;font-weight:950;overflow-wrap:anywhere}
      .reaction2-title-emoji{font-size:.72em;vertical-align:7%;letter-spacing:0}
      .reaction2-title-suffix{font-size:.48em;letter-spacing:0;margin-left:5px}
      .reaction2-alias{display:inline-flex;align-items:center;margin-top:17px;padding:9px 17px;border:1px solid rgba(109,40,217,.12);border-radius:999px;background:#fff;color:var(--accent);font-weight:950;font-size:clamp(12px,3.6vw,15px);box-shadow:0 5px 20px rgba(91,33,182,.06)}
      .reaction2-explain{color:#475569;max-width:550px;margin:17px auto 0;font-size:13px;line-height:1.8;font-weight:800}
      .reaction2-evidence{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:18px}
      .reaction2-stat{min-width:0;border:1px solid rgba(100,116,139,.12);border-radius:19px;background:rgba(255,255,255,.82);padding:17px}
      .reaction2-stat-label{display:block;font-size:11px;font-weight:900;color:#64748b}
      .reaction2-stat-value{display:block;color:#27213c;font-size:clamp(16px,4vw,24px);font-weight:950;margin-top:6px;line-height:1.35}
      .reaction2-stat-detail{display:block;font-size:10px;font-weight:800;color:#64748b;margin-top:6px}
      .reaction2-foot{margin-top:17px;padding-top:15px;border-top:1px solid rgba(100,116,139,.18);color:#64748b;font-size:11px;font-weight:800;line-height:1.7}
      .reaction2-foot p{margin:3px 0}
      .reaction2-warning{margin-top:9px;padding:10px 12px;border-radius:12px;background:#fffbeb;color:#92400e;font-size:11px;font-weight:900}
      .reaction2-error{padding:20px;border:1px solid #fecdd3;border-radius:16px;background:#fff1f2;color:#9f1239;font-weight:900;font-size:13px}
      @media(max-width:480px){.reaction2-hero{padding:19px 15px;border-radius:20px}.reaction2-center{margin:23px auto 18px}.reaction2-evidence{gap:8px}.reaction2-stat{padding:13px 11px;border-radius:14px}.reaction2-stat-detail{font-size:10px}}
      @media(max-width:345px){.reaction2-evidence{grid-template-columns:1fr}.reaction2-title{font-size:27px}}
    `;
    document.head.appendChild(style);
  }
  function statHtml(label,group,typeText){
    const text=group?group.label:(typeText==="診断中"?"分析準備中":"明確な偏りなし");
    const detail=group?"24h RSVP中央値 "+fmt(group.median24h)+" / "+group.sampleCount+"件":"記録された範囲で判定";
    return '<article class="reaction2-stat"><span class="reaction2-stat-label">'+esc(label)+'</span><strong class="reaction2-stat-value">'+esc(text)+'</strong><span class="reaction2-stat-detail">'+esc(detail)+'</span></article>';
  }
  function render(panel,data){
    const summary=data&&data.summary||{};
    const analysis=deriveType(summary);
    const meta=TYPE_CONFIG[analysis.type]||TYPE_CONFIG["診断中"];
    const count=Number(summary.analyzable24hCount)||0;
    const confidence=count<MIN_REFERENCE?"診断中":count<MIN_TREND?"参考傾向":"傾向あり";
    const partial=Boolean(data.snapshotRowsTruncated);
    const start=summary.reliableCollectionStart||"";
    const reliableStart=start?new Date(start).toLocaleDateString("ja-JP",{timeZone:"Asia/Tokyo",year:"numeric",month:"numeric",day:"numeric"}):"記録開始以降";
    panel.innerHTML='<div class="reaction2-hero" data-tone="'+esc(meta.tone)+'">'+
      '<div class="reaction2-top"><span class="reaction2-kicker">✦ COMMUNITY DNA</span><span class="reaction2-confidence">'+esc(partial?"一部データ・参考表示":confidence)+'</span></div>'+
      '<div class="reaction2-center"><p class="reaction2-intro">あなたのコミュニティは</p>'+
      '<h2 class="reaction2-title"><span class="reaction2-title-emoji">'+esc(meta.emoji)+'</span> '+esc(analysis.type)+'<span class="reaction2-title-suffix">です</span></h2>'+
      '<div class="reaction2-alias">✦ '+esc(meta.alias)+'</div>'+
      '<p class="reaction2-explain">'+esc(describe(analysis,summary))+'</p></div>'+
      '<div class="reaction2-evidence">'+statHtml("📅 反応が良い曜日",analysis.day,analysis.type)+statHtml("🕘 反応が良い時間帯",analysis.part,analysis.type)+'</div>'+
      '<div class="reaction2-foot"><p>分析対象 '+count.toLocaleString("ja-JP")+'件 · コミュニティ全体の24h RSVP増加中央値 '+esc(fmt(summary.overallMedian24h))+'</p>'+
      '<p>直近12か月の範囲から、'+esc(reliableStart)+'以降の有効な実測で診断（日本時間）</p>'+
      '<p>曜日・時間帯は別々に判定しています。型はRSVP数の保証や予測ではありません。</p></div>'+
      (partial?'<div class="reaction2-warning">⚠️ 履歴の取得上限に達しました。この結果は一部記録に基づく参考表示です。</div>':'')+
      '</div>';
  }
  function activeCommunityId(){
    const selected=document.querySelector(".feature-app.reach.on");
    const hash=(location.hash||"").slice(1);
    if(!selected||!hash.startsWith("community:"))return null;
    try{return decodeURIComponent(hash.slice("community:".length))}catch(_){return null;}
  }
  function mount(){
    const panel=document.getElementById("reactionV2Panel");
    const id=activeCommunityId();
    if(!panel||!id||panel.dataset.reactionV2Mounted==="1")return;
    panel.dataset.reactionV2Mounted="1";
    ensureStyle();
    const loader=window.CAReachReactionWindow12&&window.CAReachReactionWindow12.loadCommunity;
    if(typeof loader!=="function"){
      panel.innerHTML='<div class="reaction2-error">分析機能の準備ができませんでした。ページを再読み込みしてください。</div>';
      return;
    }
    panel.innerHTML='<div class="notice">🍀 コミュニティの個性を分析しています...</div>';
    Promise.resolve().then(()=>loader(id)).then(data=>{
      if(document.getElementById("reactionV2Panel")!==panel||activeCommunityId()!==id)return;
      render(panel,data);
    }).catch(err=>{
      console.warn("Reaction v2 Community DNA failed",err);
      if(document.getElementById("reactionV2Panel")===panel)panel.innerHTML='<div class="reaction2-error">Reactionの分析データを取得できませんでした。しばらくしてから再度開いてください。</div>';
    });
  }
  function start(){
    const root=document.getElementById("app");
    if(root)new MutationObserver(mount).observe(root,{subtree:true,childList:true});
    mount();
  }
  window.CAReactionV2={VERSION:"20261024-phase1",deriveType,TYPE_CONFIG};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});
  else start();
})();
