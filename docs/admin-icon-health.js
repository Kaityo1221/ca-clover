(function(){
"use strict";
if(!/(?:^|\/)admin\.html$/.test(location.pathname))return;

const SUPABASE_URL="https://wgiittrvgtiosogyhfcl.supabase.co";
const SUPABASE_KEY="sb_publishable_QTCqijfNvnysUTMylNIyTA_6ngosaPN";
const client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:"pkce"}});
const FILTERS=[
 ["all","すべて"],
 ["pending","要確認"],
 ["missingSource","アイコン未取得"],
 ["assetBackfill","画像資産要補完"],
 ["missingHistory","履歴なし"]
];
let activeFilter=sessionStorage.getItem("ca-icon-health-filter")||"all";
let health=null;
let lastSummaryEl=null;
let lastIconId=null;
let timer=null;
let loading=false;

function route(){return (location.hash||"#home").slice(1)}
function isIcons(){return route()==="icons"}
function e(v){return String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"})[c])}
async function isAdmin(){
 const got=await client.auth.getSession();const session=got.data.session||null;if(!session)return false;
 const p=await client.from("profiles").select("role").eq("id",session.user.id).maybeSingle();
 return !p.error&&p.data?.role==="admin";
}
function installStyle(){
 if(document.getElementById("ca-icon-health-style"))return;
 const style=document.createElement("style");style.id="ca-icon-health-style";style.textContent=`
.ca-icon-health-panel{background:#fff;border:1px solid #e5eed7;border-radius:20px;padding:14px 16px;margin-top:12px}.ca-icon-health-metrics{display:flex;gap:7px;flex-wrap:wrap}.ca-icon-health-filters{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}.ca-icon-health-filter{border:1px solid #d9f99d;background:#fff;color:#4d7c0f;border-radius:999px;padding:8px 11px;font-weight:900;font-size:11px}.ca-icon-health-filter.on{background:#a3e635;border-color:#84cc16;color:#365314}.ca-icon-health-tags{display:flex;gap:5px;flex-wrap:wrap;justify-content:center;margin-top:7px}.ca-icon-health-tag{display:inline-flex;border-radius:999px;padding:4px 7px;font-size:9px;font-weight:950;background:#f1f5f9;color:#475569}.ca-icon-health-tag.warn{background:#fef3c7;color:#92400e}.ca-icon-health-tag.miss{background:#ffe4e6;color:#be123c}.ca-icon-health-modal{border:1px solid #e5eed7;background:#f8fafc;border-radius:18px;padding:13px 14px;margin-top:14px}.ca-icon-health-modal .tags{margin-top:7px}.ca-icon-health-help{font-size:11px;color:#64748b;font-weight:800;line-height:1.55;margin-top:8px}
@media(max-width:820px){.ca-icon-health-panel{padding:12px}.ca-icon-health-filter{padding:8px 10px}}
`;
 document.head.appendChild(style);
}
function matches(h,key){
 if(key==="all")return true;
 return !!h?.[key];
}
function count(key){return health?[...health.values()].filter(h=>matches(h,key)).length:0}
function panelSignature(){return FILTERS.map(([key])=>key+":"+count(key)).join("|")+"|active:"+activeFilter}
function renderPanel(){
 if(!health||!isIcons())return;
 const summary=document.getElementById("iconSummary");if(!summary)return;
 let panel=document.getElementById("caIconHealth");
 if(!panel){panel=document.createElement("section");panel.id="caIconHealth";panel.className="ca-icon-health-panel";summary.insertAdjacentElement("afterend",panel)}
 const sig=panelSignature();if(panel.dataset.signature===sig)return;panel.dataset.signature=sig;
 panel.innerHTML='<div class="tiny strong muted">Community / アイコン状態</div><div class="ca-icon-health-metrics section">'+
  '<span class="pill">全国 '+health.size+'</span>'+
  '<span class="pill '+(count("pending")?"amber":"")+'">要確認 '+count("pending")+'</span>'+
  '<span class="pill '+(count("missingSource")?"rose":"")+'">アイコン未取得 '+count("missingSource")+'</span>'+
  '<span class="pill '+(count("assetBackfill")?"amber":"")+'">画像資産要補完 '+count("assetBackfill")+'</span>'+
  '<span class="pill '+(count("missingHistory")?"amber":"")+'">履歴なし '+count("missingHistory")+'</span></div>'+
  '<div class="ca-icon-health-filters">'+FILTERS.map(([key,label])=>'<button type="button" class="ca-icon-health-filter '+(activeFilter===key?"on":"")+'" data-ca-icon-filter="'+key+'">'+label+' '+(key==="all"?health.size:count(key))+'</button>').join("")+'</div>'+
  '<div class="ca-icon-health-help">「画像資産要補完」は元アイコンURLは取得済みで、サムネイル・永久保存画像のどれかが未生成のCommunityです。上の「画像資産を一括補完」で修復対象になります。</div>';
 panel.querySelectorAll("[data-ca-icon-filter]").forEach(button=>button.onclick=()=>{
  activeFilter=button.dataset.caIconFilter||"all";sessionStorage.setItem("ca-icon-health-filter",activeFilter);renderPanel();applyHealth();
 });
}
function badgeHtml(h){
 const labels=[];
 if(h.pending)labels.push('<span class="ca-icon-health-tag warn">要確認</span>');
 if(h.missingSource)labels.push('<span class="ca-icon-health-tag miss">アイコン未取得</span>');
 else if(h.assetBackfill)labels.push('<span class="ca-icon-health-tag warn">画像資産要補完</span>');
 if(h.missingHistory)labels.push('<span class="ca-icon-health-tag warn">履歴なし</span>');
 return labels.join("");
}
function applyHealth(){
 if(!health||!isIcons())return;
 document.querySelectorAll(".iconstamp[data-icon-id]").forEach(stamp=>{
  const h=health.get(stamp.dataset.iconId);if(!h)return;
  let row=stamp.querySelector(".ca-icon-health-tags");const html=badgeHtml(h);
  if(html){if(!row){row=document.createElement("div");row.className="ca-icon-health-tags";const detail=stamp.querySelector(".stampdetail");if(detail)detail.before(row);else stamp.appendChild(row)}if(row.innerHTML!==html)row.innerHTML=html}
  else if(row)row.remove();
  const show=matches(h,activeFilter);if(stamp.hidden===show)stamp.hidden=!show;
 });
 document.querySelectorAll(".icongroup").forEach(group=>{
  const hasVisible=[...group.querySelectorAll(".iconstamp[data-icon-id]")].some(x=>!x.hidden);
  if(group.hidden===hasVisible)group.hidden=!hasVisible;
 });
 enhanceModal();
}
function enhanceModal(){
 if(!health||!lastIconId)return;
 const modal=document.querySelector("#iconModal .adminmodal");if(!modal||modal.querySelector("#caIconHealthModal"))return;
 const h=health.get(lastIconId);if(!h)return;
 const box=document.createElement("div");box.id="caIconHealthModal";box.className="ca-icon-health-modal";
 const statuses=[];
 statuses.push(h.missingSource?'<span class="pill rose">アイコン未取得</span>':'<span class="pill">アイコン取得済み</span>');
 statuses.push(h.assetBackfill?'<span class="pill amber">画像資産要補完</span>':'<span class="pill">画像資産OK</span>');
 statuses.push(h.missingHistory?'<span class="pill amber">履歴なし</span>':'<span class="pill">保存履歴 '+h.historyCount+'件</span>');
 if(h.pending)statuses.push('<span class="pill amber">変更確認待ち</span>');
 let help='アイコン取得・保存状態に問題はありません。';
 if(h.missingSource)help='CampfireからアイコンURLを取得できていません。Campfire接続・同期後に再確認してください。';
 else if(h.assetBackfill)help='元画像は取得済みです。アイコン一覧上部の「画像資産を一括補完」でサムネイル・保存画像の生成を試せます。';
 else if(h.missingHistory)help='保存済みデザイン履歴がありません。画像資産の補完後に再確認してください。';
 box.innerHTML='<div class="tiny strong muted">アイコン資産状態</div><div class="tags">'+statuses.join("")+'</div><div class="ca-icon-health-help">'+e(help)+'</div>';
 const actions=modal.querySelector(".actions");if(actions)actions.before(box);else modal.appendChild(box);
}
async function loadHealth(){
 if(loading||!isIcons())return;loading=true;
 try{
  if(!(await isAdmin()))return;
  const [cr,vr,ir]=await Promise.all([
   client.from("communities").select("id,avatar_url,avatar_thumbnail_path"),
   client.from("community_icon_versions").select("community_id,thumbnail_path,archive_path,is_current"),
   client.from("community_icon_changes").select("community_id,change_type,reviewed_at").eq("change_type","changed").is("reviewed_at",null)
  ]);
  const error=cr.error||vr.error||ir.error;if(error)throw error;
  const historyCount=new Map(),currentVersion=new Map();
  (vr.data||[]).forEach(v=>{historyCount.set(v.community_id,(historyCount.get(v.community_id)||0)+1);if(v.is_current)currentVersion.set(v.community_id,v)});
  const pending=new Set((ir.data||[]).map(x=>x.community_id).filter(Boolean));
  health=new Map((cr.data||[]).map(c=>{
   const source=String(c.avatar_url||"").trim();const thumb=String(c.avatar_thumbnail_path||"").trim();const current=currentVersion.get(c.id)||null;
   const missingSource=!source;
   const assetBackfill=!!source&&(!thumb||!current||!String(current.thumbnail_path||"").trim()||!String(current.archive_path||"").trim());
   const item={pending:pending.has(c.id),missingSource,assetBackfill,missingHistory:!historyCount.get(c.id),historyCount:historyCount.get(c.id)||0};
   return [c.id,item];
  }));
  renderPanel();applyHealth();
 }catch(error){
  const summary=document.getElementById("iconSummary");if(summary&&!document.getElementById("caIconHealthError")){const box=document.createElement("div");box.id="caIconHealthError";box.className="notice err section";box.textContent="アイコン資産状態を取得できませんでした: "+(error.message||String(error));summary.insertAdjacentElement("afterend",box)}
 }finally{loading=false}
}
function schedule(){
 clearTimeout(timer);timer=setTimeout(()=>{
  if(!isIcons())return;
  const summary=document.getElementById("iconSummary");if(!summary)return;
  if(summary!==lastSummaryEl){lastSummaryEl=summary;health=null;void loadHealth();return}
  if(health){renderPanel();applyHealth()}
 },90);
}
function start(){
 installStyle();
 document.addEventListener("click",ev=>{const button=ev.target.closest?.("[data-icon-id]");if(button)lastIconId=button.dataset.iconId||null},true);
 const app=document.getElementById("app");if(app)new MutationObserver(schedule).observe(app,{childList:true,subtree:true});
 window.addEventListener("hashchange",()=>{lastIconId=null;schedule()});
 schedule();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();