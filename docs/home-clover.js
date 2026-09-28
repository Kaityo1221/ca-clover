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
  reach.src="./reach-phase7.js?v=20260928-reach-v1-polish1";
  reach.async=false;
  document.head.appendChild(reach);

  const reachCompare=document.createElement("script");
  reachCompare.src="./reach-phase7c.js?v=20260928-reach7c-polish1";
  reachCompare.async=false;
  document.head.appendChild(reachCompare);

  const reachOps=document.createElement("script");
  reachOps.src="./reach-phase7d.js?v=20260928-reach7d-polish1";
  reachOps.async=false;
  document.head.appendChild(reachOps);

  const reachLayout=document.createElement("script");
  reachLayout.src="./reach-mobile-layout-fix.js?v=20260928-reach-mobile-stable2";
  reachLayout.async=false;
  document.head.appendChild(reachLayout);
})();
