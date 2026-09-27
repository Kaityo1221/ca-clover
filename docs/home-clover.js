(function(){
  "use strict";

  const core=document.createElement("script");
  core.src="./home-clover-core.js?v=20260927-activity-focus1";
  core.async=false;
  document.head.appendChild(core);

  const focus=document.createElement("script");
  focus.src="./activity-period-focus.js?v=20260928-activity-inline1";
  focus.async=false;
  document.head.appendChild(focus);

  const growth=document.createElement("script");
  growth.src="./growth-period-inline.js?v=20260928-growth-inline1";
  growth.async=false;
  document.head.appendChild(growth);
})();
