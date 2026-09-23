(function(){
"use strict";
if(!/(?:^|\/)stamp-rally\.html$/.test(location.pathname))return;
const style=document.createElement("style");
style.id="suzuki-vfx-layout-fix";
style.textContent=`
#szReal .srCard{overflow:hidden!important;isolation:isolate!important;}
#szReal .srVfx.back,
#szReal .srVfx.front{
  position:absolute!important;
  inset:0!important;
  left:0!important;
  top:0!important;
  width:100%!important;
  height:100%!important;
  border-radius:inherit!important;
  object-fit:cover!important;
  object-position:center center!important;
  pointer-events:none!important;
  mix-blend-mode:screen!important;
}
#szReal .srVfx.back{z-index:7!important;opacity:0;}
#szReal .srVfx.front{z-index:12!important;opacity:0;}
#szReal .srSmoke{z-index:13!important;}
#szReal .srSpark{z-index:14!important;}
#szReal .srF{z-index:15!important;}
#szReal .srMedal{z-index:3!important;}
#szReal .srEng{z-index:4!important;}
#szReal .forge .srVfx.back{animation:vfxBackModal 4s ease both!important;}
#szReal .forge .srVfx.front{animation:vfxFrontModal 4s ease both!important;}
@keyframes vfxBackModal{
  0%{opacity:0;transform:scale(1.02)}
  10%{opacity:.42}
  48%{opacity:.70;transform:scale(1.10)}
  86%{opacity:.28}
  100%{opacity:0;transform:scale(1.14)}
}
@keyframes vfxFrontModal{
  0%,7%{opacity:0;transform:scale(1.02)}
  17%{opacity:.76}
  50%{opacity:.96;transform:scale(1.11)}
  84%{opacity:.35}
  100%{opacity:0;transform:scale(1.15)}
}`;
document.head.appendChild(style);
})();
