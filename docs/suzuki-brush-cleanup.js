(function(){
"use strict";
if(!/(?:^|\/)stamp-rally\.html$/.test(location.pathname))return;
const css=document.createElement("style");
css.textContent=`
#szReal .szCleanBtn{position:absolute;z-index:55;left:50%;bottom:18px;transform:translateX(-50%) translateY(8px);border:1px solid #c8a96a;background:#fffaf0;color:#5a4528;border-radius:999px;padding:9px 16px;font-weight:800;font-size:13px;box-shadow:0 7px 18px #3c2b1730;opacity:0;pointer-events:none;transition:.3s ease;white-space:nowrap}
#szReal.sz-clean-ready .szCleanBtn{opacity:1;pointer-events:auto;transform:translateX(-50%) translateY(0)}
#szReal .szBrush{position:absolute;z-index:54;left:50%;top:124px;width:94px;height:32px;opacity:0;pointer-events:none;transform:translateX(-190px) rotate(-8deg)}
#szReal .szBrush:before{content:"";position:absolute;left:27px;top:0;width:67px;height:11px;border-radius:8px;background:linear-gradient(#8b6038,#5a371f);box-shadow:inset 0 2px #b98a5c}
#szReal .szBrush:after{content:"";position:absolute;left:0;top:9px;width:45px;height:23px;border-radius:8px 8px 5px 5px;background:repeating-linear-gradient(90deg,#8b7359 0 3px,#d2c1a8 3px 5px);box-shadow:0 3px 5px #0003}
#szReal.sz-cleaning .szBrush{opacity:1;animation:szScrub 1.55s cubic-bezier(.45,.05,.55,.95) both}
#szReal.sz-cleaning .srSoot{animation:szWipeSoot 1.55s linear both!important}
#szReal.sz-cleaning .srOxide{animation:szKeepPatina 1.55s ease both!important}
#szReal.sz-cleaning .srMedal{animation:szPolish 1.75s ease both!important}
#szReal .szShine{position:absolute;z-index:53;inset:0;border-radius:50%;pointer-events:none;opacity:0;background:linear-gradient(115deg,transparent 25%,#fff9 45%,#fff 50%,#fff7 55%,transparent 72%);transform:translateX(-130%)}
#szReal.sz-cleaning .szShine{animation:szShine 1.8s 1.1s ease-out both}
#szReal .szSparkle{position:absolute;z-index:56;right:64px;top:94px;font-size:27px;opacity:0;pointer-events:none}
#szReal.sz-cleaning .szSparkle{animation:szSparkle .75s 1.55s ease-out both}
@keyframes szScrub{0%{transform:translateX(-190px) rotate(-8deg)}18%{transform:translateX(55px) rotate(7deg)}36%{transform:translateX(-145px) rotate(-7deg)}54%{transform:translateX(48px) rotate(6deg)}72%{transform:translateX(-120px) rotate(-5deg)}90%{transform:translateX(30px) rotate(4deg)}100%{opacity:0;transform:translateX(105px) rotate(8deg)}}
@keyframes szWipeSoot{0%{opacity:.68;filter:blur(0)}22%{opacity:.54}48%{opacity:.34}72%{opacity:.18}100%{opacity:.07;filter:blur(.3px)}}
@keyframes szKeepPatina{0%{opacity:.68}100%{opacity:.30}}
@keyframes szPolish{0%{filter:brightness(.88) contrast(1.22) saturate(.78)}65%{filter:brightness(.98) contrast(1.13) saturate(.88)}100%{filter:brightness(1.03) contrast(1.1) saturate(.92)}}
@keyframes szShine{0%{opacity:0;transform:translateX(-130%)}20%{opacity:.7}70%{opacity:.45}100%{opacity:0;transform:translateX(130%)}}
@keyframes szSparkle{0%{opacity:0;transform:scale(.4) rotate(-20deg)}45%{opacity:1;transform:scale(1.25) rotate(8deg)}100%{opacity:0;transform:scale(.8) rotate(18deg)}}`;
document.head.appendChild(css);
function prepare(){const r=document.getElementById("szReal");if(!r||!r.querySelector(".srCard")||r.querySelector(".szCleanBtn"))return;const card=r.querySelector(".srCard"),medal=r.querySelector(".srMedal");const b=document.createElement("button");b.type="button";b.className="szCleanBtn";b.textContent="🧹 煤をお掃除";const brush=document.createElement("div");brush.className="szBrush";const shine=document.createElement("div");shine.className="szShine";const sparkle=document.createElement("div");sparkle.className="szSparkle";sparkle.textContent="✨";card.append(b,brush,sparkle);if(medal)medal.appendChild(shine);b.onclick=e=>{e.preventDefault();e.stopPropagation();r.classList.remove("sz-clean-ready");r.classList.add("sz-cleaning");b.disabled=true;setTimeout(()=>{b.remove();brush.remove();sparkle.remove();r.classList.remove("sz-cleaning");r.classList.add("sz-cleaned");const soot=r.querySelector(".srSoot"),oxide=r.querySelector(".srOxide");if(soot)soot.style.opacity=".07";if(oxide)oxide.style.opacity=".30";},2450)};setTimeout(()=>r.classList.add("sz-clean-ready"),4100)}
const mo=new MutationObserver(()=>{const r=document.getElementById("szReal");if(r&&r.querySelector(".srCard")&&!r.querySelector(".szCleanBtn"))prepare()});mo.observe(document.documentElement,{subtree:true,childList:true});
})();