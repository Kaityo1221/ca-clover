(function(){
"use strict";
if(!/(?:^|\/)stamp-rally\.html$/.test(location.pathname))return;

// TEMP SuzukiPM-only native medal cleanup.
// The native medal renderer owns the burned/clean visual. This file only
// owns SuzukiPM's one-modal state machine, brush FX, and cleanup lifecycle.
let cleanupRow=null;
let running=false;
let brushOverlay=null;
let brushAnimation=null;
let finishTimer=null;
let rerenderTimeout=null;
let startRaf1=0;
let startRaf2=0;
let lastActivateAt=0;
let waitingForCleanRender=false;

const style=document.createElement("style");
style.id="suzuki-native-cleanup-button-style";
style.textContent=`
.szNativeCleanupRow{display:flex;justify-content:center;margin:14px 0 2px}
.szNativeCleanupBtn{border:1px solid #c8a96a;background:#fffaf0;color:#5a4528;border-radius:999px;padding:10px 18px;font-weight:900;font-size:14px;box-shadow:0 7px 18px rgba(60,43,23,.18);-webkit-tap-highlight-color:transparent;touch-action:manipulation}
.szNativeCleanupBtn:active{transform:scale(.98)}
.szNativeCleanupBtn:disabled{opacity:.52}
.szNativeCleanupBtn.szDone{border-color:#b7cda9;background:#f3f8ef;color:#587747;opacity:1}
.szNativeCleanupBtn.szFail{border-color:#d9b7a9;background:#fff7f3;color:#9a5f49;opacity:1}
.szNativeBrushOverlay{position:fixed;z-index:9999;pointer-events:none;overflow:visible}
.szNativeBrush{position:absolute;left:50%;top:50%;width:112px;height:38px;opacity:1;transform:translate(-195px,-50%) rotate(-10deg);transform-origin:58% 50%;filter:drop-shadow(0 4px 5px rgba(0,0,0,.28))}
.szNativeBrush:before{content:"";position:absolute;left:34px;top:1px;width:78px;height:12px;border-radius:9px;background:linear-gradient(180deg,#a9794f,#6c4327 58%,#4b2e1c);box-shadow:inset 0 2px rgba(255,255,255,.23)}
.szNativeBrush:after{content:"";position:absolute;left:0;top:11px;width:54px;height:27px;border-radius:9px 9px 6px 6px;background:repeating-linear-gradient(90deg,#665442 0 3px,#ccb99f 3px 6px);box-shadow:inset 0 3px rgba(255,255,255,.16)}
`;
document.head.appendChild(style);

function modal(){return document.getElementById("stampModalBack")}
function area(){return document.getElementById("stampZoomArea")}
function controls(){return document.getElementById("stampDesignControls")}
function closeButton(){return document.getElementById("stampClose")}
function medalState(){return window.CASuzukiMedalState||null}
function setPhase(phase){window.CASuzukiMedalState={trainer_name:"SuzukiPM",phase}}
function resetPhase(){if(window.CASuzukiMedalState)window.CASuzukiMedalState.phase="idle"}

function cleanupSuzukiCleanupFx(options){
 const opts=options||{};
 if(finishTimer){clearTimeout(finishTimer);finishTimer=null}
 if(rerenderTimeout){clearTimeout(rerenderTimeout);rerenderTimeout=null}
 if(startRaf1){cancelAnimationFrame(startRaf1);startRaf1=0}
 if(startRaf2){cancelAnimationFrame(startRaf2);startRaf2=0}
 if(brushAnimation){try{brushAnimation.cancel()}catch(_){}brushAnimation=null}
 if(brushOverlay){brushOverlay.remove();brushOverlay=null}
 document.querySelectorAll(".szNativeBrushOverlay").forEach(el=>el.remove());
 running=false;
 waitingForCleanRender=false;
 if(!opts.keepButton&&cleanupRow){cleanupRow.remove();cleanupRow=null}
 if(opts.resetState)resetPhase();
}

function isSuzukiDetail(){
 const m=modal(),a=area(),c=controls();
 if(!m||!m.classList.contains("show"))return false;
 const text=((a&&a.textContent)||"")+" "+((c&&c.textContent)||"");
 return /SuzukiPM/i.test(text);
}

function visibleMedalHost(){
 const d3=document.getElementById("stamp3d");
 const d2=document.getElementById("stampZoom2D");
 if(d3){const r=d3.getBoundingClientRect();if(r.width>0&&r.height>0)return d3}
 if(d2){const r=d2.getBoundingClientRect();if(r.width>0&&r.height>0)return d2}
 return null;
}

function positionOverlay(el,host){
 if(!el||!host)return false;
 const r=host.getBoundingClientRect();
 if(!r.width||!r.height)return false;
 el.style.left=r.left+"px";
 el.style.top=r.top+"px";
 el.style.width=r.width+"px";
 el.style.height=r.height+"px";
 return true;
}

function cleanupButton(){return document.querySelector(".szNativeCleanupBtn")}
function markDone(){
 const button=cleanupButton();
 if(!button)return;
 button.disabled=true;
 button.classList.remove("szFail");
 button.classList.add("szDone");
 button.textContent="✨ お掃除完了";
}

function markFailed(){
 const button=cleanupButton();
 if(!button)return;
 button.disabled=false;
 button.classList.remove("szDone");
 button.classList.add("szFail");
 button.textContent="⚠️ もう一度お掃除";
}

function rerenderCleanNativeMedal(){
 setPhase("clean_complete");
 waitingForCleanRender=true;
 const bridge=window.CAStampRallyMedalBridge;
 let started=false;
 try{started=!!(bridge&&typeof bridge.rerenderSuzuki==="function"&&bridge.rerenderSuzuki())}catch(_){started=false}
 if(!started){
  waitingForCleanRender=false;
  setPhase("burned");
  markFailed();
  return;
 }
 rerenderTimeout=setTimeout(()=>{
  rerenderTimeout=null;
  if(!waitingForCleanRender)return;
  waitingForCleanRender=false;
  markFailed();
 },10000);
}

window.addEventListener("ca:stamp-medal-rendered",e=>{
 if(!waitingForCleanRender)return;
 const detail=e.detail||{};
 if(String(detail.trainer_name||"").trim().toLowerCase()!=="suzukipm")return;
 if(detail.suzukiBurned!==false)return;
 waitingForCleanRender=false;
 if(rerenderTimeout){clearTimeout(rerenderTimeout);rerenderTimeout=null}
 markDone();
 window.dispatchEvent(new CustomEvent("ca:suzuki-cleanup-complete",{detail:{trainer_name:"SuzukiPM"}}));
});

function animateBrush(el){
 const frames=[
  {transform:"translate(-195px,-50%) rotate(-10deg)",offset:0},
  {transform:"translate(55px,-44%) rotate(9deg)",offset:.14},
  {transform:"translate(-165px,-35%) rotate(-8deg)",offset:.28},
  {transform:"translate(50px,-24%) rotate(8deg)",offset:.42},
  {transform:"translate(-145px,-14%) rotate(-7deg)",offset:.56},
  {transform:"translate(42px,-3%) rotate(7deg)",offset:.70},
  {transform:"translate(-110px,8%) rotate(-5deg)",offset:.84},
  {transform:"translate(92px,16%) rotate(9deg)",opacity:0,offset:1}
 ];
 let finished=false;
 const finish=()=>{
  if(finished)return;
  finished=true;
  brushAnimation=null;
  cleanupSuzukiCleanupFx({keepButton:true});
  rerenderCleanNativeMedal();
  window.dispatchEvent(new CustomEvent("ca:suzuki-brush-finished",{detail:{trainer_name:"SuzukiPM"}}));
 };
 try{
  brushAnimation=el.animate(frames,{duration:2350,easing:"cubic-bezier(.42,.02,.58,.98)",fill:"forwards"});
  brushAnimation.onfinish=finish;
  finishTimer=setTimeout(finish,2550);
 }catch(_){
  el.style.transition="transform 2.2s ease,opacity .3s ease 2s";
  startRaf1=requestAnimationFrame(()=>{
   startRaf1=0;
   el.style.transform="translate(92px,16%) rotate(9deg)";
   el.style.opacity="0";
  });
  finishTimer=setTimeout(finish,2400);
 }
}

function runBrush(){
 if(running||medalState()?.phase==="cleaning"||medalState()?.phase==="clean_complete")return false;
 const m=modal();
 const host=visibleMedalHost();
 const button=cleanupButton();
 if(!m||!m.classList.contains("show")||!host||!button||!isSuzukiDetail())return false;
 cleanupSuzukiCleanupFx({keepButton:true});
 setPhase("cleaning");
 running=true;
 button.disabled=true;
 button.classList.remove("szDone","szFail");
 button.textContent="🧹 お掃除中…";
 brushOverlay=document.createElement("div");
 brushOverlay.className="szNativeBrushOverlay";
 positionOverlay(brushOverlay,host);
 brushOverlay.innerHTML='<div class="szNativeBrush" aria-hidden="true"></div>';
 document.body.appendChild(brushOverlay);
 const brush=brushOverlay.querySelector(".szNativeBrush");
 startRaf1=requestAnimationFrame(()=>{
  startRaf1=0;
  startRaf2=requestAnimationFrame(()=>{
   startRaf2=0;
   if(brush&&document.contains(brush))animateBrush(brush);
  });
 });
 return true;
}

function activate(e){
 const now=Date.now();
 if(now-lastActivateAt<450)return;
 lastActivateAt=now;
 if(e){e.preventDefault();e.stopPropagation()}
 runBrush();
}

function insertButton(){
 const m=modal(),c=controls();
 if(medalState()?.phase!=="burned"||!m||!c||!isSuzukiDetail())return false;
 if(cleanupRow&&document.contains(cleanupRow))return true;
 cleanupRow=document.createElement("div");
 cleanupRow.className="szNativeCleanupRow";
 cleanupRow.innerHTML='<button type="button" class="szNativeCleanupBtn">🧹 煤をお掃除</button>';
 c.parentNode.insertBefore(cleanupRow,c);
 const button=cleanupRow.querySelector("button");
 button.addEventListener("pointerup",activate,{passive:false});
 button.addEventListener("click",activate,false);
 return true;
}

function tryInsert(attempt){
 if(insertButton())return;
 if(attempt>=12)return;
 requestAnimationFrame(()=>tryInsert(attempt+1));
}

window.addEventListener("ca:suzuki-burned",()=>{
 cleanupSuzukiCleanupFx({resetState:false});
 setPhase("burned");
 requestAnimationFrame(()=>tryInsert(0));
});

const close=closeButton();
if(close)close.addEventListener("click",()=>cleanupSuzukiCleanupFx({resetState:true}),true);
const m=modal();
if(m)m.addEventListener("click",e=>{if(e.target===m)cleanupSuzukiCleanupFx({resetState:true})},true);
const c=controls();
if(c)c.addEventListener("click",e=>{
 const target=e.target instanceof Element?e.target.closest("[data-modal-ca]"):null;
 if(!target)return;
 if(/SuzukiPM/i.test(target.textContent||""))return;
 cleanupSuzukiCleanupFx({resetState:true});
},true);
window.addEventListener("pagehide",()=>cleanupSuzukiCleanupFx({resetState:true}));

window.CASuzukiNativeCleanup={
 version:"native-burn-cleanup-state-20260924-1135",
 get phase(){return medalState()?.phase||"idle"},
 get running(){return running},
 run:runBrush,
 remove(){cleanupSuzukiCleanupFx({resetState:true})},
 cleanup:cleanupSuzukiCleanupFx
};
})();
