(function(){
"use strict";
const STORE_PREFIX="ca-clover-virtual-stamps-v1:";
let scheduled=false;
let activeVirtual=null;

function loadVirtual(){
 const all=[];
 try{
  for(let i=0;i<localStorage.length;i++){
   const key=localStorage.key(i)||"";
   if(!key.startsWith(STORE_PREFIX))continue;
   const value=JSON.parse(localStorage.getItem(key)||"[]");
   if(Array.isArray(value))all.push(...value);
  }
 }catch(_){return[]}
 const seen=new Set();
 return all.filter(x=>{
  if(!x||!x.ca_member_id||!x.community_id)return false;
  const k=String(x.ca_member_id)+"|"+String(x.community_id);
  if(seen.has(k))return false;
  seen.add(k);
  return true;
 });
}
function clearVirtual(){
 const keys=[];
 for(let i=0;i<localStorage.length;i++){
  const key=localStorage.key(i)||"";
  if(key.startsWith(STORE_PREFIX))keys.push(key);
 }
 keys.forEach(key=>localStorage.removeItem(key));
}
function style(){
 if(document.getElementById("ca-vt-style"))return;
 const s=document.createElement("style");
 s.id="ca-vt-style";
 s.textContent=`
.ca-vt-link{display:block!important;margin-top:12px!important;text-align:center!important;border:1px dashed #d8b873!important;background:#fff8df!important;color:#82601c!important}
.ca-vt-banner{margin:0 0 14px;border:1px solid #e9c978;border-radius:20px;background:#fff8df;padding:12px 14px;display:flex;align-items:center;gap:10px;color:#73551e}
.ca-vt-banner .grow{flex:1}.ca-vt-reset{border:0;border-radius:999px;background:#fff;color:#8b651e;padding:7px 10px;font-size:9px;font-weight:950}
.ca-vt-owned .medal{outline:2px solid rgba(214,166,62,.32);outline-offset:2px}.ca-vt-chip{display:inline-block;margin-top:4px;border-radius:999px;background:#fff2bf;color:#8a641d;padding:2px 6px;font-size:7px;font-weight:950}
.ca-vt-modal-badge{display:inline-block;margin-top:8px;border-radius:999px;background:#fff2bf;color:#8a641d;padding:5px 10px;font-size:9px;font-weight:950}
.ca-vt-modal-note{margin-top:12px;border:1px solid #efd18c;border-radius:18px;background:#fff8df;padding:11px 12px;text-align:left;font-size:10px;line-height:1.55;font-weight:850;color:#76571d}
`;
 document.head.appendChild(s);
}
function installExchange(){
 if(!/(?:^|\/)stamp-exchange\.html$/.test(location.pathname))return;
 style();
 const app=document.getElementById("app");
 if(!app)return;
 const add=()=>{
  if(app.querySelector(".ca-vt-link"))return;
  const grid=app.querySelector(":scope > .grid");
  if(!grid||document.getElementById("qr")||app.querySelector(".person"))return;
  const a=document.createElement("a");
  a.className="btn ca-vt-link";
  a.href="./stamp-test.html";
  a.textContent="🧪 仮想交換（ADMIN）";
  grid.insertAdjacentElement("afterend",a);
 };
 add();
 new MutationObserver(add).observe(app,{childList:true,subtree:true});
}
function norm(v){return String(v||"").replace(/^[●○]\s*/,"").trim().normalize("NFKC").toLowerCase()}
function banner(items){
 const wrap=document.querySelector("main.wrap");
 if(!wrap)return;
 let b=document.getElementById("caVtBanner");
 if(!b){
  b=document.createElement("div");
  b.id="caVtBanner";
  b.className="ca-vt-banner";
  b.innerHTML='<div>🧪</div><div><strong>仮想交換テスト中</strong><div id="caVtCount" style="font-size:9px;font-weight:800;margin-top:2px"></div></div><div class="grow"></div><button class="ca-vt-reset" type="button">リセット</button>';
  const hero=wrap.querySelector(".hero");
  if(hero)wrap.insertBefore(b,hero);else wrap.prepend(b);
  b.querySelector(".ca-vt-reset").onclick=()=>{clearVirtual();location.reload()};
 }
 const c=b.querySelector("#caVtCount"),t="正式記録ではありません ・ "+items.length+"件";
 if(c&&c.textContent!==t)c.textContent=t;
}
function applyCounts(items){
 const total=document.getElementById("totalScore");
 if(total){
  if(!total.dataset.caVtBase){
   const m=String(total.textContent||"").match(/(\d+)\s*\/\s*(\d+)/);
   if(m){total.dataset.caVtBase=m[1];total.dataset.caVtTotal=m[2]}
  }
  const base=Number(total.dataset.caVtBase||0),den=Number(total.dataset.caVtTotal||0),target=Math.min(den,base+items.length),m=String(total.textContent||"").match(/(\d+)\s*\/\s*(\d+)/);
  if(den&&(!m||Number(m[1])!==target||Number(m[2])!==den))total.innerHTML=target+' <span>/ '+den+'</span>';
 }
 const byPref=new Map();
 items.forEach(x=>{const p=String(x.prefecture||"");if(p)byPref.set(p,(byPref.get(p)||0)+1)});
 document.querySelectorAll(".pref").forEach(el=>{
  const name=el.querySelector(".prefname")?.textContent.trim()||"",extra=byPref.get(name)||0;
  if(!extra)return;
  const p=el.querySelector(".progress");
  if(!p)return;
  if(!p.dataset.caVtBase){
   const m=String(p.textContent||"").match(/取得\s*(\d+)\s*\/\s*(\d+)/);
   if(m){p.dataset.caVtBase=m[1];p.dataset.caVtTotal=m[2]}
  }
  const base=Number(p.dataset.caVtBase||0),den=Number(p.dataset.caVtTotal||0),target=Math.min(den,base+extra),text="取得 "+target+" / "+den;
  if(den&&p.textContent!==text)p.textContent=text;
 });
}
function itemForCommunity(id){
 return loadVirtual().find(x=>String(x.community_id)===String(id))||null;
}
function patchModal(item){
 if(!item)return;
 const back=document.getElementById("stampModalBack");
 if(!back||!back.classList.contains("show"))return;
 const title=document.getElementById("stampZoomTitle");
 const area=document.getElementById("stampZoomArea");
 const zoom=document.getElementById("stampZoom2D");
 const img=document.getElementById("stampZoomImg");
 const controls=document.getElementById("stampDesignControls");
 const stamp3d=document.getElementById("stamp3d");
 if(zoom)zoom.classList.remove("unowned");
 if(stamp3d){stamp3d.classList.remove("show");stamp3d.innerHTML="";}
 if(zoom)zoom.classList.remove("hidden");
 if(title&&item.community_name)title.textContent=item.community_name;
 if(area){
  area.textContent=[item.prefecture||"",(item.ca_level||"CA")+" ・ "+(item.trainer_name||""),"取得済み（TEST）"].filter(Boolean).join("\n");
  area.style.whiteSpace="pre-line";
 }
 if(img){
  img.style.display="block";
  img.style.filter="none";
  img.style.opacity="1";
  if(item.avatar_url)img.src=item.avatar_url;
 }
 if(controls){
  const d=item.acquired_at?new Date(item.acquired_at):new Date();
  const date=Number.isNaN(d.getTime())?"":d.toLocaleDateString("ja-JP");
  controls.innerHTML='<div class="ca-vt-modal-badge">🧪 TEST取得済み</div><div class="ca-vt-modal-note">仮想交換で取得した表示です。正式な取得履歴には保存されていません。'+(date?'<br>テスト取得日: '+date:'')+'</div>';
 }
}
function apply(){
 if(!/(?:^|\/)stamp-rally\.html$/.test(location.pathname))return;
 const items=loadVirtual();
 if(!items.length)return;
 style();
 banner(items);
 for(const item of items){
  const btn=Array.from(document.querySelectorAll('.stamp[data-community]')).find(x=>x.dataset.community===String(item.community_id));
  if(!btn)continue;
  const medal=btn.querySelector(".medal");
  if(medal&&medal.classList.contains("unowned"))medal.classList.remove("unowned");
  if(!btn.classList.contains("ca-vt-owned"))btn.classList.add("ca-vt-owned");
  const row=Array.from(btn.querySelectorAll(".caname")).find(x=>norm(x.textContent)===norm(item.trainer_name));
  if(row){
   row.classList.remove("off");
   row.classList.add("on");
   const txt="● "+String(item.trainer_name||"");
   if(row.textContent!==txt)row.textContent=txt;
  }
  if(!btn.querySelector(".ca-vt-chip")){
   const name=btn.querySelector(".cname");
   if(name){const chip=document.createElement("span");chip.className="ca-vt-chip";chip.textContent="TEST";name.insertAdjacentElement("afterend",chip)}
  }
 }
 applyCounts(items);
 if(activeVirtual)patchModal(activeVirtual);
}
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;apply()})}
function installRally(){
 if(!/(?:^|\/)stamp-rally\.html$/.test(location.pathname))return;
 style();
 document.addEventListener("click",ev=>{
  const target=ev.target&&ev.target.closest?ev.target.closest('.stamp[data-community]'):null;
  if(target){
   activeVirtual=itemForCommunity(target.dataset.community);
   if(activeVirtual){
    setTimeout(()=>patchModal(activeVirtual),0);
    setTimeout(()=>patchModal(activeVirtual),80);
   }
   return;
  }
  const close=ev.target&&ev.target.closest?ev.target.closest("#stampClose"):null;
  if(close)activeVirtual=null;
 },true);
 schedule();
 new MutationObserver(()=>{
  schedule();
  if(activeVirtual)patchModal(activeVirtual);
 }).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["class"]});
}
function start(){installExchange();installRally()}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();