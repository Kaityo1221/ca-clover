(function(){
  "use strict";

  const core=document.createElement("script");
  core.src="./home-clover-core.js?v=20261009-month-only";
  core.async=false;
  document.head.appendChild(core);

  const periods=document.createElement("script");
  periods.src="./community-period-inline.js?v=20260928-period-shared1";
  periods.async=false;
  document.head.appendChild(periods);

  const growthTheme=document.createElement("script");
  growthTheme.src="./community-growth-theme.js?v=20261001-growth-quickstart1";
  growthTheme.async=false;
  document.head.appendChild(growthTheme);

  const activityTheme=document.createElement("script");
  activityTheme.src="./community-activity-theme.js?v=20261002-activity-scroll1";
  activityTheme.async=false;
  document.head.appendChild(activityTheme);

  // Reach modules are loaded once by docs/index.html as ordered defer scripts.
  // Do not inject them again here: the duplicate loads create extra observers,
  // timers and potentially overwrite the active Reach mission state.

  const minigames=document.createElement("script");
  minigames.src="./community-minigames-placeholder.js?v=20261004-2";
  minigames.async=false;
  document.head.appendChild(minigames);

  const reachLayout=document.createElement("script");
  reachLayout.src="./reach-mobile-layout-fix.js?v=20260928-reach-mobile-stable2";
  reachLayout.async=false;
  document.head.appendChild(reachLayout);
})();
