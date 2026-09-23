(function(){
"use strict";
if(!/(?:^|\/)stamp-rally\.html$/.test(location.pathname))return;

// TEMP: SuzukiPM-only visual sequence. Intentionally contains NO Web Audio API.
const NAME="suzukipm";
const V="20260923-2358";
const EMBLEM=`./suzuki-special/dragon-emblem.jpg?v=${V}`;
const FIRE_VFX=`./suzuki-special/dragon-fire-vfx.mp4?v=${V}`;
let phase="idle",tapCount=0,targetButton=null,bypass=false,root=null,currentScale=.84;
const timers=[];
new Image().src=EMBLEM;

function later(fn,ms){const id=setTimeout(()=>{const i=timers.indexOf(id);if(i>=0)timers.splice(i,1);fn()},ms);timers.push(id);return id}
function clearTimers(){while(timers.length)clearTimeout(timers.pop())}
function muteLegacy(){
 const a=document.getElementById("suzukiHeartbeatAudio");
 if(!a)return;
 try{a.muted=true;a.volume=0;a.pause();a.currentTime=0}catch(_){ }
}
function isSuzuki(button){
 if(!(button instanceof HTMLButtonElement))return false;
 const raw=button.textContent||"";
 if(!raw.toLowerCase().includes(NAME))return false;
 if(button.matches("button.stamp[data-community]"))return true;
 return /SuzukiPM/i.test(raw);
}
function ensureRoot(){
 if(root&&document.body.contains(root))return root;
 const st=document.createElement("style");
 st.id="suzuki-silent-special-style";
 st.textContent=`
#szReal{position:fixed;inset:0;z-index:600;font-family:Arial,"Hiragino Kaku Gothic ProN","Yu Gothic",sans-serif}
#szReal *{box-sizing:border-box}.srB{position:absolute;inset:0;width:100%;height:100%;border:0;padding:0;background:#000;color:#fff;overflow:hidden}.srBg{position:absolute;inset:0;background:radial-gradient(circle,rgba(80,5,3,.28),transparent 47%),radial-gradient(circle,transparent 8%,rgba(0,0,0,.55) 62%,#000)}.srC{position:absolute;inset:0;display:grid;place-items:center;padding:24px}.srI{width:min(430px,100%);display:flex;flex-direction:column;align-items:center;text-align:center}.srE{width:min(82vw,370px);height:min(82vw,370px);display:grid;place-items:center;transition:transform .28s ease-out,filter .28s ease-out,opacity .28s}.srE img{width:100%;height:100%;object-fit:contain;mix-blend-mode:screen}.srT{margin-top:-8px;transition:opacity .9s}.srL1{font-size:20px;font-weight:700;letter-spacing:.08em;color:#d7c0b9;text-shadow:0 0 20px #871c1288;animation:srTxt .9s ease both}.srL2{margin-top:20px;font-size:14px;line-height:1.95;font-weight:600;letter-spacing:.06em;color:#b89489;animation:srTxt 1.1s ease both}.srHint{margin-top:18px;font-size:12px;font-weight:700;letter-spacing:.08em;color:#85645d;opacity:.72}.srF{position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity .12s}.srF.on{opacity:1}
.srBadge{position:absolute;inset:0;background:rgba(15,23,42,.62);backdrop-filter:blur(7px);padding:20px;overflow:hidden}.srWrap{display:flex;min-height:100%;align-items:flex-start;justify-content:center;padding-top:16px}.srCard{position:relative;width:min(360px,100%);overflow:visible;border:1px solid #ead5bf;border-radius:30px;background:#fffaf4;padding:18px;text-align:center;box-shadow:0 26px 70px #0f172a47;isolation:isolate}.srMedal{width:205px;height:205px;margin:40px auto 0;border-radius:50%;position:relative;overflow:hidden;background:radial-gradient(circle at 40% 30%,#fbfbfb 0 8%,#d7d7d7 24%,#aeb0b0 52%,#e8e8e8 70%,#969797 100%);box-shadow:inset 0 0 0 5px #b8922e,inset 0 0 0 8px #755711,0 15px 35px #271d123d;z-index:3}.srEng{position:absolute;inset:0;z-index:4;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;color:#3a3a3ad1;font-weight:700}.srEng span:first-child{font-size:22px}.srHeat,.srOxide,.srSoot{position:absolute;inset:0;border-radius:50%;pointer-events:none;opacity:0}.srHeat{z-index:2;background:radial-gradient(circle at 28% 58%,#fffbd8 0 5%,#ffd45b 9%,#ff7a18 18%,#b51c0a 34%,transparent 58%),radial-gradient(circle at 70% 35%,#ff9a28 0 7%,#8f160c 28%,transparent 52%);mix-blend-mode:screen}.srOxide{z-index:2;background:conic-gradient(from 18deg at 52% 50%,transparent 0 9%,#b66d2633 14%,#6e347644 20%,#245b7d3d 27%,transparent 36% 54%,#9d5d2533 62%,#55347740 69%,#265a7640 75%,transparent 84%);mix-blend-mode:multiply}.srSoot{z-index:5;background:radial-gradient(circle at 30% 58%,transparent 0 34%,#28181238 52%,#0c08064f 72%,transparent 88%);mix-blend-mode:multiply}.srVfx{position:absolute;pointer-events:none;object-fit:cover;mix-blend-mode:screen;opacity:0;filter:saturate(1.15) contrast(1.08)}.srVfx.back{z-index:1;left:-28%;top:12%;width:156%;height:66%}.srVfx.front{z-index:8;left:-38%;top:3%;width:176%;height:86%;filter:saturate(1.25) contrast(1.12) brightness(1.06)}.srSmoke{position:absolute;z-index:7;inset:-20%;pointer-events:none;opacity:0;background:radial-gradient(ellipse at 50% 45%,#39312c4d,transparent 52%);filter:blur(12px)}.srSpark{position:absolute;z-index:9;width:4px;height:4px;border-radius:50%;background:#ffd76b;box-shadow:0 0 8px #ff7b22;opacity:0}.srHaze{position:absolute;z-index:6;inset:10% 15%;border-radius:45%;opacity:0;backdrop-filter:blur(1.2px)}
@keyframes srTxt{from{opacity:0;transform:translateY(10px);filter:blur(4px)}to{opacity:1;transform:none;filter:none}}@keyframes sh1{25%{transform:translate(2px,2px)}50%{transform:translate(-1px,-2px)}}@keyframes sh2{20%{transform:translate(4px,6px)}40%{transform:translate(-4px,-4px)}70%{transform:translate(3px,-5px)}}@keyframes sh3{12%{transform:translate(8px,10px)}24%{transform:translate(-8px,-7px)}48%{transform:translate(-6px,8px)}72%{transform:translate(-4px,5px)}}`;
 document.head.appendChild(st);
 root=document.createElement("div");root.id="szReal";root.style.display="none";document.body.appendChild(root);return root;
}
function dragon(s,b,o,g){if(!root)return;const e=root.querySelector(".srE");if(e){e.style.transform=`scale(${s})`;e.style.opacity=o;e.style.filter=`brightness(${b}) drop-shadow(0 0 ${18+g*55}px rgba(170,24,10,${.2+g*.5}))`}}
function flash(type){if(!root)return;const f=root.querySelector(".srF");if(!f)return;f.className="srF"+(type?" on":"");f.style.background=type==="white"?"rgba(255,238,215,.88)":type==="dark"?"rgba(68,0,0,.82)":"rgba(174,12,5,.36)"}
function shake(n){if(!root)return;const b=root.firstElementChild||root;b.style.animation="none";void b.offsetWidth;b.style.animation=n?`sh${n} ${n===1?.45:n===2?.55:.9}s ease-out`:"none"}
function ritual(){
 const e=ensureRoot();
 e.style.cssText="display:block;opacity:1;pointer-events:auto";
 e.innerHTML=`<button class="srB" type="button"><div class="srBg"></div><div class="srC"><div class="srI"><div class="srE"><img src="${EMBLEM}" alt=""></div><div class="srT" style="opacity:0"></div></div></div><div class="srF"></div></button>`;
 e.querySelector(".srB").onclick=onTap;dragon(.84,.9,.4,.16);
}
function start(button){
 clearTimers();muteLegacy();phase="heartbeat_intro";tapCount=0;targetButton=button;currentScale=.84;ritual();
 const beats=[.28,1.05,1.84,2.65,3.48];
 beats.forEach((sec,i)=>later(()=>{const q=.95+i*.08;currentScale+=.012;dragon(currentScale+.018*q,1+.25*q,Math.min(.96,.55+i*.1),Math.min(.8,.24+.28*q));later(()=>dragon(currentScale-.006,.92,Math.min(.9,.5+i*.09),.2+i*.04),120)},sec*1000));
 later(()=>dragon(currentScale,.7,.78,.18),4050);
 later(()=>{phase="text_reveal";const t=root.querySelector(".srT");if(t){t.style.opacity=1;t.innerHTML='<div class="srL1">覚者よ、よくきた。</div>'}},4550);
 later(()=>{const t=root&&root.querySelector(".srT");if(t)t.innerHTML+='<div class="srL2">お前の心臓と引き換えに、<br>この紋章を授けよう。</div>'},5950);
 later(()=>{const t=root&&root.querySelector(".srT");if(t)t.style.opacity=0},8150);
 later(()=>{phase="tap_wait";const t=root&&root.querySelector(".srT");if(t){t.style.opacity=1;t.innerHTML='<div class="srHint">画面を3回タップ</div>'}},9050);
}
function onTap(){
 if(phase!=="tap_wait")return;
 tapCount++;
 if(tapCount===1){shake(1);dragon(currentScale*1.008,1.08,.88,.25);return}
 if(tapCount===2){shake(2);dragon(currentScale*1.025,1.25,.94,.48);return}
 if(tapCount===3){phase="roar";shake(3);dragon(currentScale*1.08,1.85,1,1);flash("red");later(()=>flash("dark"),450);later(()=>flash(""),700);later(()=>flash("white"),950);later(()=>{flash("");openBadge()},1250)}
}
function openOriginal(){
 if(!targetButton||!document.contains(targetButton))return;
 muteLegacy();
 bypass=true;targetButton.click();
 muteLegacy();
 later(()=>{const old=document.getElementById("suzukiIntroBack");if(old)old.classList.remove("show");muteLegacy()},0);
}
function openBadge(){
 openOriginal();phase="badge_normal";
 const e=ensureRoot();
 e.innerHTML=`<div class="srBadge"><div class="srWrap"><section class="srCard"><video class="srVfx back" muted playsinline preload="metadata" src="${FIRE_VFX}"></video><div class="srMedal"><div class="srHeat"></div><div class="srOxide"></div><div class="srEng"><span>SuzukiPM</span><span>1st</span><span>Chiba, Japan</span><span>2026.09.22</span></div><div class="srSoot"></div></div><div class="srHaze"></div><video class="srVfx front" muted playsinline preload="metadata" src="${FIRE_VFX}"></video><div class="srSmoke"></div>${Array.from({length:14},(_,i)=>`<i class="srSpark" style="left:${15+(i*47)%75}%;top:${50+(i*31)%28}%;--d:${(i%7)*.08}s;--x:${-70+(i*29)%140}px"></i>`).join("")}<h2 style="margin:18px 0 0;color:#443c35">SuzukiPM</h2><div style="margin-top:5px;font-size:12px;font-weight:800;color:#8a7d72">千葉県</div></section></div><div class="srF"></div></div>`;
 later(startFire,2000);
}
function startFire(){
 phase="fire";muteLegacy();
 const c=root&&root.querySelector(".srCard");if(c)c.classList.add("forge");
 root&&root.querySelectorAll(".srVfx").forEach((v,i)=>{try{v.muted=true;v.volume=0;v.currentTime=i?.08:0;v.playbackRate=1.15;v.play().catch(()=>{})}catch(_){}});
 later(()=>{phase="burned"},3200);
 later(()=>{if(!root)return;root.querySelectorAll(".srVfx").forEach(v=>{try{v.pause()}catch(_){}});root.style.transition="opacity .85s ease";root.style.opacity=0;root.style.pointerEvents="none"},4100);
 later(()=>{if(!root)return;root.style.cssText="display:none;opacity:1";phase="idle";tapCount=0;targetButton=null;muteLegacy()},5000);
}
function capture(ev){
 if(bypass){bypass=false;return}
 if(phase!=="idle")return;
 const t=ev.target;if(!(t instanceof Element)||t.closest("#szReal"))return;
 const b=t.closest("button");if(!isSuzuki(b))return;
 ev.preventDefault();ev.stopPropagation();ev.stopImmediatePropagation();start(b);
}
document.addEventListener("click",capture,true);
window.CASuzukiSpecial={version:"silent-visual-only-20260923-2358",reset(){clearTimers();phase="idle";tapCount=0;targetButton=null;muteLegacy();if(root){root.querySelectorAll("video").forEach(v=>{try{v.pause();v.currentTime=0}catch(_){}});root.style.cssText="display:none;opacity:1"}}};
})();