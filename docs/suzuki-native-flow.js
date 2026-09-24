(function(){
"use strict";
if(!/(?:^|\/)stamp-rally\.html$/.test(location.pathname))return;
const NAME="suzukipm";
const EMBLEM="./suzuki-special/dragon-emblem.jpg?v=20260924-1256";
const FIRE_VFX="./suzuki-special/dragon-fire-vfx.mp4?v=20260924-1727";
const FOOTSTEP="./suzuki-special/monster-footstep.mp3?v=20260924-1748";
const ROAR="./suzuki-special/dragon-roar.mp3?v=20260924-1803";
const FIRE_AUDIO="./suzuki-special/dragon-fire.mp3?v=20260924-1810";
let phase="idle",tapCount=0,root=null,targetButton=null,bypass=false,timers=[],footstepAudio=null;
let audioCtx=null,roarBuffer=null,roarBufferPromise=null,roarSource=null,fireBuffer=null,fireBufferPromise=null,fireSource=null;
function later(fn,ms){const id=setTimeout(()=>{timers=timers.filter(x=>x!==id);fn()},ms);timers.push(id);return id}
function clearTimers(){timers.forEach(clearTimeout);timers=[]}
function isSuzukiButton(b){
 if(!(b instanceof HTMLButtonElement)||!b.matches("button.stamp[data-community]"))return false;
 return Array.from(b.querySelectorAll(".caname")).some(el=>{
  const text=String(el.textContent||"").replace(/^[●○]\s*/,"").trim().toLowerCase();
  return text===NAME;
 });
}
function muteLegacy(){const a=document.getElementById("suzukiHeartbeatAudio");if(!a)return;try{a.muted=true;a.volume=0;a.pause();a.currentTime=0}catch(_){}}
function stopVisualMedia(){
 if(!root)return;
 root.querySelectorAll("video").forEach(video=>{
  try{video.pause();video.removeAttribute("src");video.load()}catch(_){}
 });
}
function prepareFootstep(){
 if(footstepAudio)return footstepAudio;
 try{const audio=new Audio();audio.preload="auto";audio.src=FOOTSTEP;audio.load();footstepAudio=audio}catch(_){}
 return footstepAudio;
}
function playFootstep(near){
 const audio=prepareFootstep();if(!audio)return;
 try{audio.pause();audio.currentTime=0;audio.volume=near?.92:.52;audio.playbackRate=near?1:.92;const p=audio.play();if(p&&p.catch)p.catch(()=>{})}catch(_){}
}
function stopFootstep(){
 if(!footstepAudio)return;
 try{footstepAudio.pause();footstepAudio.currentTime=0;footstepAudio.removeAttribute("src");footstepAudio.load()}catch(_){}
 footstepAudio=null;
}
function ensureAudioContext(userGesture){
 try{
  const C=window.AudioContext||window.webkitAudioContext;if(!C)return null;
  if(!audioCtx||audioCtx.state==="closed")audioCtx=new C();
  if(audioCtx.state==="suspended"){try{const p=audioCtx.resume();if(p&&p.catch)p.catch(()=>{})}catch(_){}}
  if(userGesture){
   try{const now=audioCtx.currentTime,osc=audioCtx.createOscillator(),gain=audioCtx.createGain();gain.gain.setValueAtTime(.00001,now);osc.connect(gain).connect(audioCtx.destination);osc.start(now);osc.stop(now+.025)}catch(_){}
  }
  return audioCtx;
 }catch(_){return null}
}
function decodeBuffer(url,kind){
 const ctx=ensureAudioContext(false);if(!ctx)return Promise.resolve(null);
 return fetch(url,{cache:"force-cache"})
  .then(r=>{if(!r.ok)throw new Error(kind+" fetch "+r.status);return r.arrayBuffer()})
  .then(buf=>new Promise((resolve,reject)=>{
   try{const p=ctx.decodeAudioData(buf.slice(0));if(p&&typeof p.then==="function")p.then(resolve,reject);else ctx.decodeAudioData(buf,resolve,reject)}catch(err){reject(err)}
  }));
}
function prepareRoarBuffer(){
 if(roarBuffer)return Promise.resolve(roarBuffer);
 if(roarBufferPromise)return roarBufferPromise;
 roarBufferPromise=decodeBuffer(ROAR,"roar").then(decoded=>{roarBuffer=decoded;return decoded}).catch(()=>{roarBufferPromise=null;return null});
 return roarBufferPromise;
}
function prepareFireBuffer(){
 if(fireBuffer)return Promise.resolve(fireBuffer);
 if(fireBufferPromise)return fireBufferPromise;
 fireBufferPromise=decodeBuffer(FIRE_AUDIO,"fire").then(decoded=>{fireBuffer=decoded;return decoded}).catch(()=>{fireBufferPromise=null;return null});
 return fireBufferPromise;
}
function playRoarReady(){
 const ctx=ensureAudioContext(true);if(!ctx)return Promise.resolve(false);
 const resumed=ctx.state==="suspended"?Promise.resolve(ctx.resume()).catch(()=>null):Promise.resolve();
 const ready=roarBuffer?Promise.resolve(roarBuffer):prepareRoarBuffer();
 return Promise.all([resumed,ready]).then(([,buffer])=>{
  if(!buffer)return false;
  try{
   if(roarSource){try{roarSource.stop()}catch(_){}roarSource=null}
   const src=ctx.createBufferSource(),gain=ctx.createGain();src.buffer=buffer;gain.gain.value=.98;src.connect(gain).connect(ctx.destination);src.onended=()=>{if(roarSource===src)roarSource=null};roarSource=src;src.start(0);return true
  }catch(_){return false}
 });
}
function stopRoar(){if(roarSource){try{roarSource.stop()}catch(_){}roarSource=null}}
function playFire(){
 const ctx=ensureAudioContext(false);if(!ctx)return;
 if(!fireBuffer){prepareFireBuffer();return}
 try{
  if(fireSource){try{fireSource.stop()}catch(_){}fireSource=null}
  const src=ctx.createBufferSource();
  const body=ctx.createBiquadFilter(),presence=ctx.createBiquadFilter(),cut=ctx.createBiquadFilter(),comp=ctx.createDynamicsCompressor(),gain=ctx.createGain();
  src.buffer=fireBuffer;src.loop=true;
  body.type="lowshelf";body.frequency.value=320;body.gain.value=6;
  presence.type="peaking";presence.frequency.value=900;presence.Q.value=.7;presence.gain.value=3.5;
  cut.type="lowpass";cut.frequency.value=4200;cut.Q.value=.45;
  comp.threshold.value=-22;comp.knee.value=18;comp.ratio.value=3;comp.attack.value=.006;comp.release.value=.18;
  const now=ctx.currentTime;gain.gain.setValueAtTime(.02,now);gain.gain.exponentialRampToValueAtTime(1.35,now+.08);gain.gain.exponentialRampToValueAtTime(1.18,now+.48);
  src.connect(body).connect(presence).connect(cut).connect(comp).connect(gain).connect(ctx.destination);
  src.onended=()=>{if(fireSource===src)fireSource=null};fireSource=src;src.start(0)
 }catch(_){}
}
function stopFire(){if(fireSource){try{fireSource.stop()}catch(_){}fireSource=null}}
function ensure(){
 if(root&&document.body.contains(root))return root;
 const st=document.createElement("style");st.id="sz-native-flow-style";st.textContent=`
#suzukiIntroBack{display:none!important}
#szNative{position:fixed;inset:0;z-index:900;background:#000;color:#fff;font-family:Arial,"Hiragino Kaku Gothic ProN","Yu Gothic",sans-serif;overflow:hidden}
#szNative *{box-sizing:border-box}.szScene{position:absolute;inset:0;display:grid;place-items:center;padding:24px}.szRitual{text-align:center;width:min(390px,100%)}
.szDragon{width:min(76vw,320px);aspect-ratio:1;margin:auto;border-radius:50%;display:grid;place-items:center;overflow:hidden;background:radial-gradient(circle,#72170d55 0 15%,#25080666 45%,transparent 70%);filter:drop-shadow(0 0 28px #a5271677);transition:transform .25s,filter .25s;animation:szPulse 1s ease-in-out infinite}
.szDragonImg{width:100%;height:100%;object-fit:contain;display:block;opacity:0;transition:opacity .3s ease;mix-blend-mode:screen}.szDragonImg.ready{opacity:.96}.szDragonFallback{font-size:118px;line-height:1}
.szText{min-height:105px;margin-top:18px;color:#cbb0a8;font-weight:700;line-height:1.9;letter-spacing:.06em}.szHint{margin-top:14px;color:#9e7770;font-size:12px;font-weight:900}
.szFlash{position:absolute;inset:0;pointer-events:none;opacity:0;background:#fff;transition:opacity .12s}.szFlash.on{opacity:.9}
.szForge{position:absolute;inset:0;overflow:hidden;padding:0;background:#050000}
.szFireVfx{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center center;transform:scale(1.08);opacity:1;mix-blend-mode:screen;filter:saturate(1.32) contrast(1.10) brightness(1.12);pointer-events:none;z-index:1}
.szForgeShade{position:absolute;inset:0;z-index:2;background:radial-gradient(ellipse at center,transparent 18%,rgba(5,0,0,.04) 50%,rgba(0,0,0,.34) 100%);pointer-events:none}
.szForgeCenter{position:relative;z-index:3;text-align:center;pointer-events:none}.szForgeLabel{font-size:24px;font-weight:900;letter-spacing:.08em;color:#fff2e8;text-shadow:0 0 8px rgba(255,116,48,.95),0 0 22px rgba(255,70,12,.75);transition:opacity .16s ease}
.szBrandImpact{position:absolute;inset:0;z-index:6;display:grid;place-items:center;pointer-events:none;animation:szBrandScreen .82s ease-out both}
.szBrandHeat{width:min(74vw,300px);aspect-ratio:1;border-radius:50%;position:relative;background:radial-gradient(circle,#fffbd5 0 7%,#ffd56a 10%,#ff7a1d 22%,rgba(176,27,6,.92) 43%,rgba(65,5,2,.65) 61%,transparent 72%);filter:blur(.2px) drop-shadow(0 0 26px rgba(255,85,20,.95));animation:szBrandPress .82s cubic-bezier(.18,.72,.2,1) both}
.szBrandHeat:before{content:"";position:absolute;inset:9%;border-radius:50%;border:4px solid rgba(255,241,196,.96);box-shadow:0 0 10px #fff4bf,0 0 28px #ff6a18,inset 0 0 18px #ff7422;animation:szBrandRing .82s ease-out both}
.szBrandHeat:after{content:"";position:absolute;inset:28%;border-radius:50%;background:radial-gradient(circle,rgba(28,3,1,.88) 0 38%,rgba(98,14,5,.7) 58%,transparent 72%);box-shadow:0 0 18px rgba(255,116,37,.8) inset}
@keyframes szPulse{50%{transform:scale(1.035);filter:brightness(1.25) drop-shadow(0 0 38px #b72c1988)}}
@keyframes szBrandScreen{0%{background:rgba(255,248,225,.94)}16%{background:rgba(255,111,28,.38)}100%{background:rgba(0,0,0,.18)}}
@keyframes szBrandPress{0%{opacity:0;transform:scale(1.55);filter:brightness(2.2) blur(7px) drop-shadow(0 0 58px #fff0b0)}22%{opacity:1;transform:scale(.92);filter:brightness(1.65) blur(1px) drop-shadow(0 0 42px #ff6f1c)}58%{transform:scale(1.02);filter:brightness(1.08) blur(0) drop-shadow(0 0 24px #b9280c)}100%{opacity:.12;transform:scale(.98);filter:brightness(.7) blur(2px) drop-shadow(0 0 8px #3b0703)}}
@keyframes szBrandRing{0%{opacity:0;transform:scale(.55)}18%{opacity:1;transform:scale(1.08)}55%{opacity:.9;transform:scale(.98)}100%{opacity:.1;transform:scale(.98)}}`;
 document.head.appendChild(st);root=document.createElement("div");root.id="szNative";root.hidden=true;document.body.appendChild(root);return root
}
function bindDragonImage(r){
 const img=r.querySelector(".szDragonImg"),holder=r.querySelector(".szDragon");if(!img||!holder)return;
 const ready=()=>img.classList.add("ready");const failed=()=>{holder.innerHTML='<span class="szDragonFallback" aria-hidden="true">🐉</span>'};
 img.addEventListener("load",ready,{once:true});img.addEventListener("error",failed,{once:true});if(img.complete){if(img.naturalWidth>0)ready();else failed()}
}
function showRitual(){
 phase="heartbeat_intro";tapCount=0;const r=ensure();stopVisualMedia();stopFootstep();stopRoar();stopFire();ensureAudioContext(true);prepareFootstep();prepareRoarBuffer();prepareFireBuffer();r.hidden=false;r.innerHTML=`<div class="szScene"><div class="szRitual"><div class="szDragon"><img class="szDragonImg" src="${EMBLEM}" alt="" decoding="async" fetchpriority="high"></div><div class="szText"></div><div class="szHint"></div></div></div><div class="szFlash"></div>`;bindDragonImage(r);
 later(()=>{if(phase!=="heartbeat_intro")return;phase="text_reveal";const t=r.querySelector(".szText");if(t)t.textContent="覚者よ、よくきた。"},3800);
 later(()=>{const t=r.querySelector(".szText");if(t)t.innerHTML='覚者よ、よくきた。<br>お前の心臓と引き換えに、この紋章を授けよう。'},5200);
 later(()=>{if(phase!=="text_reveal")return;phase="tap_wait";const h=r.querySelector(".szHint");if(h)h.textContent="画面を3回タップ"},7200)
}
function beginRoarGate(){
 phase="roar_wait";later(stopFootstep,80);
 const h=root&&root.querySelector(".szHint");if(h)h.textContent="";
 playRoarReady().then(started=>{
  if(phase!=="roar_wait")return;
  if(!started){phase="tap_wait";tapCount=2;const hint=root&&root.querySelector(".szHint");if(hint)hint.textContent="もう一度タップ";return}
  phase="roar";const f=root&&root.querySelector(".szFlash");if(f){f.classList.add("on");later(()=>f.classList.remove("on"),180)}later(showForge,700)
 });
}
function ritualTap(){
 if(phase!=="tap_wait")return;tapCount++;const d=root&&root.querySelector(".szDragon");if(d){d.style.transform=`scale(${1+tapCount*.035})`;d.style.filter=`brightness(${1+tapCount*.28}) drop-shadow(0 0 ${28+tapCount*13}px #c32b1999)`}
 if(tapCount===1){prepareRoarBuffer();playFootstep(false);return}
 if(tapCount===2){prepareRoarBuffer();playFootstep(true);return}
 beginRoarGate()
}
function showBrandImpact(){
 if(!root||phase!=="fire")return;phase="branding";const label=root.querySelector(".szForgeLabel");if(label)label.style.opacity="0";const forge=root.querySelector(".szForge");if(!forge)return;const impact=document.createElement("div");impact.className="szBrandImpact";impact.innerHTML='<div class="szBrandHeat" aria-hidden="true"></div>';forge.appendChild(impact)
}
function showForge(){
 if(phase!=="roar")return;phase="fire";if(!root)return;stopVisualMedia();playFire();
 root.innerHTML=`<div class="szScene szForge"><video class="szFireVfx" muted playsinline autoplay loop preload="auto" src="${FIRE_VFX}" aria-hidden="true"></video><div class="szForgeShade"></div><div class="szForgeCenter"><div class="szForgeLabel">刻印中...</div></div></div>`;
 const video=root.querySelector(".szFireVfx");if(video){try{video.muted=true;video.defaultMuted=true;video.volume=0;video.playsInline=true;video.loop=true;video.playbackRate=1.0;video.currentTime=0;video.load();const tryPlay=()=>{try{const p=video.play();if(p&&p.catch)p.catch(()=>{})}catch(_){}};video.addEventListener("canplay",tryPlay,{once:true});tryPlay()}catch(_){} }
 later(showBrandImpact,2450);later(openNativeDetail,3400)
}
function openNativeDetail(){
 if(!targetButton||!document.contains(targetButton)){finish();return}
 phase="burned";muteLegacy();stopFootstep();stopRoar();stopFire();stopVisualMedia();if(root){root.hidden=true;root.innerHTML=""}
 bypass=true;const button=targetButton;button.click();later(()=>{muteLegacy();window.dispatchEvent(new CustomEvent("ca:suzuki-burned",{detail:{trainer_name:"SuzukiPM"}}));phase="idle";targetButton=null},0);later(muteLegacy,120)
}
function finish(){clearTimers();stopFootstep();stopRoar();stopFire();stopVisualMedia();phase="idle";tapCount=0;targetButton=null;if(root){root.hidden=true;root.innerHTML=""}muteLegacy()}
function capture(ev){
 if(bypass){bypass=false;return}const t=ev.target;if(!(t instanceof Element))return;if(t.closest("#szNative")){if(phase==="tap_wait"){ev.preventDefault();ritualTap()}return}if(phase!=="idle")return;const b=t.closest("button");if(!isSuzukiButton(b))return;ev.preventDefault();ev.stopPropagation();ev.stopImmediatePropagation();targetButton=b;muteLegacy();showRitual()
}
document.addEventListener("click",capture,true);
document.addEventListener("visibilitychange",()=>{if(document.hidden&&phase!=="idle")finish()});
document.addEventListener("pagehide",()=>{stopRoar();stopFire();try{if(audioCtx&&audioCtx.state!=="closed")audioCtx.suspend()}catch(_){}});
muteLegacy();window.CASuzukiSpecial={version:"native-detail-flow-roar-gated-20260924-1822",get phase(){return phase},reset:finish};
})();