(function(){
"use strict";
if(!/(?:^|\/)stamp-rally\.html$/.test(location.pathname))return;

// TEMP SuzukiPM-only native medal cleanup.
// No fake soot overlay: brush the existing burned 3D medal, then re-render
// the same native medal without the temporary Suzuki scorch texture.
let cleanupRow=null;
let burnedSession=false;
let running=false;
let brushOverlay=null;
let finishTimer=null;
let rerenderTimeout=null;
let lastActivateAt=0;
let originalLowerCase=null;
let lowerCasePatched=false;

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

function restoreSuzukiLowerCase(){
 if(!lowerCasePatched)return;
 if(originalLowerCase)String.prototype.toLowerCase=originalLowerCase;
 originalLowerCase=null;
 lowerCasePatched=false;
}

function patchSuzukiLowerCase(){
 restoreSuzukiLowerCase();
 originalLowerCase=String.prototype.toLowerCase;
 const nativeLower=originalLowerCase;
 String.prototype.toLowerCase=function(){
  const raw=String(this);
  const lowered=nativeLower.call(this);
  if(raw==="SuzukiPM"||lowered==="suzukipm")return "suzukipm-clean";
  return lowered;
 };
 lowerCasePatched=true;
}

function clearBrush(){
 if(finishTimer){clearTimeout(finishTimer);finishTimer=null}
 if(brushOverlay){brushOverlay.remove();brushOverlay=null}
 document.querySelectorAll(".szNativeBrushOverlay").forEach(el=>el.remove());
 running=false;
}

function clearRerender(){
 if(rerenderTimeout){clearTimeout(rerenderTimeout);rerenderTimeout=null}
 restoreSuzukiLowerCase();
}

function removeButton(){
 clearBrush();
 clearRerender();
 if(cleanupRow){cleanupRow.remove();cleanupRow=null}
 burnedSession=false;
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

function markDone(){
 const button=document.querySelector(".szNativeCleanupBtn");
 if(!button)return;
 button.disabled=true;
 button.classList.remove("szFail");
 button.classList.add("szDone");
 button.textContent="✨ お掃除完了";
}

function markFailed(){
 const button=document.querySelector(".szNativeCleanupBtn");
 if(!button)return;
 button.disabled=false;
 button.classList.remove("szDone");
 button.classList.add("szFail");
 button.textContent="⚠️ もう一度お掃除";
}

function rerenderCleanNativeMedal(){
 const c=controls();
 const dir=c&&c.querySelector("[data-design-dir]");
 if(!dir){markFailed();return}

 // With Design 1/1 the native arrows are disabled. Temporarily enable one
 // so its existing onclick handler re-renders the same selected design.
 const oldCanvas=document.querySelector("#stamp3d canvas");
 patchSuzukiLowerCase();
 const wasDisabled=dir.disabled;
 if(wasDisabled)dir.disabled=false;

 try{
  dir.click();
 }catch(_){
  if(document.contains(dir)&&wasDisabled)dir.disabled=true;
  clearRerender();
  markFailed();
  return;
 }

 // renderModal rebuilds the design controls, so the old disabled button is
 // normally detached immediately. Restore it only if it somehow survived.
 if(document.contains(dir)&&wasDisabled)dir.disabled=true;

 const started=performance.now();
 const waitForCanvas=()=>{
  const next=document.querySelector("#stamp3d canvas");
  const loading=document.getElementById("stamp3d")?.textContent?.includes("3Dメダルを準備中");
  if(next&&next!==oldCanvas&&!loading){
   requestAnimationFrame(()=>{
    clearRerender();
    markDone();
    window.dispatchEvent(new CustomEvent("ca:suzuki-cleanup-complete",{detail:{trainer_name:"SuzukiPM"}}));
   });
   return;
  }
  if(performance.now()-started>7000){
   clearRerender();
   markFailed();
   return;
  }
  requestAnimationFrame(waitForCanvas);
 };
 requestAnimationFrame(waitForCanvas);
 rerenderTimeout=setTimeout(()=>{
  clearRerender();
  if(!document.querySelector(".szNativeCleanupBtn.szDone"))markFailed();
 },7500);
}

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
  clearBrush();
  rerenderCleanNativeMedal();
  window.dispatchEvent(new CustomEvent("ca:suzuki-brush-finished",{detail:{trainer_name:"SuzukiPM"}}));
 };
 try{
  const a=el.animate(frames,{duration:2350,easing:"cubic-bezier(.42,.02,.58,.98)",fill:"forwards"});
  a.onfinish=finish;
  finishTimer=setTimeout(finish,2550);
 }catch(_){
  el.style.transition="transform 2.2s ease,opacity .3s ease 2s";
  requestAnimationFrame(()=>{el.style.transform="translate(92px,16%) rotate(9deg)";el.style.opacity="0"});
  finishTimer=setTimeout(finish,2400);
 }
}

function runBrush(){
 if(running)return true;
 const m=modal();
 const host=visibleMedalHost();
 const button=document.querySelector(".szNativeCleanupBtn");
 if(!m||!m.classList.contains("show")||!host||!button)return false;
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
 requestAnimationFrame(()=>requestAnimationFrame(()=>animateBrush(brush)));
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
 if(!burnedSession||!m||!c||!isSuzukiDetail())return false;
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
 burnedSession=true;
 requestAnimationFrame(()=>tryInsert(0));
});

const close=closeButton();
if(close)close.addEventListener("click",removeButton,true);
const m=modal();
if(m)m.addEventListener("click",e=>{if(e.target===m)removeButton()},true);
window.addEventListener("pagehide",removeButton);

window.CASuzukiNativeCleanup={
 version:"native-burn-cleanup-single-design-20260924-0808",
 get armed(){return burnedSession},
 get running(){return running},
 run:runBrush,
 remove:removeButton
};
})();
