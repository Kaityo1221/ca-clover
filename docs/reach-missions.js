(function(){
"use strict";
const ID="caReachMissions", STYLE_ID="caReachMissionsStyle", VERSION="reach-missions-20261010-1";
let timer=null;
function communityId(){
  const raw=(location.hash||"").slice(1);
  if(!raw.startsWith("community:"))return "";
  try{return decodeURIComponent(raw.slice("community:".length))}catch(_){return raw.slice("community:".length)}
}
function esc(v){return String(v==null?"":v).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]})}
function maxSample(rows){return Array.isArray(rows)?rows.reduce(function(max,row){return Math.max(max,Number(row&&row.sampleCount)||0)},0):0}
function observations(){
  const el=document.getElementById("reach7Body");
  if(!el)return null;
  for(const badge of el.querySelectorAll(".reach7-badge")){
    const match=String(badge.textContent||"").match(/実測\s*([\d,]+)\s*点/);
    if(match)return Number(match[1].replace(/,/g,""));
  }
  return el.querySelector(".reach7-empty")?0:null;
}
function comparisons(){
  const c=document.getElementById("reach7Compare");
  if(!c)return null;
  return [...c.querySelectorAll(".reach7c-card .reach7c-diff")].filter(function(el){
    const s=String(el.textContent||"");return s.includes("差")&&!s.includes("比較不可")&&!s.includes("記録なし");
  }).length;
}
function ensureStyle(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement("style");style.id=STYLE_ID;
  style.textContent=[
   ".ca-reach-missions{border:1px solid #bbf7d0;border-radius:23px;padding:17px;background:linear-gradient(145deg,#f7fee7,#fff,#f0fdfa);box-shadow:0 10px 27px rgba(34,111,65,.06);min-width:0}",
   ".ca-reach-missions-head{display:flex;justify-content:space-between;align-items:flex-start;gap:8px}",
   ".ca-reach-missions h3{font-size:19px;color:#365314;margin:0}",
   ".ca-reach-missions-intro{color:#64748b;font-size:11px;line-height:1.6;margin:5px 0 0;font-weight:800}",
   ".ca-reach-missions-score{background:#fff;border:1px solid #d9f99d;color:#4d7c0f;font-size:11px;padding:6px 10px;white-space:nowrap;border-radius:999px;font-weight:950}",
   ".ca-reach-missions-list{display:grid;gap:10px;margin-top:14px}",
   ".ca-reach-mission{border:1px solid #e2e8f0;border-radius:17px;padding:12px;background:rgba(255,255,255,.92);min-width:0}",
   ".ca-reach-mission.done{border-color:#bbf7d0;background:#f7fff7}",
   ".ca-reach-mission-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}",
   ".ca-reach-mission-title{font-size:12px;color:#365314;font-weight:950;line-height:1.4}",
   ".ca-reach-mission-state{font-size:10px;color:#64748b;font-weight:900;white-space:nowrap}",
   ".ca-reach-mission.done .ca-reach-mission-state{color:#15803d}",
   ".ca-reach-mission-step{margin-top:8px}",
   ".ca-reach-mission-step-head{display:flex;justify-content:space-between;gap:8px;align-items:center;color:#64748b;font-size:10px;font-weight:850}",
   ".ca-reach-mission-count{font-variant-numeric:tabular-nums;font-weight:950;color:#4d7c0f;white-space:nowrap}",
   ".ca-reach-mission progress{width:100%;height:8px;border:0;display:block;margin-top:5px;accent-color:#84cc16}",
   ".ca-reach-mission progress::-webkit-progress-bar{background:#e2e8f0;border-radius:999px}",
   ".ca-reach-mission progress::-webkit-progress-value{background:#84cc16;border-radius:999px}",
   ".ca-reach-mission-note{font-size:10px;line-height:1.5;color:#64748b;font-weight:750;margin-top:7px}",
   ".ca-reach-missions-more{border-top:1px solid #d9f99d;margin-top:13px;padding-top:11px}",
   ".ca-reach-missions-more summary{cursor:pointer;font-size:11px;font-weight:950;color:#4d7c0f}",
   ".ca-reach-missions-more .ca-reach-missions-list{margin-top:12px}",
   ".ca-reach-missions-foot{margin-top:12px;font-size:10px;line-height:1.6;color:#64748b}",
   "@media(max-width:480px){.ca-reach-missions{padding:14px}.ca-reach-missions h3{font-size:17px}.ca-reach-missions-score{font-size:10px;padding:5px 8px}}"
  ].join("");
  document.head.appendChild(style);
}
function mission(title,note,steps){
  return {title,note,steps,done:steps.every(function(s){return s.value!=null&&s.value>=s.target})};
}
function itemHtml(item){
  const steps=item.steps.map(function(s){
    const known=s.value!=null;
    const val=known?Math.max(0,Number(s.value)||0):0;
    const remaining=Math.max(0,s.target-val);
    return '<div class="ca-reach-mission-step"><div class="ca-reach-mission-step-head"><span>'+esc(s.label)+'</span><span class="ca-reach-mission-count">'+(known?val.toLocaleString("ja-JP"):"—")+' / '+s.target+'件'+(known&&remaining?'（あと'+remaining+'）':'')+'</span></div><progress aria-label="'+esc(s.label)+'" value="'+Math.min(s.target,val)+'" max="'+s.target+'"></progress></div>';
  }).join("");
  return '<article class="ca-reach-mission'+(item.done?' done':'')+'"><div class="ca-reach-mission-head"><span class="ca-reach-mission-title">'+esc(item.title)+'</span><span class="ca-reach-mission-state">'+(item.done?'✅ 達成':'🌱 挑戦中')+'</span></div>'+steps+'<div class="ca-reach-mission-note">'+esc(item.note)+'</div></article>';
}
function render(){
  const active=document.querySelector(".feature-app.reach.on"),root=document.getElementById("reach7Root"),r2=document.getElementById("reachReactionR2");
  const id=communityId(),data=window.CAReachReactionR2LastResult;
  if(!active||!root||!r2||!r2.parentElement||!id||!data||data.communityId!==id)return;
  ensureStyle();
  const summary=data.summary||{},count=Math.max(0,Number(summary.analyzable24hCount)||0),maxCell=maxSample(summary.byWeekdayTwoHour);
  const maxSlot=maxSample(summary.byTwoHour),maxDay=maxSample(summary.byWeekday);
  const chart=observations(),comparison=comparisons();
  const timing=window.CAReachReactionR5LastResult;
  const intervals=timing&&timing.communityId===id?Math.max(0,Number(timing.analysis&&timing.analysis.positiveIntervals)||0):null;
  const primary=[
    mission("🍀 基本の反応傾向を分析","まずは作成後24時間のRSVPを追えるMeetupを5件。時間帯・曜日の内訳には各3件が必要です。",[{label:"24時間の分析対象",value:count,target:5}]),
    mission("📈 Communityの傾向を確立","分析対象が10件になると「傾向あり」になります。",[{label:"24時間の分析対象",value:count,target:10}]),
    mission("🎯 おすすめ作成タイミング","全体5件に加え、同じ曜日×2時間枠に3件必要です。",[{label:"24時間の分析対象",value:count,target:5},{label:"同じ曜日・2時間枠の最多記録",value:maxCell,target:3}])
  ];
  const extra=[
    mission("📊 RSVPの推移を線で見る","選択中のMeetupは、1回で実測値、2回以上で時系列の線を描けます。",[{label:"選択中のMeetupの観測",value:chart,target:2}]),
    mission("🕰️ 過去Meetupと比較する","今回と過去のMeetupの同じチェックポイントに、観測が各1件以上必要です。",[{label:"比較できたチェックポイント",value:comparison,target:1}]),
    mission("🗓️ ヒートマップの色を濃くする","セルは1件から表示され、同じ曜日×2時間枠で3件以上なら薄い参考表示を卒業します。",[{label:"同じ曜日・2時間枠の最多記録",value:maxCell,target:3}]),
    mission("⏱️ RSVPが増える時刻を見つける","同一Meetupで45分以内の間隔の観測が2点あり、RSVPが増えた区間が1つ必要です。",[{label:"RSVPが増えた観測区間",value:intervals,target:1}])
  ];
  const all=primary.concat(extra),done=all.filter(function(g){return g.done}).length;
  const signature=JSON.stringify({id,count,maxCell,maxSlot,maxDay,chart,comparison,intervals,version:VERSION});
  let box=document.getElementById(ID);
  if(box&&box.dataset.signature===signature&&box.nextElementSibling===r2)return;
  const keepOpen=Boolean(box&&box.querySelector("details")&&box.querySelector("details").open);
  if(box&&box.parentElement!==r2.parentElement){box.remove();box=null}
  if(!box){box=document.createElement("section");box.id=ID;box.className="ca-reach-missions"}
  box.dataset.signature=signature;
  box.innerHTML='<div class="ca-reach-missions-head"><div><h3>🎯 Reach ミッション</h3><p class="ca-reach-missions-intro">Meetupの開催回数とは別に、RSVPを分析できた記録で進みます。</p></div><span class="ca-reach-missions-score">'+done+' / '+all.length+' 達成</span></div>'+
    '<div class="ca-reach-missions-list">'+primary.map(itemHtml).join("")+'</div>'+
    '<details class="ca-reach-missions-more"><summary>ほかの分析ミッションも見る（4項目）</summary><div class="ca-reach-missions-list">'+extra.map(itemHtml).join("")+'</div><div class="ca-reach-missions-foot">時間帯・曜日の上位表示は、それぞれ同じグループに3件以上必要です（現状：時間帯 最大'+maxSlot+'件、曜日 最大'+maxDay+'件）。各RSVPチェックポイントには対象時刻の前後に実測が1件必要です。観測前の過去記録は復元できません。</div></details>'+
    '<div class="ca-reach-missions-foot">✅は条件の達成を示します。未達でも取得済みデータの分析は引き続き閲覧できます。</div>';
  const details=box.querySelector("details");if(details)details.open=keepOpen;
  r2.parentElement.insertBefore(box,r2);
}
function schedule(){clearTimeout(timer);timer=setTimeout(render,120)}
new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true,characterData:true});
document.addEventListener("change",function(event){if(event.target&&event.target.id==="reach7MeetupSelect")schedule()});
window.addEventListener("hashchange",schedule);
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",schedule,{once:true});else schedule();
})();