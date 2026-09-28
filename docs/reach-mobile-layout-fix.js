(function(){
  "use strict";

  function ensureStyle(){
    if(document.getElementById("caReachMobileLayoutFix"))return;
    const style=document.createElement("style");
    style.id="caReachMobileLayoutFix";
    style.textContent=`
      [data-reach-phase7="1"],
      #reach7Root,
      #reach7Body,
      .reach7-wrap,
      .reach7-wrap > *,
      .reach7-picker,
      .reach7-summary,
      .reach7-meta,
      .reach7-checkpoints,
      .reach7-chartbox,
      .reach7c,
      .reach7c-head,
      .reach7c-grid{
        width:100%;
        max-width:100%;
        min-width:0;
        box-sizing:border-box;
      }

      #reach7Root,
      #reach7Body,
      .reach7-wrap,
      .reach7c{
        overflow-x:hidden;
      }

      .reach7-picker > *,
      .reach7-summary > *,
      .reach7-meta > *,
      .reach7-checkpoints > *,
      .reach7c-head > *,
      .reach7c-grid > *{
        min-width:0;
        max-width:100%;
      }

      .reach7-select{
        width:100% !important;
        max-width:100% !important;
        min-width:0 !important;
      }

      .reach7-summary{
        grid-template-columns:repeat(2,minmax(0,1fr)) !important;
        gap:10px !important;
      }

      .reach7-metric,
      .reach7-checkpoint,
      .reach7c-card{
        width:100%;
        min-width:0 !important;
        max-width:100%;
        overflow:hidden;
      }

      .reach7-metric span,
      .reach7-metric b,
      .reach7-checkpoint .label,
      .reach7-checkpoint .value,
      .reach7-checkpoint .sub,
      .reach7-note,
      .reach7-empty,
      .reach7c-title,
      .reach7c-sub,
      .reach7c-label,
      .reach7c-current,
      .reach7c-base,
      .reach7c-diff,
      .reach7c-pattern,
      .reach7c-empty{
        max-width:100%;
        overflow-wrap:anywhere;
        word-break:break-word;
      }

      .reach7-checkpoint .sub{
        white-space:normal !important;
      }

      .reach7-chartbox{
        overflow-x:hidden !important;
        overflow-y:hidden !important;
      }

      .reach7-svg{
        display:block !important;
        width:100% !important;
        max-width:100% !important;
        min-width:0 !important;
        height:auto !important;
      }

      @media(max-width:760px){
        .reach7-summary{
          grid-template-columns:repeat(2,minmax(0,1fr)) !important;
        }

        .reach7-checkpoints{
          grid-template-columns:repeat(2,minmax(0,1fr)) !important;
          gap:8px !important;
          overflow:visible !important;
        }

        .reach7-checkpoints > .reach7-checkpoint:last-child:nth-child(odd){
          grid-column:1/-1;
        }

        .reach7c-grid{
          grid-template-columns:repeat(2,minmax(0,1fr)) !important;
        }

        .reach7c-grid > .reach7c-card:last-child:nth-child(odd){
          grid-column:1/-1;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function resetHorizontalOffset(){
    if(!document.querySelector('.feature-app.reach.on'))return;
    if(document.documentElement)document.documentElement.scrollLeft=0;
    if(document.body)document.body.scrollLeft=0;
  }

  ensureStyle();
  const observer=new MutationObserver(function(){
    ensureStyle();
    resetHorizontalOffset();
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener("DOMContentLoaded",function(){
    ensureStyle();
    resetHorizontalOffset();
  },{once:true});
  resetHorizontalOffset();
})();
