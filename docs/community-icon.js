(function(){
"use strict";
function esc(v){return String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"})[c]);}
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
function installAdminIconHistoryFix(){
 if(!/(?:^|\/)admin\.html$/.test(location.pathname))return;
 const style=document.createElement("style");
 style.id="ca-icon-history-style";
 style.textContent=`
.icon-history-row{display:flex!important;align-items:stretch!important;gap:14px!important;overflow-x:auto!important;padding:4px 2px 12px!important;scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch}
.icon-history-item{min-width:138px!important;padding:12px 10px 10px!important;border:1px solid #e5eed7;border-radius:20px;background:#f8fafc;text-align:center;scroll-snap-align:start}
.icon-history-item .avatar{position:relative!important;width:112px!important;height:112px!important;margin:0 auto 8px!important;border-radius:999px!important;overflow:hidden!important;border:4px solid #fff!important;background:#f7fee7!important;display:grid!important;place-items:center!important;box-shadow:0 8px 22px rgba(77,124,15,.12)!important}
.icon-history-item .avatar img{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;max-width:none!important;object-fit:cover!important;display:block!important}
@media(max-width:820px){.icon-history-item{min-width:146px!important}.icon-history-item .avatar{width:120px!important;height:120px!important}}
`;
 document.head.appendChild(style);
 enhanceAdminIconHistory(document);
 const observer=new MutationObserver(mutations=>{for(const mutation of mutations){for(const node of mutation.addedNodes){if(node.nodeType===1){enhanceAdminIconHistory(node);if(node.matches&&node.matches(".adminmodal"))enhanceAdminIconHistory(document)}}}});
 observer.observe(document.body,{childList:true,subtree:true});
}
window.CACommunityIcon={url,img,bind};
installAdminIconHistoryFix();
if(/(?:^|\/)stamp-rally\.html$/.test(location.pathname)){
 const s=document.createElement("script");s.src="./suzuki-safe-mode.js?v=20260924-0300";s.async=false;document.head.appendChild(s)
}
})();