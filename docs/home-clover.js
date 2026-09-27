(function(){
  "use strict";

  const core=document.createElement("script");
  core.src="./home-clover-core.js?v=20260927-activity-focus1";
  core.async=false;
  document.head.appendChild(core);

  const periods=document.createElement("script");
  periods.src="./community-period-inline.js?v=20260928-period-shared1";
  periods.async=false;
  document.head.appendChild(periods);

  const reach=document.createElement("script");
  reach.src="./reach-phase7.js?v=20260928-reach7b1";
  reach.async=false;
  document.head.appendChild(reach);
})();
