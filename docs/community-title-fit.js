/* CA Clover / My Community: shared, viewport-based Community name layout.
 * Mobile first: 22px single line -> shrink to 18px -> up to two lines
 * at 20/19/18px -> ellipsis. Full name remains in title/aria-label.
 * No changes to feature buttons, medals, authentication or navigation.
 */
(function(){
  "use strict";

  const SELECTOR=".community-hub-layout .community-hero-row h1";
  const MOBILE_MAX=480;
  let scheduled=false;

  const clearLayout=(heading)=>{
    for(const prop of [
      "font-size","line-height","white-space","overflow","text-overflow",
      "word-break","overflow-wrap","hyphens","text-wrap",
      "display","-webkit-line-clamp","-webkit-box-orient"
    ]) heading.style.removeProperty(prop);
    heading.removeAttribute("data-ca-title-lines");
  };

  // Bracketed explanations should start together on the next line when a
  // Community name needs two lines. Never edit the stored Community name.
  function restorePlainName(heading,fullName){
    if(heading.getAttribute("data-ca-title-break")!=="parenthesis")return;
    heading.textContent=fullName;
    heading.removeAttribute("data-ca-title-break");
  }

  function putParenthesisOnNextLine(heading,fullName,at){
    heading.replaceChildren(
      document.createTextNode(fullName.slice(0,at)),
      document.createElement("br"),
      document.createTextNode(fullName.slice(at)),
    );
    heading.setAttribute("data-ca-title-break","parenthesis");
  }

  function prepare(heading,size,lines){
    heading.style.fontSize=size+"px";
    heading.style.lineHeight="1.2";
    heading.style.wordBreak="normal";
    heading.style.overflowWrap="normal";
    heading.style.hyphens="none";
    heading.style.removeProperty("display");
    heading.style.removeProperty("-webkit-line-clamp");
    heading.style.removeProperty("-webkit-box-orient");
    heading.style.textWrap=lines===2?"balance":"wrap";
    heading.style.whiteSpace=lines===1?"nowrap":"normal";
    // A multi-line candidate must be measurable *before* any line clamping.
    heading.style.overflow=lines===1?"hidden":"visible";
    heading.style.textOverflow=lines===1?"ellipsis":"clip";
  }

  function fit(){
    const heading=document.querySelector(SELECTOR);
    if(!heading)return;
    const fullName=(heading.textContent||"").trim();
    // Remove an earlier visual break before measuring a single-line layout.
    // The text itself is always preserved, including the original brackets.
    restorePlainName(heading,fullName);
    if(fullName){
      heading.title=fullName;
      heading.setAttribute("aria-label",fullName);
    }
    if(window.innerWidth>MOBILE_MAX){
      clearLayout(heading);
      return;
    }
    const width=heading.parentElement?.clientWidth||0;
    if(width<=0)return;

    // Check the actual rendered width, not character count; Japanese and
    // Latin glyphs have very different widths even at the same font size.
    for(let size=22;size>=18;size--){
      prepare(heading,size,1);
      if(heading.scrollWidth<=heading.clientWidth+1){
        heading.style.overflow="hidden";
        heading.setAttribute("data-ca-title-lines","1");
        return;
      }
    }

    // If the name has a parenthesized explanation, keep its opening
    // bracket with the explanation rather than leaving "(ミ" on line one.
    // Use this preference only after every one-line size was rejected.
    const bracketAt=fullName.search(/[（(]/);
    if(bracketAt>0 && bracketAt<fullName.length-1){
      putParenthesisOnNextLine(heading,fullName,bracketAt);
      for(let size=20;size>=18;size--){
        prepare(heading,size,2);
        const lineHeight=parseFloat(getComputedStyle(heading).lineHeight)||size*1.2;
        if(heading.scrollHeight<=lineHeight*2+2 &&
           heading.scrollWidth<=heading.clientWidth+1){
          heading.style.overflow="hidden";
          heading.setAttribute("data-ca-title-lines","2-parenthesis");
          return;
        }
      }
      // A too-long explanation falls back to regular 2-line fitting.
      restorePlainName(heading,fullName);
    }

    // Keep whole English words wherever the browser can naturally break.
    // Japanese and separators can break according to native line-breaking.
    for(let size=20;size>=18;size--){
      prepare(heading,size,2);
      const lineHeight=parseFloat(getComputedStyle(heading).lineHeight)||size*1.2;
      if(heading.scrollHeight<=lineHeight*2+2 &&
         heading.scrollWidth<=heading.clientWidth+1){
        heading.style.overflow="hidden";
        heading.setAttribute("data-ca-title-lines","2");
        return;
      }
    }

    prepare(heading,18,2);
    heading.style.display="-webkit-box";
    heading.style.webkitBoxOrient="vertical";
    heading.style.webkitLineClamp="2";
    heading.style.overflow="hidden";
    heading.setAttribute("data-ca-title-lines","2-ellipsis");
  }

  function schedule(){
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(()=>{
      scheduled=false;
      fit();
    });
  }

  const app=document.getElementById("app");
  if(app)new MutationObserver(records=>{
    // Inserting/removing our own <br> is a childList mutation. Ignore just
    // those mutations or the fitting loop could repeatedly reschedule itself.
    if(records.some(record=>!record.target?.matches?.(SELECTOR)))schedule();
  }).observe(app,{childList:true,subtree:true});
  window.addEventListener("resize",schedule,{passive:true});
  window.addEventListener("pageshow",schedule);
  if(document.fonts?.ready)document.fonts.ready.then(schedule);
  schedule();
})();
