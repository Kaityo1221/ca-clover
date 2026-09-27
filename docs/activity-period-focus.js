(function(){
  "use strict";

  function scrollToFeaturePanel(panel){
    if(!panel)return;
    const sticky=document.querySelector(".top");
    const offset=(sticky?sticky.getBoundingClientRect().height:0)+12;
    const y=panel.getBoundingClientRect().top+window.scrollY-offset;
    const reduce=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({top:Math.max(0,y),behavior:reduce?"auto":"smooth"});
  }

  document.addEventListener("click",function(event){
    const target=event.target&&event.target.closest?event.target.closest("[data-community-period]"):null;
    if(!target)return;
    const currentPanel=document.getElementById("communityFeaturePanel");
    if(!currentPanel||!currentPanel.textContent.includes("Activity"))return;

    const previousPanel=currentPanel;
    let attempts=0;
    const timer=setInterval(function(){
      attempts++;
      const nextPanel=document.getElementById("communityFeaturePanel");
      if(nextPanel&&nextPanel!==previousPanel&&nextPanel.textContent.includes("Activity")){
        clearInterval(timer);
        requestAnimationFrame(function(){
          requestAnimationFrame(function(){scrollToFeaturePanel(nextPanel)});
        });
        return;
      }
      if(attempts>=100)clearInterval(timer);
    },50);
  },true);
})();
