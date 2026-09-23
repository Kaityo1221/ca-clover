(function(){
"use strict";
function esc(v){
  return String(v==null?"":v).replace(/[&<>"']/g,c=>({
    "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
  })[c]);
}
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
  const extra=attrs||"";
  return '<img data-ca-community-icon="1" data-original="'+esc(original)+'" src="'+esc(src)+'" '+extra+'>';
}
function bind(root){
  const scope=root||document;
  scope.querySelectorAll('img[data-ca-community-icon="1"]').forEach(image=>{
    if(image.dataset.caBound==="1")return;
    image.dataset.caBound="1";
    image.addEventListener("error",()=>{
      const original=image.dataset.original||"";
      if(original&&image.dataset.caOriginalTried!=="1"&&image.src!==original){
        image.dataset.caOriginalTried="1";
        image.src=original;
        return;
      }
      image.style.display="none";
    });
  });
}
window.CACommunityIcon={url,img,bind};
})();

(function(){
"use strict";

if(!/(?:^|\/)stamp-rally\.html$/.test(location.pathname))return;

const SUZUKI_NAME="suzukipm";
const ASSET_BASE="./suzuki-special/";
const EMBLEM_SRC=ASSET_BASE+"金色竜の紋章盾.png";
const FOOTSTEP_SRC=ASSET_BASE+"怪獣の足音.mp3";
const ROAR_SRC=ASSET_BASE+"dragon-studio-epic-dragon-roar-364481.mp3";
const FIRE_SRC=ASSET_BASE+"ドラゴンが火を吐く.mp3";

let phase="idle";
let tapCount=0;
let bypassNext=false;
let targetButton=null;
let root=null;
let currentScale=.84;
let audioContext=null;
let footstepBuffer=null;
let footstepPromise=null;
const timers=[];

function schedule(fn,ms){
 const id=setTimeout(()=>{
  const i=timers.indexOf(id);if(i>=0)timers.splice(i,1);
  fn();
 },ms);
 timers.push(id);
 return id;
}
function clearTimers(){while(timers.length)clearTimeout(timers.pop())}
function ensureAudio(){
 if(audioContext)return audioContext;
 const Ctor=window.AudioContext||window.webkitAudioContext;
 if(!Ctor)return null;
 try{audioContext=new Ctor();audioContext.resume().catch(()=>{});return audioContext}catch(_){return null}
}
function isSuzukiButton(button){
 const raw=button&&button.textContent||"";
 const text=raw.replace(/\s+/g," ").trim();
 if(!text.toLowerCase().includes(SUZUKI_NAME))return false;
 if(/・\s*SuzukiPM/i.test(text))return true;
 const markers=(raw.match(/[●○]/g)||[]).length;
 return markers===1&&/[●○]\s*SuzukiPM/i.test(raw);
}
function makeImpulse(context,seconds,decay){
 const length=Math.max(1,Math.floor(context.sampleRate*seconds));
 const buffer=context.createBuffer(2,length,context.sampleRate);
 for(let channel=0;channel<2;channel++){
  const data=buffer.getChannelData(channel);
  for(let i=0;i<length;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/length,decay);
 }
 return buffer;
}
function heartbeat(){
 const context=ensureAudio();if(!context)return;
 const now=context.currentTime;
 [[0,.22,72],[.11,.12,58]].forEach(([offset,volume,freq])=>{
  const osc=context.createOscillator(),gain=context.createGain();
  osc.type="sine";
  osc.frequency.setValueAtTime(freq,now+offset);
  osc.frequency.exponentialRampToValueAtTime(38,now+offset+.16);
  gain.gain.setValueAtTime(.0001,now+offset);
  gain.gain.exponentialRampToValueAtTime(volume,now+offset+.025);
  gain.gain.exponentialRampToValueAtTime(.0001,now+offset+.19);
  osc.connect(gain).connect(context.destination);
  osc.start(now+offset);osc.stop(now+offset+.22);
 });
}
function synthThump(near,volume){
 const context=ensureAudio();if(!context)return;
 const now=context.currentTime,osc=context.createOscillator(),gain=context.createGain(),filter=context.createBiquadFilter();
 osc.type="sine";osc.frequency.setValueAtTime(near?72:52,now);osc.frequency.exponentialRampToValueAtTime(27,now+.42);
 filter.type="lowpass";filter.frequency.value=near?1200:520;
 gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(volume*.42,now+.02);gain.gain.exponentialRampToValueAtTime(.0001,now+.52);
 osc.connect(filter).connect(gain).connect(context.destination);osc.start(now);osc.stop(now+.58);
}
async function loadFootstep(){
 if(footstepBuffer)return footstepBuffer;
 if(footstepPromise)return footstepPromise;
 const context=ensureAudio();if(!context)return null;
 footstepPromise=fetch(FOOTSTEP_SRC).then(r=>{if(!r.ok)throw new Error("missing");return r.arrayBuffer()}).then(b=>context.decodeAudioData(b.slice(0))).then(decoded=>(footstepBuffer=decoded)).catch(()=>null).finally(()=>{footstepPromise=null});
 return footstepPromise;
}
async function footstep(near){
 const context=ensureAudio();if(!context)return;
 const buffer=await loadFootstep();
 const volume=near?.98:.72;
 if(!buffer){synthThump(near,volume);return}
 const source=context.createBufferSource();source.buffer=buffer;
 const low=context.createBiquadFilter();low.type="lowpass";low.frequency.value=near?2600:900;low.Q.value=.7;
 const bass=context.createBiquadFilter();bass.type="lowshelf";bass.frequency.value=160;bass.gain.value=near?5:3;
 const dry=context.createGain(),wet=context.createGain(),reverb=context.createConvolver();
 const mix=near?.15:.45;dry.gain.value=volume*(1-mix*.4);wet.gain.value=mix*volume;reverb.buffer=makeImpulse(context,near?.8:1.6,near?3.5:2.1);
 source.connect(low).connect(bass);bass.connect(dry).connect(context.destination);bass.connect(reverb).connect(wet).connect(context.destination);source.start();
}
function synthRoar(){
 const context=ensureAudio();if(!context)return;
 const duration=1.2,buffer=context.createBuffer(1,Math.floor(context.sampleRate*duration),context.sampleRate),data=buffer.getChannelData(0);
 for(let i=0;i<data.length;i++){const t=i/data.length;data[i]=(Math.random()*2-1)*Math.sin(Math.PI*Math.min(1,t*1.5))*Math.pow(1-t,.42)}
 const source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain();source.buffer=buffer;filter.type="bandpass";filter.frequency.value=145;filter.Q.value=.6;gain.gain.value=.62;source.connect(filter).connect(gain).connect(context.destination);source.start();
}
function synthFire(){
 const context=ensureAudio();if(!context)return;
 const duration=3.1,buffer=context.createBuffer(1,Math.floor(context.sampleRate*duration),context.sampleRate),data=buffer.getChannelData(0);
 for(let i=0;i<data.length;i++){const t=i/data.length,envelope=Math.min(1,t*8)*Math.pow(1-t,.26),flutter=.55+.45*Math.sin(i*.011)*Math.sin(i*.0023);data[i]=(Math.random()*2-1)*envelope*flutter}
 const source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain();source.buffer=buffer;filter.type="lowpass";filter.frequency.value=2100;gain.gain.value=.34;source.connect(filter).connect(gain).connect(context.destination);source.start();
}
function simpleAudio(src,fallback){
 try{
  const audio=new Audio(src);audio.volume=1;audio.preload="auto";let used=false;
  const fail=()=>{if(used)return;used=true;fallback()};
  audio.addEventListener("error",fail,{once:true});
  const p=audio.play();if(p&&p.catch)p.catch(fail);
 }catch(_){fallback()}
}
function shieldFallback(){
 return '<svg viewBox="0 0 300 340" aria-hidden="true"><defs><linearGradient id="scg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f8dc78"/><stop offset=".48" stop-color="#b97a20"/><stop offset="1" stop-color="#63300f"/></linearGradient></defs><path d="M150 12 268 52v105c0 79-45 137-118 171C77 294 32 236 32 157V52Z" fill="url(#scg)" stroke="#f3c65f" stroke-width="5"/><path d="M195 75c-30-28-72-18-90 8 25-8 42 3 48 17-41-4-70 18-78 52 19-15 40-18 58-10-30 12-47 39-43 69 19-22 42-31 66-28-11 17-12 37-2 59 6-29 22-46 47-54 13-4 24-13 30-25-18 4-32 1-42-10 24-7 40-22 47-45-17 9-35 11-53 4 11-10 16-23 12-37Z" fill="#351207" opacity=".88"/><circle cx="181" cy="106" r="5" fill="#ff3f23"/></svg>';
}
function ensureRoot(){
 if(root&&document.body.contains(root))return root;
 const style=document.createElement("style");
 style.id="suzuki-special-pages-style";
 style.textContent=`
 #suzukiSpecialPages{position:fixed;inset:0;z-index:400;font-family:Arial,"Hiragino Kaku Gothic ProN","Yu Gothic",sans-serif}
 #suzukiSpecialPages *{box-sizing:border-box}
 .sz-black{position:absolute;inset:0;overflow:hidden;background:#000;color:#fff}
 .sz-bg{position:absolute;inset:0;background:radial-gradient(circle at center,rgba(92,8,6,.28),transparent 46%),radial-gradient(circle at center,transparent 10%,rgba(0,0,0,.45) 58%,rgba(0,0,0,.94) 100%)}
 .sz-center{position:absolute;inset:0;display:grid;place-items:center;padding:24px}.sz-inner{display:flex;width:min(420px,100%);flex-direction:column;align-items:center;text-align:center}
 .sz-emblem{width:min(74vw,330px);height:min(74vw,330px);display:grid;place-items:center;transition:transform .28s ease-out,filter .28s ease-out,opacity .28s ease-out}.sz-emblem img,.sz-emblem svg{width:100%;height:100%;object-fit:contain}
 .sz-text{margin-top:-16px;transition:opacity .9s ease}.sz-line1{font-size:20px;font-weight:650;letter-spacing:.08em;color:#cdb5ad;text-shadow:0 0 18px rgba(120,28,18,.44);animation:szTextIn .9s ease both}.sz-line2{margin-top:20px;font-size:14px;line-height:1.95;font-weight:550;letter-spacing:.06em;color:#ac8b82;text-shadow:0 0 18px rgba(120,28,18,.35);animation:szTextIn 1.1s ease both}
 .sz-badgeback{position:absolute;inset:0;overflow:hidden;background:rgba(15,23,42,.55);backdrop-filter:blur(6px);padding:20px}.sz-badgewrap{display:flex;min-height:100%;align-items:flex-start;justify-content:center;padding-top:16px}.sz-card{position:relative;width:min(360px,100%);overflow:hidden;border:1px solid #ead5bf;border-radius:30px;background:#fffaf4;padding:18px;text-align:center;box-shadow:0 26px 70px rgba(15,23,42,.28)}
 .sz-medalwrap{position:relative;width:224px;height:224px;margin:4px auto 0;display:grid;place-items:center;perspective:800px}.sz-normalmedal{width:205px;height:205px;border-radius:50%;position:relative;overflow:hidden;transform:rotateY(-10deg) rotateX(4deg);background:radial-gradient(circle at 40% 30%,#fbfbfb 0 8%,#d7d7d7 24%,#aeb0b0 52%,#e8e8e8 70%,#969797 100%);box-shadow:inset 0 0 0 5px #b8922e,inset 0 0 0 8px #755711,0 15px 35px rgba(39,29,18,.24);transition:filter .45s ease,opacity .22s ease,transform .45s ease}
 .sz-normalmedal:before{content:"";position:absolute;inset:12px;border-radius:50%;background:repeating-linear-gradient(4deg,rgba(255,255,255,.07) 0 1px,rgba(0,0,0,.025) 1px 2px);mix-blend-mode:multiply}.sz-engrave{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;color:rgba(58,58,58,.82);text-shadow:0 -1px 0 rgba(255,255,255,.45);font-weight:700}.sz-engrave span:nth-child(1){font-size:22px}.sz-engrave span:nth-child(2){font-size:18px}.sz-engrave span:nth-child(3),.sz-engrave span:nth-child(4){font-size:15px;font-weight:600}
 .sz-title{margin:18px 0 0;font-size:20px;color:#443c35}.sz-area{margin:5px 0 0;font-size:12px;font-weight:850;color:#8a7d72}
 .sz-fireback,.sz-firefront{position:absolute;left:-20%;right:-20%;bottom:-20%;height:90%;pointer-events:none;mix-blend-mode:screen;filter:blur(7px);transform-origin:bottom;opacity:0}.sz-fireback{background:radial-gradient(ellipse at 50% 100%,rgba(255,238,146,.95) 0 12%,rgba(255,133,28,.92) 24%,rgba(199,41,13,.72) 48%,rgba(80,9,4,.20) 68%,transparent 74%)}.sz-firefront{background:radial-gradient(ellipse at 48% 100%,rgba(255,250,194,1) 0 10%,rgba(255,181,54,.98) 18%,rgba(244,73,14,.88) 38%,rgba(133,19,5,.50) 58%,transparent 70%);filter:blur(4px)}
 .sz-fire .sz-fireback{animation:szFireBack 2.9s ease-out both}.sz-fire .sz-firefront{animation:szFireFront 2.45s cubic-bezier(.22,.7,.35,1) .18s both}.sz-fire .sz-normalmedal{filter:brightness(1.18) sepia(.2) saturate(1.2)}
 .sz-spark{position:absolute;bottom:16%;width:6px;height:6px;border-radius:50%;background:#ffd26a;box-shadow:0 0 10px rgba(255,105,26,.9);animation:szSpark var(--dur) ease-out var(--delay) infinite}.sz-smoke{position:absolute;bottom:18%;width:92px;height:92px;border-radius:50%;background:rgba(50,36,31,.36);filter:blur(22px);animation:szSmoke var(--dur) ease-out var(--delay) infinite}
 .sz-flash{position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity .12s ease}.sz-flash.on{opacity:1}.sz-shake1{animation:szShake1 .45s ease-out}.sz-shake2{animation:szShake2 .55s ease-out}.sz-shake3{animation:szShake3 .9s ease-out}
 @keyframes szTextIn{from{opacity:0;transform:translateY(10px);filter:blur(4px)}to{opacity:1;transform:translateY(0);filter:blur(0)}}
 @keyframes szShake1{0%,100%{transform:translate(0)}25%{transform:translate(1.5px,2px)}50%{transform:translate(-1px,-1.5px)}75%{transform:translate(1px,-1px)}}@keyframes szShake2{0%,100%{transform:translate(0)}18%{transform:translate(4px,6px)}36%{transform:translate(-4px,-4px)}55%{transform:translate(3px,-5px)}74%{transform:translate(-3px,3px)}}@keyframes szShake3{0%,100%{transform:translate(0)}12%{transform:translate(8px,10px)}24%{transform:translate(-8px,-7px)}36%{transform:translate(7px,-9px)}48%{transform:translate(-6px,8px)}60%{transform:translate(5px,-5px)}72%{transform:translate(-4px,5px)}}
 @keyframes szFireBack{0%{transform:translateY(95%) scale(.9);opacity:0}25%{opacity:.72}60%{transform:translateY(8%) scale(1.15);opacity:.82}100%{transform:translateY(-30%) scale(.96);opacity:0}}@keyframes szFireFront{0%{transform:translateY(105%) scaleX(.8);opacity:0}16%{opacity:.88}45%{transform:translateY(12%) scaleX(1.08);opacity:1}78%{opacity:.72}100%{transform:translateY(-22%) scaleX(.9);opacity:0}}
 @keyframes szSpark{0%{transform:translate3d(0,0,0) scale(.55);opacity:0}18%{opacity:1}100%{transform:translate3d(var(--x),var(--y),0) scale(.05);opacity:0}}@keyframes szSmoke{0%{transform:translateY(16px) scale(.75);opacity:0}25%{opacity:.34}100%{transform:translateY(-95px) scale(1.45);opacity:0}}
 `;
 document.head.appendChild(style);
 root=document.createElement("div");root.id="suzukiSpecialPages";root.style.display="none";document.body.appendChild(root);return root;
}
function setFlash(type){
 if(!root)return;
 const flash=root.querySelector(".sz-flash");if(!flash)return;
 flash.className="sz-flash"+(type?" on":"");
 flash.style.background=type==="white"?"rgba(255,238,215,.92)":type==="darkred"?"rgba(68,0,0,.86)":"rgba(174,12,5,.48)";
 flash.style.mixBlendMode=type==="white"?"screen":"normal";
}
function renderRitual(){
 const el=ensureRoot();el.style.display="block";el.style.opacity="1";el.style.pointerEvents="auto";
 el.innerHTML='<button type="button" class="sz-black" aria-label="SuzukiPM special ritual"><div class="sz-bg"></div><div class="sz-center"><div class="sz-inner"><div class="sz-emblem"><img src="'+EMBLEM_SRC+'" alt=""></div><div class="sz-text" style="opacity:0"></div></div></div><div class="sz-flash"></div></button>';
 const img=el.querySelector(".sz-emblem img");img.onerror=()=>{img.parentElement.innerHTML=shieldFallback()};
 el.querySelector(".sz-black").addEventListener("click",()=>onTap());
 updateDragon(.84,.55,0,.08);
}
function updateDragon(scale,brightness,opacity,glow){
 if(!root)return;const emblem=root.querySelector(".sz-emblem");if(!emblem)return;
 emblem.style.transform=`scale(${scale})`;emblem.style.opacity=String(opacity);emblem.style.filter=`brightness(${brightness}) drop-shadow(0 0 ${18+glow*54}px rgba(164,20,10,${.18+glow*.45}))`;
}
function setShake(level){
 if(!root)return;const node=root.firstElementChild||root;node.classList.remove("sz-shake1","sz-shake2","sz-shake3");void node.offsetWidth;if(level)node.classList.add("sz-shake"+level)
}
function startSequence(button){
 clearTimers();phase="heartbeat_intro";tapCount=0;targetButton=button;currentScale=.84;ensureAudio();renderRitual();
 schedule(()=>updateDragon(.84,.55,.16,.08),160);
 [300,1080,1870,2680,3510].forEach((offset,index)=>schedule(()=>{
  const strength=.9+index*.08;currentScale+=.012;heartbeat();updateDragon(currentScale+.018*strength,1+.25*strength,Math.min(.78,.26+index*.12),Math.min(.72,.2+.35*strength));
  schedule(()=>updateDragon(currentScale-.006,.9,Math.min(.72,.24+index*.11),.18+index*.045),110);
 },offset));
 schedule(()=>updateDragon(currentScale,.55,.7,.12),4050);
 schedule(()=>{phase="text_reveal";const text=root.querySelector(".sz-text");text.style.opacity="1";text.innerHTML='<div class="sz-line1">覚者よ、よくきた。</div>'},4550);
 schedule(()=>{const text=root.querySelector(".sz-text");text.innerHTML+='<div class="sz-line2">お前の心臓と引き換えに、<br>この紋章を授けよう。</div>'},5950);
 schedule(()=>{const text=root.querySelector(".sz-text");text.style.opacity="0"},8150);
 schedule(()=>{phase="tap_wait";const text=root.querySelector(".sz-text");text.innerHTML=""},9050);
}
function onTap(){
 if(phase!=="tap_wait")return;
 tapCount++;
 if(tapCount===1){footstep(false);setShake(1);updateDragon(currentScale*1.008,1.05,.72,.2);schedule(()=>setShake(0),450);return}
 if(tapCount===2){footstep(true);setShake(2);updateDragon(currentScale*1.025,1.18,.78,.4);schedule(()=>setShake(0),550);return}
 if(tapCount===3)roarTransition();
}
function roarTransition(){
 phase="roar";simpleAudio(ROAR_SRC,synthRoar);setShake(3);updateDragon(currentScale*1.08,1.75,1,.95);setFlash("red");
 schedule(()=>setFlash("darkred"),450);schedule(()=>setFlash(""),700);schedule(()=>setShake(0),900);schedule(()=>setFlash("white"),950);
 schedule(()=>{setFlash("");openBadgeNormal()},1250);
}
function openOriginal(){
 if(!targetButton||!document.contains(targetButton))return;
 bypassNext=true;targetButton.click();
}
function renderBadgeNormal(){
 const el=ensureRoot();el.style.display="block";el.style.opacity="1";el.style.pointerEvents="auto";
 const sparks=Array.from({length:22},(_,i)=>'<i class="sz-spark" style="left:'+(12+(i*37)%78)+'%;--x:'+(((i%7)-3)*16)+'px;--y:'+(-(90+(i*31)%170))+'px;--dur:'+(720+(i%5)*130)+'ms;--delay:'+(120+(i%8)*95)+'ms"></i>').join("");
 const smoke=Array.from({length:6},(_,i)=>'<i class="sz-smoke" style="left:'+(8+i*16)+'%;--dur:'+(1800+i*130)+'ms;--delay:'+(650+i*110)+'ms"></i>').join("");
 el.innerHTML='<div class="sz-badgeback"><div class="sz-badgewrap"><section class="sz-card"><div style="height:36px"></div><div class="sz-medalwrap"><div class="sz-normalmedal"><div class="sz-engrave"><span>SuzukiPM</span><span>1st</span><span>Chiba, Japan</span><span>2026.09.22</span></div></div></div><h2 class="sz-title">SuzukiPM</h2><div class="sz-area">千葉県</div><div class="sz-fireback"></div><div class="sz-firefront"></div>'+sparks+smoke+'</section></div><div class="sz-flash"></div></div>';
}
function openBadgeNormal(){
 openOriginal();phase="badge_normal";renderBadgeNormal();schedule(startFire,2000);
}
function startFire(){
 phase="fire";simpleAudio(FIRE_SRC,synthFire);const card=root.querySelector(".sz-card");card.classList.add("sz-fire");
 schedule(()=>setFlash("red"),720);schedule(()=>setFlash("white"),1120);schedule(()=>setFlash(""),1260);
 schedule(()=>{const medal=root.querySelector(".sz-normalmedal");if(medal)medal.style.filter="brightness(1.28) sepia(.48) saturate(1.8)"},1500);
 schedule(()=>{const medal=root.querySelector(".sz-normalmedal");if(medal){medal.style.filter="brightness(.9) sepia(.65) saturate(1.5) contrast(1.12)";medal.style.opacity=".92"}},2300);
 schedule(()=>{phase="burned";setFlash("white")},2700);
 schedule(()=>{setFlash("");if(root){root.style.transition="opacity .85s ease";root.style.opacity="0";root.style.pointerEvents="none"}},3300);
 schedule(()=>{if(root){root.style.display="none";root.style.opacity="1";root.style.transition=""}phase="idle";tapCount=0;targetButton=null},4200);
}
function capture(event){
 if(bypassNext){bypassNext=false;return}
 if(phase!=="idle")return;
 const target=event.target;if(!(target instanceof Element))return;
 if(target.closest("#suzukiSpecialPages"))return;
 const button=target.closest("button");if(!(button instanceof HTMLButtonElement)||!isSuzukiButton(button))return;
 event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();startSequence(button);
}
function init(){document.addEventListener("click",capture,true)}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();