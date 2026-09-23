(function(){
"use strict";
function esc(v){return String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"})[c]);}
function url(client,community){
  if(!community)return"";
  if(community.avatar_thumbnail_path){
    const data=client.storage.from("community-icon-thumbs").getPublicUrl(community.avatar_thumbnail_path).data;
    return data.publicUrl+(community.avatar_last_changed_at?"?v="+encodeURIComponent(community.avatar_last_changed_at):"");
  }
  return community.avatar_url||"";
}
function img(client,community,attrs){
  const src=url(client,community),original=community&&community.avatar_url||"";
  if(!src)return"";
  return '<img data-ca-community-icon="1" data-original="'+esc(original)+'" src="'+esc(src)+'" '+(attrs||"")+'>';
}
function bind(root){
  (root||document).querySelectorAll('img[data-ca-community-icon="1"]').forEach(image=>{
    if(image.dataset.caBound==="1")return;
    image.dataset.caBound="1";
    image.addEventListener("error",()=>{
      const original=image.dataset.original||"";
      if(original&&image.dataset.caOriginalTried!=="1"&&image.src!==original){image.dataset.caOriginalTried="1";image.src=original;return;}
      image.style.display="none";
    });
  });
}
window.CACommunityIcon={url,img,bind};

if(/(?:^|\/)stamp-rally\.html$/.test(location.pathname)){
  const s=document.createElement("script");
  s.src="./suzuki-ios-fix.js?v=20260923-1845";
  s.async=false;
  document.head.appendChild(s);
}
})();
