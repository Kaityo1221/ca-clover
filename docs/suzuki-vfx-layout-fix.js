(function(){
"use strict";
if(!/(?:^|\/)stamp-rally\.html$/.test(location.pathname))return;
const style=document.createElement("style");
style.id="suzuki-vfx-layout-fix";
style.textContent=`
#szReal .srBadge{overflow:hidden!important;}
#szReal .srCard{overflow:hidden!important;isolation:isolate!important;transform:translateZ(0)!important;-webkit-mask-image:-webkit-radial-gradient(white,black)!important;clip-path:inset(0 round 30px)!important;}
#szReal .srCard>.srVfx.back,#szReal .srCard>.srVfx.front{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;border-radius:30px!important;object-fit:cover!important;object-position:center!important;pointer-events:none!important;mix-blend-mode:screen!important;transform-origin:center!important;}
#szReal .srCard>.srVfx.back{z-index:40!important;opacity:0}#szReal .srCard>.srVfx.front{z-index:41!important;opacity:0}#szReal .srCard>.srSmoke{z-index:42!important}#szReal .srCard>.srSpark{z-index:43!important}#szReal .srCard>.srHaze{z-index:44!important}#szReal .srF{z-index:60!important}#szReal .srMedal{z-index:3!important}#szReal .srEng{z-index:4!important}
/* Keep the white modal neutral: all heating belongs to the metal. */
#szReal .forge{background:#fffaf4!important;}
#szReal .forge .srMedal{animation:szMetalHeat 4s cubic-bezier(.22,.7,.2,1) both!important;}
#szReal .forge .srHeat{animation:szLocalHeat 4s ease-in-out both!important;}
#szReal .forge .srOxide{animation:szOxide 4s ease-in-out both!important;}
#szReal .forge .srSoot{animation:szSoot 4s ease-in both!important;}
#szReal .forge .srEng{animation:szEngrave 4s ease both!important;}
#szReal .forge .srVfx.back{animation:vfxBackModal 4s ease both!important}#szReal .forge .srVfx.front{animation:vfxFrontModal 4s ease both!important}
@keyframes vfxBackModal{0%{opacity:0;transform:scale(1.001)}8%{opacity:.55}46%{opacity:.88;transform:scale(1.045)}84%{opacity:.30}100%{opacity:0;transform:scale(1.07)}}
@keyframes vfxFrontModal{0%,5%{opacity:0;transform:scale(1.001)}14%{opacity:.82}48%{opacity:1;transform:scale(1.05)}82%{opacity:.32}100%{opacity:0;transform:scale(1.075)}}
@keyframes szMetalHeat{0%{filter:brightness(1) contrast(1) saturate(1);box-shadow:inset 0 0 0 5px #b8922e,inset 0 0 0 8px #755711,0 15px 35px #271d123d}18%{filter:brightness(1.08) contrast(1.04) saturate(1.08)}42%{filter:brightness(1.23) contrast(1.12) saturate(1.25);box-shadow:inset 0 0 0 5px #d89a25,inset 0 0 0 8px #7d3915,0 0 34px #ff6a222e,0 15px 35px #271d123d}62%{filter:brightness(1.12) contrast(1.16) saturate(1.18)}82%{filter:brightness(.96) contrast(1.18) saturate(.92)}100%{filter:brightness(.88) contrast(1.22) saturate(.78);box-shadow:inset 0 0 0 5px #826427,inset 0 0 0 8px #4b371b,0 15px 35px #271d123d}}
@keyframes szLocalHeat{0%{opacity:0;transform:translateX(-20%) scale(.58)}14%{opacity:.38}34%{opacity:.92;transform:translateX(-6%) scale(.88)}50%{opacity:.82;transform:translateX(5%) scale(1.12)}68%{opacity:.42}84%{opacity:.13}100%{opacity:0;transform:translateX(10%) scale(1.18)}}
@keyframes szOxide{0%,38%{opacity:0}55%{opacity:.18}72%{opacity:.42}100%{opacity:.68}}
@keyframes szSoot{0%,50%{opacity:0}67%{opacity:.12}82%{opacity:.36}100%{opacity:.68}}
@keyframes szEngrave{0%,38%{color:#3a3a3ad1;text-shadow:none}48%{color:#fff0ae;text-shadow:0 0 4px #fff8d4,0 0 14px #ffb52e,0 0 25px #ff4c18}61%{color:#ff6b2d;text-shadow:0 0 6px #ffcc55,0 0 18px #e8240c}74%{color:#8e2115;text-shadow:0 0 9px #d62c12}88%{color:#452019;text-shadow:0 1px 1px #ffffff18}100%{color:#21120f;text-shadow:0 1px 0 #ffffff12,0 0 1px #000}}
`;
document.head.appendChild(style);
})();