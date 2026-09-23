(function(){
"use strict";
if(!/(?:^|\/)stamp-rally\.html$/.test(location.pathname))return;

// TEMP SuzukiPM-only brush pass on the native medal.
// Visual motion only. Soot/heat/shine changes come in later steps.
let running=false;
let fx=null;
let finishTimer=null;

const style=document.createElement("style");
style.id="suzuki-native-brush-style";
style.textContent=`
#stamp3d,#stampZoom2D{position:relative}
.szNativeBrushFx{position:absolute;inset:0;z-index:999;pointer-events:none;overflow:visible}
.szNativeBrush{position:absolute;left:50%;top:50%;width:112px;height:38px;opacity:0;transform:translate(-195px,-50%) rotate(-10deg);transform-origin:58% 50%;filter:drop-shadow(0 4px 5px rgba(0,0,0,.28))}
.szNativeBrush:before{content:"";position:absolute;left:34px;top:1px;width:78px;height:12px;border-radius:9px;background:linear-gradient(180deg,#a9794f,#6c4327 58%,#4b2e1c);box-shadow:inset 0 2px rgba(255,255,255,.23)}
.szNativeBrush:after{content:"";position:absolute;left:0;top:11px;width:54px;height:27px;border-radius:9px 9px 6px 6px;background:repeating-linear-gradient(90deg,#665442 0 3px,#ccb99f 3px 6px);box-shadow:inset 0 3px rgba(255,255,255,.16)}
.szNativeBrushFx.run .szNativeBrush{opacity:1;animation:szNativeBrushScrub 2.35s cubic-bezier(.42,.02,.58,.98) both}
@keyframes szNativeBrushScrub{
 0%{transform:translate(-195px,-50%) rotate(-10deg)}
 14%{transform:translate(55px,-44%) rotate(9deg)}
 28%{transform:translate(-165px,-35%) rotate(-8deg)}
 42%{transform:translate(50px,-24%) rotate(8deg)}
 56%{transform:translate(-145px,-14%) rotate(-7deg)}
 70%{transform:translate(42px,-3%) rotate(7deg)}
 84%{transform:translate(-110px,8%) rotate(-5deg)}
 100%{opacity:0;transform:translate(92px,16%) rotate(9deg)}
}
`;
document.head.appendChild(style);

function cleanupFx(){
 if(finishTimer){clearTimeout(finishTimer);finishTimer=null}
 if(fx){fx.remove();fx=null}
 running=false;
 const button=document.querySelector(".szNativeCleanupBtn");
 if(button)button.disabled=false;
}

function visibleMedalHost(){
 const stamp3d=document.getElementById("stamp3d");
 const stamp2d=document.getElementById("stampZoom2D");
 if(stamp3d&&stamp3d.offsetWidth>0&&stamp3d.offsetHeight>0)return stamp3d;
 if(stamp2d&&stamp2d.offsetWidth>0&&stamp2d.offsetHeight>0)return stamp2d;
 return stamp3d||stamp2d||null;
}

function runBrush(){
 if(running)return false;
 const modal=document.getElementById("stampModalBack");
 if(!modal||!modal.classList.contains("show"))return false;
 const host=visibleMedalHost();
 const button=document.querySelector(".szNativeCleanupBtn");
 if(!host||!button)return false;
 running=true;
 button.disabled=true;
 fx=document.createElement("div");
 fx.className="szNativeBrushFx";
 fx.innerHTML='<div class="szNativeBrush" aria-hidden="true"></div>';
 host.appendChild(fx);
 void fx.offsetWidth;
 requestAnimationFrame(()=>requestAnimationFrame(()=>{if(fx)fx.classList.add("run")}));
 finishTimer=setTimeout(()=>{
  finishTimer=null;
  cleanupFx();
  window.dispatchEvent(new CustomEvent("ca:suzuki-brush-finished",{detail:{trainer_name:"SuzukiPM"}}));
 },2500);
 return true;
}

window.addEventListener("ca:suzuki-cleanup-requested",runBrush);
window.addEventListener("pagehide",cleanupFx);
const closeButton=document.getElementById("stampClose");
if(closeButton)closeButton.addEventListener("click",cleanupFx,true);

window.CASuzukiNativeBrush={version:"brush-direct-20260924-0728",get running(){return running},run:runBrush,reset:cleanupFx};
})();
