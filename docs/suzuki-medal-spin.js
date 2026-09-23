(function(){
"use strict";
if(!/(?:^|\/)stamp-rally\.html$/.test(location.pathname))return;

// TEMP: SuzukiPM-only lightweight medal rotation.
// Keep this separate from the stable event flow so it can be removed safely.
const style=document.createElement("style");
style.id="suzuki-medal-spin-style";
style.textContent=`
#szSafe .szMedal{
  transform-style:preserve-3d;
  will-change:transform;
  animation:szSuzukiMedalTurn 6.8s ease-in-out infinite;
}
@keyframes szSuzukiMedalTurn{
  0%,100%{transform:rotateY(-28deg) rotateX(7deg)}
  50%{transform:rotateY(28deg) rotateX(7deg)}
}
`;
document.head.appendChild(style);

window.CASuzukiMedalSpin={version:"lightweight-turn-20260924-0658"};
})();
