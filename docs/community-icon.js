(function(){
"use strict";
function esc(v){return String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"})[c]);}
function cleanVisibleTextNode(node){
 if(!node||node.nodeType!==Node.TEXT_NODE)return;
 const parent=node.parentElement;
 if(!parent||parent.closest("script,style,pre,code,textarea"))return;
 const before=node.nodeValue||"";
 if(!before.includes("\\n")&&!/(^|\s)\/n(?=\s|$)/.test(before))return;
 const after=before.replace(/\\n/g,"\n").replace(/(^|\s)\/n(?=\s|$)/g,"$1");
 if(after!==before)node.nodeValue=after;
}
function cleanVisibleBreakArtifacts(root){
 if(!root)return;
 if(root.nodeType===Node.TEXT_NODE){cleanVisibleTextNode(root);return;}
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
 while(walker.nextNode())cleanVisibleTextNode(walker.currentNode);
}
function repairStampRallyStyleBreaks(){
 if(!/(?:^|\/)stamp-rally\.html$/.test(location.pathname))return;
 document.querySelectorAll("style").forEach(style=>{
  const before=style.textContent||"";
  const after=before.replace(/\\n(?=[.#@])/g,"\n");
  if(after!==before)style.textContent=after;
 });
}
function installBreakArtifactCleanup(){
 const run=()=>{
  cleanVisibleBreakArtifacts(document.documentElement);
  repairStampRallyStyleBreaks();
 };
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",run,{once:true});
 else run();
 const observer=new MutationObserver(mutations=>{
  for(const mutation of mutations){
   if(mutation.type==="characterData")cleanVisibleTextNode(mutation.target);
   for(const node of mutation.addedNodes)cleanVisibleBreakArtifacts(node);
  }
 });
 const start=()=>{
  if(document.documentElement)observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
 };
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});
 else start();
}
function url(client,community){if(!community)return"";if(community.avatar_thumbnail_path){const data=client.storage.from("community-icon-thumbs").getPublicUrl(community.avatar_thumbnail_path).data;return data.publicUrl+(community.avatar_last_changed_at?"?v="+encodeURIComponent(community.avatar_last_changed_at):"")}return community.avatar_url||""}
function img(client,community,attrs){const src=url(client,community),original=community&&community.avatar_url||"";if(!src)return"";return '<img data-ca-community-icon="1" data-original="'+esc(original)+'" src="'+esc(src)+'" '+(attrs||"")+'>'}
function bind(root){(root||document).querySelectorAll('img[data-ca-community-icon="1"]').forEach(image=>{if(image.dataset.caBound==="1")return;image.dataset.caBound="1";image.addEventListener("error",()=>{const original=image.dataset.original||"";if(original&&image.dataset.caOriginalTried!=="1"&&image.src!==original){image.dataset.caOriginalTried="1";image.src=original;return}image.style.display="none"})})}
function enhanceAdminIconHistory(root){
 if(!/(?:^|\/)admin\.html$/.test(location.pathname))return;
 (root||document).querySelectorAll(".adminmodal .section").forEach(section=>{
  const label=section.querySelector(":scope > .tiny.strong.muted");
  if(!label||!label.textContent.trim().startsWith("保存済みデザイン履歴"))return;
  const row=section.querySelector(":scope > .row.section");
  if(!row)return;
  row.classList.add("icon-history-row");
  Array.from(row.children).forEach(item=>item.classList.add("icon-history-item"));
 });
}
function enhanceAdminModalImages(root){
 if(!/(?:^|\/)admin\.html$/.test(location.pathname))return;
 const scope=root&&root.querySelectorAll?root:document;
 const avatars=[];
 if(scope.matches&&scope.matches(".adminmodal .comparebox .avatar,.adminmodal .icon-history-item .avatar"))avatars.push(scope);
 scope.querySelectorAll(".adminmodal .comparebox .avatar,.adminmodal .icon-history-item .avatar").forEach(avatar=>avatars.push(avatar));
 avatars.forEach(avatar=>{
  avatar.classList.add("ca-admin-modal-avatar");
  let fallback=avatar.querySelector(":scope > .icon-fallback");
  if(!fallback){
   fallback=document.createElement("span");
   fallback.className="icon-fallback ca-admin-modal-icon-fallback";
   fallback.textContent="🍀";
   avatar.insertBefore(fallback,avatar.firstChild);
  }
  avatar.querySelectorAll("img").forEach(image=>{
   image.dataset.caCommunityIcon="1";
   if(!image.dataset.original)image.dataset.original=image.getAttribute("src")||"";
   image.removeAttribute("width");
   image.removeAttribute("height");
  });
  bind(avatar);
 });
}
let adminModalScrollY=0;
let adminModalLocked=false;
function syncAdminModalScrollLock(){
 if(!/(?:^|\/)admin\.html$/.test(location.pathname))return;
 const shouldLock=!!document.querySelector(".adminmodalback");
 if(shouldLock&&!adminModalLocked){
  adminModalScrollY=window.scrollY||window.pageYOffset||0;
  document.documentElement.classList.add("ca-admin-modal-open");
  document.body.classList.add("ca-admin-modal-open");
  document.body.style.position="fixed";
  document.body.style.top="-"+adminModalScrollY+"px";
  document.body.style.left="0";
  document.body.style.right="0";
  document.body.style.width="100%";
  document.body.style.overflow="hidden";
  adminModalLocked=true;
  return;
 }
 if(!shouldLock&&adminModalLocked){
  document.documentElement.classList.remove("ca-admin-modal-open");
  document.body.classList.remove("ca-admin-modal-open");
  document.body.style.position="";
  document.body.style.top="";
  document.body.style.left="";
  document.body.style.right="";
  document.body.style.width="";
  document.body.style.overflow="";
  const y=adminModalScrollY;
  adminModalLocked=false;
  requestAnimationFrame(()=>window.scrollTo(0,y));
 }
}
function closeAdminIconModalNow(ev){
 const target=ev.target&&ev.target.closest?ev.target.closest("#iconClose"):null;
 if(!target)return;
 ev.preventDefault();
 ev.stopPropagation();
 if(ev.stopImmediatePropagation)ev.stopImmediatePropagation();
 const modal=document.getElementById("iconModal")||target.closest(".adminmodalback");
 if(modal)modal.remove();
 syncAdminModalScrollLock();
}
function installAdminIconHistoryFix(){
 if(!/(?:^|\/)admin\.html$/.test(location.pathname))return;
 const style=document.createElement("style");
 style.id="ca-icon-history-style";
 style.textContent=`
html.ca-admin-modal-open,body.ca-admin-modal-open{overflow:hidden!important;overscroll-behavior:none!important}
.adminmodalback{position:fixed!important;inset:0!important;width:100%!important;height:100dvh!important;max-height:100dvh!important;overflow:hidden!important;overscroll-behavior:none!important;touch-action:pan-y!important}
.adminmodal{max-height:calc(100dvh - 32px)!important;overflow-y:auto!important;overscroll-behavior:contain!important;-webkit-overflow-scrolling:touch!important;touch-action:pan-y!important}
.comparebox .avatar,.icon-history-item .avatar{position:relative!important;overflow:hidden!important;display:grid!important;place-items:center!important}
.comparebox .avatar .icon-fallback,.icon-history-item .avatar .icon-fallback{position:absolute!important;inset:0!important;display:grid!important;place-items:center!important;z-index:0!important;font-size:34px!important}
.comparebox .avatar img,.icon-history-item .avatar img{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;max-width:none!important;object-fit:cover!important;object-position:50% 50%!important;display:block!important;z-index:1!important;margin:0!important;padding:0!important;transform:none!important}
.icon-history-row{display:flex!important;align-items:stretch!important;gap:14px!important;overflow-x:auto!important;overflow-y:hidden!important;padding:4px 2px 12px!important;scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch}
.icon-history-item{min-width:138px!important;padding:12px 10px 10px!important;border:1px solid #e5eed7;border-radius:20px;background:#f8fafc;text-align:center;scroll-snap-align:start}
.icon-history-item .avatar{width:112px!important;height:112px!important;margin:0 auto 8px!important;border-radius:999px!important;border:4px solid #fff!important;background:#f7fee7!important;box-shadow:0 8px 22px rgba(77,124,15,.12)!important}
@media(max-width:820px){.adminmodalback{padding:12px!important;align-items:flex-start!important}.adminmodal{max-height:calc(100dvh - 24px)!important}.icon-history-item{min-width:146px!important}.icon-history-item .avatar{width:120px!important;height:120px!important}}
`;
 document.head.appendChild(style);
 document.addEventListener("touchstart",closeAdminIconModalNow,{capture:true,passive:false});
 document.addEventListener("pointerdown",ev=>{if(ev.pointerType!=="touch")closeAdminIconModalNow(ev)},true);
 enhanceAdminIconHistory(document);
 enhanceAdminModalImages(document);
 syncAdminModalScrollLock();
 const observer=new MutationObserver(mutations=>{
  let modalChanged=false;
  for(const mutation of mutations){
   for(const node of mutation.addedNodes){
    if(node.nodeType===1){
     enhanceAdminIconHistory(node);
     enhanceAdminModalImages(node);
     if(node.matches&&node.matches(".adminmodal")){
      enhanceAdminIconHistory(document);
      enhanceAdminModalImages(document);
     }
     if((node.matches&&node.matches(".adminmodalback,.adminmodal"))||(node.querySelector&&node.querySelector(".adminmodalback,.adminmodal")))modalChanged=true;
    }
   }
   for(const node of mutation.removedNodes){
    if(node.nodeType===1&&((node.matches&&node.matches(".adminmodalback,.adminmodal"))||(node.querySelector&&node.querySelector(".adminmodalback,.adminmodal"))))modalChanged=true;
   }
  }
  if(modalChanged||document.querySelector(".adminmodalback"))syncAdminModalScrollLock();
 });
 observer.observe(document.body,{childList:true,subtree:true});
}
let adminCountClient=null;
function installAdminPendingCommunityCountFix(){
 if(!/(?:^|\/)admin\.html$/.test(location.pathname))return;
 const supabaseApi=window.supabase;
 if(!supabaseApi||typeof supabaseApi.createClient!=="function")return;
 const originalCreateClient=supabaseApi.createClient.bind(supabaseApi);
 supabaseApi.createClient=function(...args){
  const created=originalCreateClient(...args);
  if(!adminCountClient)adminCountClient=created;
  return created;
 };
 let timer=null;
 let requestSerial=0;
 async function refresh(){
  if(!adminCountClient)return;
  const card=Array.from(document.querySelectorAll(".menucard")).find(x=>x.querySelector("h3")?.textContent.trim()==="アイコン一覧");
  if(!card)return;
  const serial=++requestSerial;
  const result=await adminCountClient.from("community_icon_changes").select("community_id").eq("change_type","changed").is("reviewed_at",null);
  if(serial!==requestSerial||result.error)return;
  const count=new Set((result.data||[]).map(x=>x.community_id).filter(Boolean)).size;
  let badge=card.querySelector(".count");
  if(count>0){
   if(!badge){badge=document.createElement("span");badge.className="pill amber count";card.appendChild(badge)}
   badge.textContent="要確認 "+count;
   card.classList.add("attention");
  }else{
   if(badge)badge.remove();
   card.classList.remove("attention");
  }
 }
 function schedule(){clearTimeout(timer);timer=setTimeout(()=>void refresh(),80)}
 function start(){
  const app=document.getElementById("app");
  if(!app)return;
  const observer=new MutationObserver(schedule);
  observer.observe(app,{childList:true,subtree:true});
  schedule();
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});
 else start();
}
window.CACommunityIcon={url,img,bind};
installAdminPendingCommunityCountFix();
installBreakArtifactCleanup();
installAdminIconHistoryFix();
if(/(?:^|\/)stamp-rally\.html$/.test(location.pathname)){
 const s=document.createElement("script");
 s.src="./suzuki-native-flow.js?v=20260924-1836";
 s.async=false;
 s.onload=()=>{
  const c=document.createElement("script");
  c.src="./suzuki-native-cleanup-button.js?v=20260924-1145";
  c.async=false;
  document.head.appendChild(c)
 };
 document.head.appendChild(s)
}
if(/(?:^|\/)stamp-(?:rally|exchange)\.html$/.test(location.pathname)){
 const t=document.createElement("script");
 t.src="./stamp-virtual-test-v5.js?v=20260925-0632";
 t.async=false;
 document.head.appendChild(t)
}
})();