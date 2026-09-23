(function(){
"use strict";
if(!/(?:^|\/)stamp-rally\.html$/.test(location.pathname))return;

// TEMP SuzukiPM-only cleanup entry point.
// Self-contained: no dynamic brush loader, no page-wide MutationObserver.
let cleanupRow=null;
let burnedSession=false;
let running=false;
let brushOverlay=null;
let finishTimer=null;
let lastActivateAt=0;

const style=document.createElement("style");
style.id="suzuki-native-cleanup-button-style";
style.textContent=`
.szNativeCleanupRow{display:flex;justify-content:center;margin:14px 0 2px}
.szNativeCleanupBtn{border:1px solid #c8a96a;background:#fffaf0;color:#5a4528;border-radius:999px;padding:10px 18px;font-weight:900;font-size:14px;box-shadow:0 7px 18px rgba(60,43,23,.18);-webkit-tap-highlight-color:transparent;touch-action:manipulation}
.szNativeCleanupBtn:active{transform:scale(.98)}
.szNativeCleanupBtn:disabled{opacity:.5}
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

function clearBrush(){
 if(finishTimer){clearTimeout(finishTimer);finishTimer=null}
 if(brushOverlay){brushOverlay.remove();brushOverlay=null}
 running=false;
 const button=document.querySelector(".szNativeCleanupBtn");
 if(button){button.disabled=false;button.textContent="🧹 煤をお掃除"}
}

function removeButton(){
 clearBrush();
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
 if(d3&&d3.getBoundingClientRect().width>0&&d3.getBoundingClientRect().height>0)return d3;
 if(d2&&d2.getBoundingClientRect().width>0&&d2.getBoundingClientRect().height>0)return d2;
 return null;
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
 try{
  const a=el.animate(frames,{duration:2350,easing:"cubic-bezier(.42,.02,.58,.98)",fill:"forwards"});
  a.onfinish=()=>{clearBrush();window.dispatchEvent(new CustomEvent("ca:suzuki-brush-finished",{detail:{trainer_name:"SuzukiPM"}}))};
  finishTimer=setTimeout(()=>{if(running){clearBrush();window.dispatchEvent(new CustomEvent("ca:suzuki-brush-finished",{detail:{trainer_name:"SuzukiPM"}}))}},2550);
 }catch(_){
  el.style.transition="transform 2.2s ease,opacity .3s ease 2s";
  requestAnimationFrame(()=>{el.style.transform="translate(92px,16%) rotate(9deg)";el.style.opacity="0"});
  finishTimer=setTimeout(()=>{clearBrush();window.dispatchEvent(new CustomEvent("ca:suzuki-brush-finished",{detail:{trainer_name:"SuzukiPM"}}))},2400);
 }
}

function runBrush(){
 if(running)return true;
 const m=modal();
 const host=visibleMedalHost();
 const button=document.querySelector(".szNativeCleanupBtn");
 if(!m||!m.classList.contains("show")||!host||!button)return false;
 const r=host.getBoundingClientRect();
 running=true;
 button.disabled=true;
 button.textContent="🧹 お掃除中…";
 brushOverlay=document.createElement("div");
 brushOverlay.className="szNativeBrushOverlay";
 brushOverlay.style.left=r.left+"px";
 brushOverlay.style.top=r.top+"px";
 brushOverlay.style.width=r.width+"px";
 brushOverlay.style.height=r.height+"px";
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
 version:"self-contained-brush-20260924-0732",
 get armed(){return burnedSession},
 get running(){return running},
 run:runBrush,
 remove:removeButton
};
})();
