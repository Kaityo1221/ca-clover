(function(){
"use strict";
const ROOT_ID="reachMissionBoard", STYLE_ID="reachMissionsStyle";
let summaryResult=null,timingResult=null;
function esc(v){return String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));}
function communityId(){const h=(location.hash||"").slice(1);if(!h.startsWith("community:"))return "";try{return decodeURIComponent(h.slice(10))}catch(_){return h.slice(10)}}
function num(v){const n=Number(v);return Number.isFinite(n)?Math.max(0,Math.floor(n)):0;}
function derive(result,timing){
  const summary=result&&result.summary||{};
  const meetups=Array.isArray(result&&result.meetups)?result.meetups:[];
  const count24=num(summary.analyzable24hCount);
  const groups=Array.isArray(summary.byWeekdayTwoHour)?summary.byWeekdayTwoHour:[];
  const maxCell=Math.max(0,...groups.map(c=>num(c&&c.sampleCount)));
  const withHistory=meetups.filter(m=>num(m&&m.snapshotCount)>0).length;
  const withLine=meetups.filter(m=>num(m&&m.snapshotCount)>=2).length;
  const intervals=timing&&timing.analysis?num(timing.analysis.positiveIntervals):null;
  const missions=[
    {title:"📈 RSVP推移",rows:[["2回以上観測したMeetup",withLine,1]],note:"1件を2回以上観測すれば、RSVPの変化を線で表示できます。"},
    {title:"📊 過去Meetup比較の土台",rows:[["観測履歴があるMeetup",withHistory,2]],note:"2件は最低条件。各チェックポイントには今回と過去の両方の時刻に近い実測が必要です。"},
    {title:"🌱 反応傾向（参考）",rows:[["24時間分析できたMeetup",count24,5]],note:"作成後6時間以内の初回観測と、約24時間後の記録が必要です。"},
    {title:"🍀 反応傾向（傾向あり）",rows:[["24時間分析できたMeetup",count24,10]],note:"10件で「傾向あり」。各曜日・時間帯の数値には別途3件以上必要です。"},
    {title:"📣 おすすめ作成時間",rows:[["24時間分析できたMeetup",count24,5],["同じ曜日・2時間枠のMeetup",maxCell,3]],note:"両方を達成すると、おすすめの曜日と作成時間帯を判定できます。"},
    {title:"🗓️ ヒートマップの比較精度",rows:[["同じ曜日・2時間枠のMeetup",maxCell,3]],note:"各マスは1件から参考表示。3件未満は薄く表示されます。"},
    {title:"⏱ RSVPが増えた時間",rows:[["増加が確認できた観測区間",intervals,1,"区間"]],note:"作成後24時間に、45分以内の連続観測2点で増加を確認すると達成です。"}
  ];
  return missions.map(m=>({...m,clear:m.rows.every(r=>r[1]!=null&&r[1]>=r[2])}));
}
function meter(row){
  const [name,value,target,unit="件"]=row;
  const ratio=value==null?0:Math.min(100,Math.round(num(value)/target*100));
  const text=value==null?"集計中":num(value)+" / "+target+unit;
  const status=value==null?"データを確認中":value>=target?"達成":"あと"+(target-value)+unit;
  return '<div class="reach-mission-req"><div class="reach-mission-line"><span>'+esc(name)+'</span><b>'+esc(text)+'</b></div>'+
    '<div class="reach-mission-track" role="progressbar" aria-label="'+esc(name)+'" aria-valuemin="0" aria-valuemax="'+target+'" aria-valuenow="'+num(value)+'"><div class="reach-mission-fill" style="width:'+ratio+'%"></div></div>'+
    '<div class="reach-mission-status">'+esc(status)+'</div></div>';
}
function card(m){
  return '<article class="reach-mission-card'+(m.clear?' is-clear':'')+'"><div class="reach-mission-cardtitle"><b>'+esc(m.title)+'</b><span>'+(m.clear?'✅ 達成':'🌱 進行中')+'</span></div>'+
    m.rows.map(meter).join('')+'<p class="reach-mission-note">'+esc(m.note)+'</p></article>';
}
function ensureStyle(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement("style");style.id=STYLE_ID;
  style.textContent=[
    '#reachMissionBoard{min-width:0;max-width:100%;margin:14px 0 17px}',
    '.reach-missions{border:1px solid #cde9c2;border-radius:20px;background:linear-gradient(135deg,#f6fff1,#fff);overflow:hidden;box-shadow:0 8px 25px rgba(64,110,58,.06)}',
    '.reach-missions>summary{cursor:pointer;display:flex;gap:10px;align-items:center;justify-content:space-between;padding:15px 16px;list-style:none}',
    '.reach-missions>summary::-webkit-details-marker{display:none}',
    '.reach-mission-head{font-size:17px;font-weight:950;color:#365314}',
    '.reach-mission-sub{font-size:11px;line-height:1.5;font-weight:850;color:#64748b;margin-top:3px}',
    '.reach-mission-total{background:#fff;border:1px solid #bbdfb5;border-radius:999px;padding:6px 9px;white-space:nowrap;color:#365314;font-size:11px;font-weight:950}',
    '.reach-missions[open] .reach-mission-total{background:#eaf8df}',
    '.reach-mission-body{padding:12px;border-top:1px solid #e2efd9}',
    '.reach-mission-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}',
    '.reach-mission-card{min-width:0;border:1px solid #e2e8f0;border-radius:16px;padding:13px;background:#fff}',
    '.reach-mission-card.is-clear{background:#f8fff4;border-color:#bbdfb5}',
    '.reach-mission-cardtitle{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;color:#365314;font-size:12px;line-height:1.5}',
    '.reach-mission-cardtitle span{white-space:nowrap;border-radius:999px;background:#f1f5f9;padding:4px 6px;color:#6b7280;font-size:9px;font-weight:950}',
    '.reach-mission-card.is-clear .reach-mission-cardtitle span{background:#dcfce7;color:#166534}',
    '.reach-mission-req{margin-top:11px}',
    '.reach-mission-line{display:flex;align-items:baseline;justify-content:space-between;gap:6px;color:#475569;font-weight:850;font-size:10px}',
    '.reach-mission-line b{white-space:nowrap;color:#365314}',
    '.reach-mission-track{height:7px;margin-top:5px;border-radius:999px;background:#e2e8f0;overflow:hidden}',
    '.reach-mission-fill{height:100%;border-radius:999px;background:#84cc16}',
    '.reach-mission-status{margin-top:4px;text-align:right;color:#52763f;font-weight:900;font-size:10px}',
    '.reach-mission-note{margin:9px 0 0;color:#64748b;font-size:10px;font-weight:750;line-height:1.65}',
    '.reach-mission-foot{margin:12px 2px 1px;color:#64748b;font-size:10px;font-weight:800;line-height:1.6}',
    '@media(max-width:700px){.reach-mission-grid{grid-template-columns:1fr}.reach-mission-head{font-size:15px}.reach-mission-total{font-size:10px}.reach-missions>summary{padding:14px 12px}}'
  ].join("");
  document.head.appendChild(style);
}
function mount(){
  const id=communityId(),root=document.getElementById("reach7Root");
  if(!id||!root||!root.parentElement||!document.querySelector(".feature-app.reach.on"))return;
  if(!summaryResult||summaryResult.communityId!==id)return;
  ensureStyle();
  let el=document.getElementById(ROOT_ID),opened=el?Boolean(el.querySelector("details")?.open):false;
  if(!el){el=document.createElement("section");el.id=ROOT_ID;root.parentElement.insertBefore(el,root.parentElement.querySelector("#reachReactionR2")||root);}
  const timing=timingResult&&timingResult.communityId===id?timingResult:null;
  const missions=derive(summaryResult,timing),clear=missions.filter(m=>m.clear).length;
  el.innerHTML='<details class="reach-missions"'+(opened?' open':'')+'><summary><div><div class="reach-mission-head">🎯 Reach ミッション</div><div class="reach-mission-sub">分析の解放条件を見る　▾</div></div><span class="reach-mission-total">'+clear+' / '+missions.length+' 達成</span></summary>'+
    '<div class="reach-mission-body"><div class="reach-mission-grid">'+missions.map(card).join('')+'</div>'+
    '<p class="reach-mission-foot">※ 開催総数ではなく、必要な時刻の実際のRSVP観測に基づく件数です。条件を満たしても一部のチェックポイントは未取得の場合があります。</p></div></details>';
}
window.addEventListener("ca-clover:reach-summary",function(e){const d=e.detail||{};if(!d.result||d.communityId!==communityId())return;summaryResult=d.result;if(timingResult&&timingResult.communityId!==d.communityId)timingResult=null;mount();});
window.addEventListener("ca-clover:reach-timing",function(e){const d=e.detail||{};if(!d.result||d.communityId!==communityId())return;timingResult=d.result;mount();});
window.addEventListener("hashchange",function(){if(summaryResult&&summaryResult.communityId===communityId())mount();});
window.CAReachMissions={derive,mount};
})();