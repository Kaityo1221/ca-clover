(function(){
"use strict";
if(!/(?:^|\/)stamp-rally\.html$/.test(location.pathname))return;
// TEMP diagnostic safe mode: no Suzuki ritual, audio, fire or cleanup.
const style=document.createElement("style");
style.textContent="#suzukiIntroBack{display:none!important}";
document.head.appendChild(style);
function muteLegacy(){
 const a=document.getElementById("suzukiHeartbeatAudio");
 if(!a)return;
 try{a.muted=true;a.volume=0;a.pause();a.currentTime=0}catch(_){ }
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",muteLegacy,{once:true});
else muteLegacy();
document.addEventListener("click",()=>setTimeout(muteLegacy,0),true);
window.CASuzukiSafeMode={version:"safe-mode-20260924-0006"};
})();
