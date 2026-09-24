(function(){
"use strict";
const PROJECT_REF="wgiittrvgtiosogyhfcl";
const SUPABASE_URL="https://wgiittrvgtiosogyhfcl.supabase.co";
const SUPABASE_KEY="sb_publishable_QTCqijfNvnysUTMylNIyTA_6ngosaPN";
const AUTH_KEY="sb-"+PROJECT_REF+"-auth-token";
const STORE_PREFIX="ca-clover-virtual-stamps-v1:";
let cachedAuth=null;
let cachedAdmin=null;
let scheduled=false;

function readAuth(){
 try{
  const raw=localStorage.getItem(AUTH_KEY);
  if(!raw)return null;
  const parsed=JSON.parse(raw);
  const session=parsed&&parsed.currentSession?parsed.currentSession:parsed&&parsed.session?parsed.session:parsed;
  const token=session&&session.access_token;
  const user=session&&session.user;
  if(!token||!user||!user.id)return null;
  return {token,user};
 }catch(_){return null}
}
async function getAdmin(){
 if(cachedAdmin!==null)return cachedAdmin;
 cachedAuth=readAuth();
 if(!cachedAuth){cachedAdmin=false;return false}
 try{
  const r=await fetch(SUPABASE_URL+"/rest/v1/profiles?id=eq."+encodeURIComponent(cachedAuth.user.id)+"&select=role",{
   headers:{apikey:SUPABASE_KEY,Authorization:"Bearer "+cachedAuth.token,Accept:"application/json"}
  });
  if(!r.ok){cachedAdmin=false;return false}
  const rows=await r.json();
  cachedAdmin=Array.isArray(rows)&&rows[0]&&rows[0].role==="admin";
  return cachedAdmin;
 }catch(_){cachedAdmin=false;return false}
}
function storageKey(){
 const auth=cachedAuth||readAuth();
 return auth&&auth.user&&auth.user.id?STORE_PREFIX+auth.user.id:null;
}
function loadVirtual(){
 const key=storageKey();
 if(!key)return[];
 try{
  const value=JSON.parse(localStorage.getItem(key)||"[]");
  return Array.isArray(value)?value.filter(x=>x&&x.ca_member_id&&x.community_id):[];
 }catch(_){return[]}
}
function addStyle(){
 if(document.getElementById("ca-virtual-test-style"))return;
 const style=document.createElement("style");
 style.id="ca-virtual-test-style";
 style.textContent=`
.ca-virtual-link{display:block!important;margin-top:12px!important;text-align:center!important;border:1px dashed #d8b873!important;background:#fff8df!important;color:#82601c!important}
.ca-virtual-banner{margin:0 0 14px;border:1px solid #e9c978;border-radius:20px;background:#fff8df;padding:12px 14px;display:flex;align-items:center;gap:10px;color:#73551e;box-shadow:0 8px 20px rgba(126,92,31,.08)}
.ca-virtual-banner strong{display:block;font-size:12px}.ca-virtual-banner small{display:block;margin-top:2px;font-size:9px;font-weight:800;color:#967331}.ca-virtual-banner .grow{flex:1}.ca-virtual-reset{border:0;border-radius:999px;background:#fff;color:#8b651e;padding:7px 10px;font-size:9px;font-weight:950;box-shadow:0 2px 8px rgba(100,70,20,.08)}
.ca-virtual-owned .medal{outline:2px solid rgba(214,166,62,.32);outline-offset:2px}.ca-virtual-chip{display:inline-block;margin-top:4px;border-radius:999px;background:#fff2bf;color:#8a641d;padding:2px 6px;font-size:7px;font-weight:950;letter-spacing:.05em}
`;
 document.head.appendChild(style);
}

async function installExchangeLink(){
 if(!/(?:^|\/)stamp-exchange\.html$/.test(location.pathname))return;
 if(!await getAdmin())return;
 addStyle();
 const app=document.getElementById("app");
 if(!app)return;
 const inject=()=>{
  if(app.querySelector(".ca-virtual-link"))return;
  const grid=app.querySelector(":scope > .grid");
  if(!grid||document.getElementById("qr")||app.querySelector(".person"))return;
  const a=document.createElement("a");
  a.className="btn ca-virtual-link";
  a.href="./stamp-test.html";
  a.textContent="🧪 仮想交換（ADMIN）";
  grid.insertAdjacentElement("afterend",a);
 };
 inject();
 const observer=new MutationObserver(()=>inject());
 observer.observe(app,{childList:true,subtree:true});
}

function normalizeTrainerText(text){return String(text||"").replace(/^[●○]\s*/,"").trim().normalize("NFKC").toLowerCase()}
function parseCount(text){
 const m=String(text||"").match(/取得\s*(\d+)\s*\/\s*(\d+)/);
 return m?{got:Number(m[1]),total:Number(m[2])}:null;
}
function findCommunityButton(id){
 return Array.from(document.querySelectorAll('.stamp[data-community]')).find(x=>x.dataset.community===id)||null;
}
function addRallyBanner(items){
 const wrap=document.querySelector("main.wrap");
 if(!wrap)return;
 let banner=document.getElementById("caVirtualBanner");
 if(!banner){
  banner=document.createElement("div");
  banner.id="caVirtualBanner";
  banner.className="ca-virtual-banner";
  const hero=wrap.querySelector(".hero");
  if(hero)wrap.insertBefore(banner,hero);else wrap.prepend(banner);
 }
 banner.innerHTML='<div>🧪</div><div><strong>仮想交換テスト中</strong><small>正式な取得記録には入りません ・ '+items.length+'件</small></div><div class="grow"></div><button type="button" class="ca-virtual-reset">リセット</button>';
 const reset=banner.querySelector(".ca-virtual-reset");
 if(reset)reset.onclick=()=>{
  const key=storageKey();
  if(key)localStorage.removeItem(key);
  location.reload();
 };
}
function applyRallyVirtual(){
 if(!/(?:^|\/)stamp-rally\.html$/.test(location.pathname))return;
 const items=loadVirtual();
 if(!items.length)return;
 addStyle();
 addRallyBanner(items);
 let applied=0;
 const byPref=new Map();
 items.forEach(item=>{
  const btn=findCommunityButton(String(item.community_id));
  if(!btn)return;
  const medal=btn.querySelector(".medal");
  if(medal)medal.classList.remove("unowned");
  btn.classList.add("ca-virtual-owned");
  const target=normalizeTrainerText(item.trainer_name);
  const names=Array.from(btn.querySelectorAll(".caname"));
  const row=names.find(x=>normalizeTrainerText(x.textContent)===target);
  if(row){
   row.classList.remove("off");row.classList.add("on");
   const next="● "+String(item.trainer_name||"");
   if(row.textContent!==next)row.textContent=next;
   row.dataset.caVirtual="1";
  }
  if(!btn.querySelector(".ca-virtual-chip")){
   const cname=btn.querySelector(".cname");
   if(cname){const chip=document.createElement("span");chip.className="ca-virtual-chip";chip.textContent="TEST";cname.insertAdjacentElement("afterend",chip)}
  }
  applied++;
  const pref=String(item.prefecture||"");
  if(pref)byPref.set(pref,(byPref.get(pref)||0)+1);
 });
 if(!applied)return;
 const total=document.getElementById("totalScore");
 if(total){
  if(!total.dataset.caVirtualBaseGot){
   const m=String(total.textContent||"").match(/(\d+)\s*\/\s*(\d+)/);
   if(m){total.dataset.caVirtualBaseGot=m[1];total.dataset.caVirtualTotal=m[2]}
  }
  const base=Number(total.dataset.caVirtualBaseGot||0),den=Number(total.dataset.caVirtualTotal||0);
  if(den)total.innerHTML=Math.min(den,base+items.length)+' <span>/ '+den+'</span>';
 }
 document.querySelectorAll(".pref").forEach(prefEl=>{
  const name=prefEl.querySelector(".prefname")?.textContent.trim()||"";
  const extra=byPref.get(name)||0;
  if(!extra)return;
  const progress=prefEl.querySelector(".progress");
  if(!progress)return;
  if(!progress.dataset.caVirtualBase){
   const parsed=parseCount(progress.textContent);
   if(parsed){progress.dataset.caVirtualBase=String(parsed.got);progress.dataset.caVirtualTotal=String(parsed.total)}
  }
  const base=Number(progress.dataset.caVirtualBase||0),den=Number(progress.dataset.caVirtualTotal||0);
  if(den)progress.textContent="取得 "+Math.min(den,base+extra)+" / "+den;
 });
}
function scheduleRallyApply(){
 if(scheduled)return;scheduled=true;
 requestAnimationFrame(()=>{scheduled=false;applyRallyVirtual()});
}
async function installRallyOverlay(){
 if(!/(?:^|\/)stamp-rally\.html$/.test(location.pathname))return;
 cachedAuth=readAuth();
 if(!cachedAuth)return;
 scheduleRallyApply();
 const observer=new MutationObserver(scheduleRallyApply);
 observer.observe(document.body,{childList:true,subtree:true});
}
function start(){
 void installExchangeLink();
 void installRallyOverlay();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();