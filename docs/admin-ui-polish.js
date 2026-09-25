(function(){
"use strict";
if(!/(?:^|\/)admin\.html$/.test(location.pathname))return;

const STATUS_LABELS={
 success:"成功",approved:"承認済み",ready:"準備完了",pending:"保留中",running:"実行中",partial:"一部取得",complete:"取得完了",missing:"未取得",failed:"失敗",error:"エラー",rejected:"却下",active:"有効",retired:"退任",paused:"停止中",disabled:"無効",enabled:"有効",
 unreviewed:"未確認",reviewing:"確認中",no_issue:"問題なし",contacting:"連絡・確認中",resolved:"解決済",contact_host:"本人確認",sop_in_progress:"対応中",completed:"完了",
 matched:"一致",not_listed:"地図未掲載"
};

function setText(el,text){if(el&&el.textContent!==text)el.textContent=text;}
function exactStatus(text){const key=String(text||"").trim().toLowerCase();return STATUS_LABELS[key]||null;}
function levelClass(el){
 const text=(el.textContent||"").trim();
 el.classList.remove("ca-level-1st","ca-level-2nd");
 if(text==="1st"||text.startsWith("1st:"))el.classList.add("ca-level-1st");
 if(text==="2nd"||text.startsWith("2nd:"))el.classList.add("ca-level-2nd");
}
function translatePill(el){
 const raw=(el.textContent||"").trim();
 if(!raw)return;
 const exact=exactStatus(raw);
 if(exact){setText(el,exact);return;}
 if(raw==="CA地図 matched"){setText(el,"CA地図 一致");return;}
 if(raw==="CA地図 not_listed"){setText(el,"CA地図 未掲載");return;}
 if(raw==="matched"){setText(el,"一致");return;}
 if(raw==="not_listed"){setText(el,"地図未掲載");return;}
 levelClass(el);
}
function translateRoleButtons(root){
 (root||document).querySelectorAll("[data-role]").forEach(button=>{
  const role=button.dataset.role;
  if(role==="pending")setText(button,"未登録");
  else if(role==="ca")setText(button,"CA");
  else if(role==="admin")setText(button,"管理者");
 });
}
function translateStatusLines(root){
 (root||document).querySelectorAll(".small.muted.strong,.tiny.muted.strong,.strong").forEach(el=>{
  const text=(el.textContent||"").trim();
  if(text.startsWith("Status:")){
   const raw=text.slice(7).trim();
   setText(el,"状態: "+(exactStatus(raw)||raw));
  }
 });
 (root||document).querySelectorAll(".metric .tiny.strong.muted").forEach(el=>{
  const t=(el.textContent||"").trim();
  if(t==="Complete")setText(el,"取得完了");
  else if(t==="Partial")setText(el,"一部取得");
  else if(t==="Missing")setText(el,"未取得");
 });
}
function polishHeader(){
 const nav=document.querySelector("header .nav");
 if(!nav)return;
 const general=nav.querySelector('a[href="./"]');
 if(general)setText(general,"My Community");
 const home=document.getElementById("homeBtn");
 if(home)setText(home,"管理メニュー");
}
function parseBadgeCount(badge){
 if(!badge)return 0;
 const m=(badge.textContent||"").match(/(\d+)/);
 return m?Number(m[1]):0;
}
function polishMenu(){
 document.querySelectorAll(".menucard").forEach(card=>{
  const title=card.querySelector("h3")?.textContent.trim();
  const badge=card.querySelector(".count");
  const count=parseBadgeCount(badge);
  if(title==="要確認Meetup"&&badge)setText(badge,"未確認 "+count);
  if(title==="Community申請"&&badge)setText(badge,"承認待ち "+count);
  if(title==="アイコン一覧"&&badge)setText(badge,"要確認 "+count);
  if(title==="Community権限調整"&&badge){
   setText(badge,"未割当 "+count);
   badge.classList.remove("slate");
   badge.classList.add("amber");
   if(count>0)card.classList.add("attention");
   else card.classList.remove("attention");
  }
 });
}
function polishClaims(){
 document.querySelectorAll(".claim").forEach(card=>{
  card.querySelectorAll(".pill").forEach(pill=>{
   const raw=(pill.textContent||"").trim();
   if(raw==="pending")setText(pill,"承認待ち");
   else translatePill(pill);
  });
 });
}
function polishAll(){
 polishHeader();
 polishClaims();
 document.querySelectorAll(".pill").forEach(translatePill);
 translateRoleButtons(document);
 translateStatusLines(document);
 polishMenu();
 document.querySelectorAll(".pill").forEach(levelClass);
}

function installStyle(){
 if(document.getElementById("ca-admin-polish-style"))return;
 const style=document.createElement("style");
 style.id="ca-admin-polish-style";
 style.textContent=`
.ca-level-1st{background:#fef3c7!important;color:#92400e!important;border-color:#fde68a!important}
.ca-level-2nd{background:#e0f2fe!important;color:#075985!important;border-color:#bae6fd!important}
@media(max-width:820px){
 .topin{align-items:center!important;padding:10px 12px!important;gap:8px!important}
 .topin .logo{flex:0 0 44px!important}
 .topin .nav{max-width:none!important;display:flex!important;flex-wrap:nowrap!important;gap:5px!important;justify-content:flex-end!important}
 .topin .nav a,.topin .nav button{padding:8px 9px!important;font-size:11px!important;white-space:nowrap!important}
 .menu{grid-template-columns:1fr!important}
 .menucard{min-height:132px!important}
 .menucard .count{right:12px!important;top:12px!important}
}
@media(max-width:390px){
 .topin .nav a,.topin .nav button{padding:7px 7px!important;font-size:10px!important}
 .topin{padding-left:10px!important;padding-right:10px!important}
}
`;
 document.head.appendChild(style);
}

let timer=null;
function schedule(){clearTimeout(timer);timer=setTimeout(polishAll,40);}
function start(){
 installStyle();
 polishAll();
 const app=document.getElementById("app");
 if(app)new MutationObserver(schedule).observe(app,{childList:true,subtree:true,characterData:true});
 const nav=document.querySelector("header .nav");
 if(nav)new MutationObserver(schedule).observe(nav,{childList:true,subtree:true,characterData:true});
 window.addEventListener("hashchange",schedule);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});
else start();
})();