(function(){
"use strict";
const STYLE_ID="caCommunityMinigamesPlaceholderStyle";
function ensureStyle(){
 if(document.getElementById(STYLE_ID))return;
 const style=document.createElement("style");style.id=STYLE_ID;
 style.textContent=".community-hub-layout{position:relative}.community-hub-layout>.community-minigames-btn{position:absolute;right:0;top:0;z-index:4;min-width:132px;height:46px;border:1px solid #fdba74;border-radius:18px;background:linear-gradient(145deg,#fff7ed,#ffedd5);box-shadow:0 6px 16px rgba(194,65,12,.12);color:#9a3412;font-weight:950;font-size:12px;display:flex;align-items:center;justify-content:center;gap:6px;padding:0 12px;white-space:nowrap}.community-hub-layout>.community-minigames-btn:active{transform:translateY(1px)}.community-minigames-btn .game-icon{font-size:18px;line-height:1}.community-hub-layout>.community-minigames-btn+div .community-hero-row{padding-right:148px}";
 document.head.appendChild(style);
}
function install(){
 if((location.hash||"").indexOf("#community:")!==0)return;
 const hub=document.querySelector(".community-hub-layout");
 if(!hub||hub.querySelector(".community-minigames-btn"))return;
 ensureStyle();
 const button=document.createElement("button");button.type="button";button.className="community-minigames-btn";button.setAttribute("aria-label","ミニゲーム集");
 button.innerHTML='<span class="game-icon">🎮</span><span>ミニゲーム集</span><span aria-hidden="true">›</span>';
 button.addEventListener("click",function(){alert("🎮 ミニゲーム集は準備中です。");});
 hub.insertBefore(button,hub.firstChild);
}
let timer=0;function schedule(){clearTimeout(timer);timer=setTimeout(install,80)}
new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
window.addEventListener("hashchange",schedule);
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",schedule,{once:true});else schedule();
})();