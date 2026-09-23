(function(){
"use strict";
if(!/(?:^|\/)stamp-rally\.html$/.test(location.pathname))return;

// TEMP SuzukiPM-only cleanup entry point.
// Event driven only: no page-wide MutationObserver.
const modal=document.getElementById("stampModalBack");
const area=document.getElementById("stampZoomArea");
const controls=document.getElementById("stampDesignControls");
const closeButton=document.getElementById("stampClose");
let cleanupRow=null;
let burnedSession=false;

const style=document.createElement("style");
style.id="suzuki-native-cleanup-button-style";
style.textContent=`
.szNativeCleanupRow{display:flex;justify-content:center;margin:14px 0 2px}
.szNativeCleanupBtn{border:1px solid #c8a96a;background:#fffaf0;color:#5a4528;border-radius:999px;padding:10px 18px;font-weight:900;font-size:14px;box-shadow:0 7px 18px rgba(60,43,23,.18);-webkit-tap-highlight-color:transparent}
.szNativeCleanupBtn:active{transform:scale(.98)}
`;
document.head.appendChild(style);

function removeButton(){
 if(cleanupRow){cleanupRow.remove();cleanupRow=null}
 burnedSession=false;
}

function isSuzukiDetail(){
 if(!modal||!modal.classList.contains("show"))return false;
 const text=((area&&area.textContent)||"")+" "+((controls&&controls.textContent)||"");
 return /SuzukiPM/i.test(text);
}

function insertButton(){
 if(!burnedSession||!modal||!controls||!isSuzukiDetail())return false;
 if(cleanupRow&&document.contains(cleanupRow))return true;
 cleanupRow=document.createElement("div");
 cleanupRow.className="szNativeCleanupRow";
 cleanupRow.innerHTML='<button type="button" class="szNativeCleanupBtn">🧹 煤をお掃除</button>';
 controls.parentNode.insertBefore(cleanupRow,controls);
 cleanupRow.querySelector("button").onclick=e=>{
  e.preventDefault();e.stopPropagation();
  window.dispatchEvent(new CustomEvent("ca:suzuki-cleanup-requested",{detail:{trainer_name:"SuzukiPM"}}));
 };
 return true;
}

function tryInsert(attempt){
 if(insertButton())return;
 if(attempt>=8)return;
 requestAnimationFrame(()=>tryInsert(attempt+1));
}

window.addEventListener("ca:suzuki-burned",()=>{
 burnedSession=true;
 requestAnimationFrame(()=>tryInsert(0));
});

if(closeButton)closeButton.addEventListener("click",removeButton,true);
if(modal)modal.addEventListener("click",e=>{if(e.target===modal)removeButton()},true);
window.addEventListener("pagehide",removeButton);

window.CASuzukiNativeCleanup={
 version:"button-only-20260924-0721",
 get armed(){return burnedSession},
 remove:removeButton
};
})();
