(function(){
"use strict";
if(!/(?:^|\/)stamp-rally\.html$/.test(location.pathname))return;
const style=document.createElement("style");
style.id="suzuki-vfx-layout-fix";
style.textContent=`
#szReal .srBadge{overflow:hidden!important;}
#szReal .srCard{
  overflow:hidden!important;
  isolation:isolate!important;
  transform:translateZ(0)!important;
  -webkit-mask-image:-webkit-radial-gradient(white,black)!important;
  clip-path:inset(0 round 30px)!important;
}
#szReal .srCard>.srVfx.back,
#szReal .srCard>.srVfx.front{
  position:absolute!important;
  inset:0!important;
  left:0!important;
  top:0!important;
  right:0!important;
  bottom:0!important;
  width:100%!important;
  height:100%!important;
  max-width:none!important;
  max-height:none!important;
  border-radius:30px!important;
  object-fit:cover!important;
  object-position:center center!important;
  pointer-events:none!important;
  mix-blend-mode:screen!important;
  transform-origin:center!important;
}
/* Both flame videos live ABOVE the white card and medal. */
#szReal .srCard>.srVfx.back{z-index:40!important;opacity:0;}
#szReal .srCard>.srVfx.front{z-index:41!important;opacity:0;}
#szReal .srCard>.srSmoke{z-index:42!important;}
#szReal .srCard>.srSpark{z-index:43!important;}
#szReal .srCard>.srHaze{z-index:44!important;}
#szReal .srF{z-index:60!important;}
#szReal .srMedal{z-index:3!important;}
#szReal .srEng{z-index:4!important;}
#szReal .forge .srVfx.back{animation:vfxBackModal 4s ease both!important;}
#szReal .forge .srVfx.front{animation:vfxFrontModal 4s ease both!important;}
@keyframes vfxBackModal{
  0%{opacity:0;transform:scale(1.001)}
  8%{opacity:.55}
  46%{opacity:.88;transform:scale(1.045)}
  84%{opacity:.38}
  100%{opacity:0;transform:scale(1.07)}
}
@keyframes vfxFrontModal{
  0%,5%{opacity:0;transform:scale(1.001)}
  14%{opacity:.82}
  48%{opacity:1;transform:scale(1.05)}
  82%{opacity:.42}
  100%{opacity:0;transform:scale(1.075)}
}`;
document.head.appendChild(style);
})();
