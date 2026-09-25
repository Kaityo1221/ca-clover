(function(){
"use strict";
if(!/(?:^|\/)admin\.html$/.test(location.pathname))return;

const SUPABASE_URL="https://wgiittrvgtiosogyhfcl.supabase.co";
const SUPABASE_KEY="sb_publishable_QTCqijfNvnysUTMylNIyTA_6ngosaPN";
const client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:"pkce"}});
let app=null;
const STATUS_OPTIONS=[
 ["unreviewed","未確認"],
 ["contact_host","本人確認"],
 ["sop_in_progress","対応中"],
 ["no_issue","問題なし"],
 ["completed","完了"]
];
const STATUS_LABEL=Object.fromEntries(STATUS_OPTIONS);
const FLAG_LABEL={
 TIME_VERY_SHORT:"開催時間30分以下",TIME_SHORT:"開催時間60分以下",REPEAT_SAME_DAY:"同日複数開催",REPEAT_CLOSE:"前回終了30分以内",CREATED_LAST_MINUTE:"開始10分以内に作成",OFFICIAL_TIME_OUTSIDE:"公式時間外",LOW_CHECKIN:"Check-in 0〜1名",LOW_CHECKIN_REPEAT:"少人数Check-in反復",HOST_ABSENT_TEXT:"主催者不在表現",NON_FACE_TO_FACE:"非対面表現",PARTICIPATION_RESTRICTED:"一般参加制限",REWARD_ONLY:"報酬目的表現",TITLE_STRONG:"強い確認対象表現",TITLE_CAUTION:"確認対象表現",CHECKIN_ONLY:"チェックインのみ表現",FREE_CHECKIN_TEXT:"フリーチェックイン表現"
};
let currentFilter=sessionStorage.getItem("ca-watch-filter")||"unreviewed";
let renderSerial=0;
let scheduled=null;

