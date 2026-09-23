(function(){
"use strict";
if(!/(?:^|\/)stamp-rally\.html$/.test(location.pathname))return;
const NAME="suzukipm";
let phase="idle",tapCount=0,root=null,targetButton=null,bypass=false,timers=[];
function later(fn,ms){const id=setTimeout(()=>{timers=timers.filter(x=>x!==id);fn()},ms);timers.push(id);return id}
function clearTimers(){timers.forEach(clearTimeout);timers=[]}
function isSuzukiButton(b){return b instanceof HTMLButtonElement&&b.matches("button.stamp[data-community]")&&String(b.textContent||"").toLowerCase().includes(NAME)}
function muteLegacy(){const a=document.getElementById("suzukiHeartbeatAudio");if(!a)return;try{a.muted=true;a.volume=0;a.pause();a.currentTime=0}catch(_){}}
function ensure(){
 if(root&&document.body.contains(root))return root;
 const st=document.createElement("style");st.id="sz-native-flow-style";st.textContent=`
#suzukiIntroBack{display:none!important}
#szNative{position:fixed;inset:0;z-index:900;background:#000;color:#fff;font-family:Arial,"Hiragino Kaku Gothic ProN","Yu Gothic",sans-serif;overflow:hidden}
#szNative *{box-sizing:border-box}.szScene{position:absolute;inset:0;display:grid;place-items:center;padding:24px}.szRitual{text-align:center;width:min(390px,100%)}
.szDragon{width:min(76vw,320px);aspect-ratio:1;margin:auto;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle,#72170d55 0 15%,#25080666 45%,transparent 70%);font-size:118px;filter:drop-shadow(0 0 28px #a5271677);transition:transform .25s,filter .25s;animation:szPulse 1s ease-in-out infinite}
.szText{min-height:105px;margin-top:18px;color:#cbb0a8;font-weight:700;line-height:1.9;letter-spacing:.06em}.szHint{margin-top:14px;color:#9e7770;font-size:12px;font-weight:900}
.szFlash{position:absolute;inset:0;pointer-events:none;opacity:0;background:#fff;transition:opacity .12s}.szFlash.on{opacity:.9}
.szForge{background:radial-gradient(circle at 50% 45%,#6f180b 0,#240705 34%,#050000 72%)}.szFire{font-size:84px;animation:szFire 3.2s ease both}
@keyframes szPulse{50%{transform:scale(1.035);filter:brightness(1.25) drop-shadow(0 0 38px #b72c1988)}}
@keyframes szFire{0%{opacity:0;transform:scale(.5)}25%{opacity:1;transform:scale(1.15)}75%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(1.35)}}`;
 document.head.appendChild(st);root=document.createElement("div");root.id="szNative";root.hidden=true;document.body.appendChild(root);return root
}
function showRitual(){
 phase="heartbeat_intro";tapCount=0;const r=ensure();r.hidden=false;r.innerHTML='<div class="szScene"><div class="szRitual"><div class="szDragon">🐉</div><div class="szText"></div><div class="szHint"></div></div></div><div class="szFlash"></div>';
 later(()=>{if(phase!=="heartbeat_intro")return;phase="text_reveal";const t=r.querySelector(".szText");if(t)t.textContent="覚者よ、よくきた。"},3800);
 later(()=>{const t=r.querySelector(".szText");if(t)t.innerHTML='覚者よ、よくきた。<br>お前の心臓と引き換えに、この紋章を授けよう。'},5200);
 later(()=>{if(phase!=="text_reveal")return;phase="tap_wait";const h=r.querySelector(".szHint");if(h)h.textContent="画面を3回タップ"},7200)
}
function ritualTap(){
 if(phase!=="tap_wait")return;tapCount++;const d=root&&root.querySelector(".szDragon");
 if(d){d.style.transform=`scale(${1+tapCount*.035})`;d.style.filter=`brightness(${1+tapCount*.28}) drop-shadow(0 0 ${28+tapCount*13}px #c32b1999)`}
 if(tapCount<3)return;phase="roar";const f=root.querySelector(".szFlash");if(f){f.classList.add("on");later(()=>f.classList.remove("on"),180)}later(showForge,500)
}
function showForge(){
 phase="fire";root.innerHTML='<div class="szScene szForge"><div style="text-align:center"><div class="szFire">🔥🐉🔥</div><div style="font-weight:900;color:#e9b69e">刻印中...</div></div></div>';
 later(openNativeDetail,3400)
}
function openNativeDetail(){
 if(!targetButton||!document.contains(targetButton)){finish();return}
 phase="burned";muteLegacy();if(root){root.hidden=true;root.innerHTML=""}
 bypass=true;const button=targetButton;button.click();
 later(()=>{muteLegacy();window.dispatchEvent(new CustomEvent("ca:suzuki-burned",{detail:{trainer_name:"SuzukiPM"}}));phase="idle";targetButton=null},0);
 later(muteLegacy,120)
}
function finish(){clearTimers();phase="idle";tapCount=0;targetButton=null;if(root){root.hidden=true;root.innerHTML=""}muteLegacy()}
function capture(ev){
 if(bypass){bypass=false;return}
 const t=ev.target;if(!(t instanceof Element))return;
 if(t.closest("#szNative")){if(phase==="tap_wait"){ev.preventDefault();ritualTap()}return}
 if(phase!=="idle")return;const b=t.closest("button");if(!isSuzukiButton(b))return;
 ev.preventDefault();ev.stopPropagation();ev.stopImmediatePropagation();targetButton=b;muteLegacy();showRitual()
}
document.addEventListener("click",capture,true);
document.addEventListener("visibilitychange",()=>{if(document.hidden&&phase!=="idle")finish()});
muteLegacy();window.CASuzukiSpecial={version:"native-detail-flow-20260924-0705",get phase(){return phase},reset:finish};
})();