function e(v){return String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"})[c])}
function fmt(v){if(!v)return"—";const d=new Date(v);return Number.isFinite(d.getTime())?d.toLocaleString("ja-JP"):"—"}
function duration(a,b){if(!a||!b)return null;const d=(Date.parse(b)-Date.parse(a))/60000;return Number.isFinite(d)?Math.round(d):null}
function isWatch(){return (location.hash||"#home").slice(1)==="watch"}
function statusClass(status){if(status==="unreviewed")return"amber";if(status==="contact_host"||status==="sop_in_progress")return"blue";if(status==="completed")return"slate";return""}
async function isAdminSession(){
 const got=await client.auth.getSession();const session=got.data.session||null;if(!session)return false;
 const p=await client.from("profiles").select("role").eq("id",session.user.id).maybeSingle();
 return !p.error&&p.data?.role==="admin";
}
function copyText(text){
 if(navigator.clipboard&&navigator.clipboard.writeText)return navigator.clipboard.writeText(text);
 const ta=document.createElement("textarea");ta.value=text;ta.style.position="fixed";ta.style.opacity="0";document.body.appendChild(ta);ta.select();document.execCommand("copy");ta.remove();return Promise.resolve();
}
function highlight(text,field,findings){
 text=String(text||"");
 const ranges=(findings||[]).filter(f=>f.active&&f.matched_field===field&&Number.isInteger(f.match_start)&&Number.isInteger(f.match_end)).map(f=>({start:Math.max(0,f.match_start),end:Math.min(text.length,f.match_end)})).filter(r=>r.end>r.start).sort((a,b)=>a.start-b.start||a.end-b.end);
 const merged=[];
 for(const r of ranges){const last=merged[merged.length-1];if(last&&r.start<=last.end)last.end=Math.max(last.end,r.end);else merged.push({...r});}
 if(!merged.length){
  let html=e(text);
  const terms=[...new Set((findings||[]).filter(f=>f.active&&f.matched_field===field&&f.matched_text).map(f=>String(f.matched_text)))].sort((a,b)=>b.length-a.length);
  for(const term of terms){const safe=e(term).replace(/[.*+?^${}()|[\]\\]/g,"\\$&");html=html.replace(new RegExp(safe,"g"),'<strong class="watch-hit">'+e(term)+'</strong>');}
  return html;
 }
 let out="",cursor=0;
 for(const r of merged){if(r.start>cursor)out+=e(text.slice(cursor,r.start));out+='<strong class="watch-hit">'+e(text.slice(r.start,r.end))+'</strong>';cursor=r.end;}
 if(cursor<text.length)out+=e(text.slice(cursor));
 return out;
}
function firstMatched(findings,flags){return (findings||[]).find(x=>flags.includes(x.flag_code)&&x.matched_text)?.matched_text||null}
function contactTemplate(flags,findings){
 const q=[];const add=v=>{if(v&&!q.includes(v))q.push(v)};
 if(flags.includes("REPEAT_SAME_DAY")||flags.includes("REPEAT_CLOSE"))add("同日または近い時間帯に複数のMeetupが設定されています。それぞれを分けて開催した経緯を教えてください。");
 if(flags.some(f=>["TITLE_STRONG","TITLE_CAUTION","PARTICIPATION_RESTRICTED"].includes(f))){const m=firstMatched(findings,["TITLE_STRONG","TITLE_CAUTION","PARTICIPATION_RESTRICTED"]);add("Meetupのタイトル・概要に"+(m?"「"+m+"」という表現があります。":"確認したい表現があります。")+"どのような開催を想定して設定したものか教えてください。");}
 if(flags.includes("HOST_ABSENT_TEXT")){const m=firstMatched(findings,["HOST_ABSENT_TEXT"]);add("概要に"+(m?"「"+m+"」と記載されています。":"主催者不在を示す表現があります。")+"当日の主催・参加者対応について教えてください。");}
 if(flags.some(f=>["NON_FACE_TO_FACE","FREE_CHECKIN_TEXT","CHECKIN_ONLY"].includes(f))){const m=firstMatched(findings,["NON_FACE_TO_FACE","FREE_CHECKIN_TEXT","CHECKIN_ONLY"]);add("概要に"+(m?"「"+m+"」という記載があります。":"来場・チェックイン方法について確認したい記載があります。")+"当日の参加方法や現地対応をどのように想定していたか教えてください。");}
 if(flags.includes("OFFICIAL_TIME_OUTSIDE"))add("公式イベント終了後の時間帯にMeetupが設定されています。この時間に開催した経緯を教えてください。");
 if(flags.includes("CREATED_LAST_MINUTE"))add("開始直前にMeetupが作成されています。現地でどのような状況があり、この時間に設定したか教えてください。");
 if(flags.includes("REWARD_ONLY")){const m=firstMatched(findings,["REWARD_ONLY"]);add((m?"「"+m+"」という表現があります。":"報酬に関する表現があります。")+"当日のMeetupで予定していた活動内容を教えてください。");}
 if(flags.includes("LOW_CHECKIN_REPEAT"))add("少人数のCheck-inが続いています。最近の開催状況や現地での参加状況について教えてください。");
 const selected=q.slice(0,3);
 return ["お疲れ様です。Meetupの運用確認のため、状況を確認させてください。","",...selected.map((x,i)=>(i+1)+". "+x),"","確認できる範囲で大丈夫です。状況や設定した経緯を教えてください。"].join("\n");
}
function installStyle(){
 if(document.getElementById("ca-watch-finish-style"))return;
 const s=document.createElement("style");s.id="ca-watch-finish-style";s.textContent=`
.watch-tabs{display:flex;gap:7px;overflow-x:auto;padding-bottom:3px;-webkit-overflow-scrolling:touch}.watch-tab{border:1px solid #d9f99d;background:#fff;color:#4d7c0f;border-radius:999px;padding:9px 12px;font-weight:950;white-space:nowrap}.watch-tab.on{background:#a3e635;border-color:#84cc16;color:#365314}.watch-hit{color:#dc2626;font-weight:950;background:#fee2e2;border-radius:4px;padding:0 2px}.watch-copy{background:#eff6ff!important;border-color:#bfdbfe!important;color:#1d4ed8!important}.watch-note{min-height:76px;resize:vertical}.watch-statusbar{display:grid;grid-template-columns:minmax(140px,200px) 1fr auto;gap:8px;align-items:end}.watch-counts{display:flex;gap:7px;flex-wrap:wrap}.watch-reason{border-left:3px solid #f59e0b;padding-left:10px}.watch-detected{color:#b91c1c;font-weight:900}.watch-empty{padding:28px;text-align:center}.watch-detail{white-space:pre-wrap;background:#f8fafc;border-radius:16px;padding:14px;line-height:1.7}.watch-template{white-space:pre-wrap;background:#eff6ff;border:1px solid #bfdbfe;border-radius:16px;padding:12px;color:#1e3a8a;font-size:12px;line-height:1.65}.watch-toolbar{position:sticky;top:69px;z-index:15;background:rgba(248,252,233,.94);backdrop-filter:blur(10px);padding:8px 0 10px}
@media(max-width:820px){.watch-statusbar{grid-template-columns:1fr}.watch-statusbar .btn{width:100%}.watch-toolbar{top:64px}.watch-tabs{padding-bottom:6px}}
`;
 document.head.appendChild(s);
}
async function testDiscord(){
 const out=document.getElementById("watchMsg");if(out)out.innerHTML='<div class="notice section">送信中...</div>';
 const r=await client.functions.invoke("meetup-watch-notify",{body:{action:"test"}});
 if(out)out.innerHTML=r.error?'<div class="notice err section">'+e(r.error.message)+'</div>':'<div class="notice ok section">Discordテスト通知を送信しました</div>';
}
async function saveCase(caseId){
 const card=[...document.querySelectorAll("[data-watch-case]")].find(x=>x.dataset.watchCase===caseId);if(!card)return;
 const select=card.querySelector("[data-watch-status]");const note=card.querySelector("[data-watch-note]");const button=card.querySelector("[data-watch-save]");
 button.disabled=true;button.textContent="保存中...";
 const r=await client.functions.invoke("meetup-watch-admin",{body:{action:"set_status",caseId,status:select.value,note:note.value}});
 if(r.error){button.disabled=false;button.textContent="保存";alert(r.error.message);return;}
 button.textContent="保存しました ✓";setTimeout(()=>renderWatch(),450);
}
async function renderWatch(){
 if(!isWatch())return;
 if(!(await isAdminSession()))return;
 app=document.getElementById("app");if(!app||!isWatch())return;
 const serial=++renderSerial;
 app.innerHTML='<button id="watchBack" class="btn line">← 管理メニュー</button><section class="card hero section"><span class="pill violet">MEETUP WATCH</span><h1 style="margin-top:10px">🔍 要確認Meetup</h1><p class="muted strong">検知は不正認定ではありません。事実を確認し、必要な場合だけ本人確認・対応へ進めます。</p></section><div class="actions section"><button id="discordTest" class="btn line">🔔 Discordテスト通知</button><button id="windowsBtn" class="btn line">🕐 イベント時間マスター</button></div><div id="watchMsg"></div><div id="watchShell" class="section"><div class="notice">読み込み中...</div></div>';
 document.getElementById("watchBack").onclick=()=>{location.hash="home"};
 document.getElementById("windowsBtn").onclick=()=>{location.hash="windows"};
 document.getElementById("discordTest").onclick=testDiscord;

 const cr=await client.from("meetup_watch_cases").select("id,meetup_id,community_id,status,review_required,score,priority,priority_level,high_priority,discord_candidate,is_hot_trigger,flags,reason_summary,last_evaluated_at,review_note,reviewed_at").eq("review_required",true).order("priority",{ascending:false}).order("score",{ascending:false}).limit(300);
 if(serial!==renderSerial||!isWatch())return;
 if(cr.error){document.getElementById("watchShell").innerHTML='<div class="notice err">'+e(cr.error.message)+'</div>';return;}
 const cases=cr.data||[],ids=cases.map(x=>x.meetup_id),cids=[...new Set(cases.map(x=>x.community_id).filter(Boolean))];
 const [mr,fr,com,hot]=await Promise.all([
  ids.length?client.from("meetups").select("id,community_id,title,details,starts_at,ends_at,location,event_url,campfire_created_at,rsvp_count,checkin_count").in("id",ids):Promise.resolve({data:[]}),
  ids.length?client.from("meetup_watch_findings").select("id,meetup_id,flag_code,reason,score_weight,matched_field,matched_text,match_start,match_end,active").in("meetup_id",ids).eq("active",true):Promise.resolve({data:[]}),
  cids.length?client.from("communities").select("id,name,prefecture").in("id",cids):Promise.resolve({data:[]}),
  cids.length?client.from("watch_community_state").select("community_id,hot_until,hot_reasons").in("community_id",cids):Promise.resolve({data:[]})
 ]);
 if(serial!==renderSerial||!isWatch())return;
 const fetchError=mr.error||fr.error||com.error||hot.error;if(fetchError){document.getElementById("watchShell").innerHTML='<div class="notice err">'+e(fetchError.message||String(fetchError))+'</div>';return;}
 const mm=new Map((mr.data||[]).map(x=>[x.id,x])),cm=new Map((com.data||[]).map(x=>[x.id,x])),hm=new Map((hot.data||[]).map(x=>[x.community_id,x]));
 const findings=fr.data||[];
 const counts=Object.fromEntries(STATUS_OPTIONS.map(([key])=>[key,cases.filter(x=>x.status===key).length]));
 const filtered=currentFilter==="all"?cases:cases.filter(x=>x.status===currentFilter);
 let html='<div class="watch-toolbar"><div class="watch-counts"><span class="pill amber">未確認 '+counts.unreviewed+'</span><span class="pill blue">本人確認 '+counts.contact_host+'</span><span class="pill blue">対応中 '+counts.sop_in_progress+'</span><span class="pill">問題なし '+counts.no_issue+'</span><span class="pill slate">完了 '+counts.completed+'</span></div><div class="watch-tabs section">'+[["unreviewed","未確認"],["contact_host","本人確認"],["sop_in_progress","対応中"],["no_issue","問題なし"],["completed","完了"],["all","すべて"]].map(x=>'<button class="watch-tab '+(currentFilter===x[0]?"on":"")+'" data-watch-filter="'+x[0]+'">'+x[1]+'</button>').join("")+'</div></div>';
 if(!filtered.length)html+='<section class="card watch-empty"><div style="font-size:42px">🍀</div><h3 class="section">この状態の要確認Meetupはありません</h3></section>';
 else html+=filtered.map(cs=>{
  const m=mm.get(cs.meetup_id);if(!m)return"";const c=cm.get(cs.community_id),fs=findings.filter(x=>x.meetup_id===m.id),h=hm.get(cs.community_id),hotActive=h?.hot_until&&Date.parse(h.hot_until)>Date.now();const flags=cs.flags||[];const template=contactTemplate(flags,fs);const detected=[...new Set(fs.map(x=>x.matched_text).filter(Boolean))];
  return '<section class="claim section" data-watch-case="'+e(cs.id)+'"><div class="row between wraprow"><div><div class="tiny strong" style="color:#65a30d">'+e(c?.prefecture||"—")+' / '+e(c?.name||"Community未取得")+'</div><h2 class="section">'+highlight(m.title||"Meetup","title",fs)+'</h2></div><div class="tags">'+(hotActive?'<span class="pill amber">🔥 HOT監視中</span>':'')+'<span class="pill '+statusClass(cs.status)+'">'+e(STATUS_LABEL[cs.status]||cs.status)+'</span><span class="pill amber">'+(cs.high_priority?"🟠 高優先":"🟡 要確認")+' / '+e(cs.score)+'点</span>'+(cs.discord_candidate?'<span class="pill dark">Discord対象</span>':'')+'</div></div>'+
  '<div class="watch-detail section">'+(m.details?highlight(m.details,"details",fs):'<span class="muted">概要なし</span>')+'</div>'+
  (detected.length?'<div class="watch-detected section">🔴 検知ワード: '+detected.map(x=>'「'+e(x)+'」').join(' / ')+'</div>':'')+
  '<div class="grid g3 section small strong muted"><div>🕒 '+e(fmt(m.starts_at))+'</div><div>⏱️ '+e(duration(m.starts_at,m.ends_at)??"—")+'分</div><div>📍 '+e(m.location||"未取得")+'</div><div>📨 RSVP '+e(m.rsvp_count??"—")+'</div><div>✅ Check-in '+e(m.checkin_count??"—")+'</div><div>再評価 '+e(fmt(cs.last_evaluated_at))+'</div></div>'+
  '<div class="tags">'+flags.map(x=>'<span class="pill slate" title="'+e(x)+'">'+e(FLAG_LABEL[x]||x)+'</span>').join("")+'</div>'+
  '<div class="section">'+fs.map(x=>'<div class="small muted strong watch-reason">・'+e(x.reason)+' <b>+'+e(x.score_weight)+'</b></div>').join("")+'</div>'+
  (cs.reason_summary?'<div class="notice section">'+e(cs.reason_summary)+'</div>':'')+
  '<details class="section"><summary class="small strong">本人確認テンプレート（最大3問）</summary><div class="watch-template section">'+e(template)+'</div><button type="button" class="btn line watch-copy section" data-watch-copy="'+e(cs.id)+'">📋 本人確認文をコピー</button></details>'+
  '<div class="watch-statusbar section"><div><label class="tiny strong muted">対応状態</label><select class="input" data-watch-status>'+STATUS_OPTIONS.map(x=>'<option value="'+x[0]+'" '+(x[0]===cs.status?"selected":"")+'>'+x[1]+'</option>').join("")+'</select></div><div><label class="tiny strong muted">ADMINメモ</label><textarea class="input watch-note" data-watch-note placeholder="確認内容・判断理由を記録">'+e(cs.review_note||"")+'</textarea></div><button class="btn" data-watch-save>保存</button></div>'+
  '<div class="actions section">'+(m.event_url?'<a class="btn line" target="_blank" rel="noreferrer" href="'+e(m.event_url)+'">Campfireで確認 ↗</a>':'')+'</div></section>';
 }).join("");
 document.getElementById("watchShell").innerHTML=html;
 document.querySelectorAll("[data-watch-filter]").forEach(b=>b.onclick=()=>{currentFilter=b.dataset.watchFilter;sessionStorage.setItem("ca-watch-filter",currentFilter);renderWatch()});
 document.querySelectorAll("[data-watch-save]").forEach(b=>b.onclick=()=>saveCase(b.closest("[data-watch-case]").dataset.watchCase));
 document.querySelectorAll("[data-watch-copy]").forEach(b=>b.onclick=async()=>{const id=b.dataset.watchCopy,cs=cases.find(x=>x.id===id),fs=cs?findings.filter(x=>x.meetup_id===cs.meetup_id):[];if(!cs)return;await copyText(contactTemplate(cs.flags||[],fs));const old=b.textContent;b.textContent="✓ コピーしました";setTimeout(()=>{if(document.body.contains(b))b.textContent=old},1500)});
}
function schedule(){
 clearTimeout(scheduled);scheduled=setTimeout(()=>{
  if(!isWatch())return;app=document.getElementById("app");if(!app)return;
  if(!document.getElementById("watchShell"))renderWatch();
 },80)
}
function start(){
 installStyle();app=document.getElementById("app");
 window.addEventListener("hashchange",()=>{app=document.getElementById("app");if(!isWatch())return;schedule()});
 if(app)new MutationObserver(()=>{if(isWatch()&&!document.getElementById("watchShell"))schedule()}).observe(app,{childList:true,subtree:false});
 if(isWatch())schedule();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();