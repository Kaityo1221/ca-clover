from pathlib import Path

path = Path('docs/clover-garden.js')
text = path.read_text(encoding='utf-8')

old_css = '''      .clover-specimen{position:absolute;left:var(--x);top:var(--y);width:104px;height:116px;border:0;background:transparent;padding:0;margin:0;transform:translate(-50%,-50%) rotate(var(--rot));transform-origin:50% 58%;cursor:pointer;-webkit-tap-highlight-color:transparent;z-index:var(--z);filter:drop-shadow(0 4px 4px rgba(64,79,46,.08));transition:transform .32s ease,filter .32s ease}.clover-specimen:active{transform:translate(-50%,-50%) rotate(var(--rot)) scale(.96)}
      .clover-specimen:hover{filter:drop-shadow(0 7px 8px rgba(64,79,46,.12))}.clover-specimen.is-drop-pending{opacity:0;transform:translate(calc(-50% + var(--drop-x,0px)),calc(-50% - 280px)) rotate(calc(var(--rot) - 8deg)) scale(.98)}.clover-specimen.is-dropping{animation:cloverGardenDrop var(--drop-duration,2.15s) cubic-bezier(.22,.66,.20,1) both;z-index:30;will-change:transform,opacity}
      @keyframes cloverGardenDrop{0%{opacity:0;transform:translate(calc(-50% + var(--drop-x,0px)),calc(-50% - 280px)) rotate(calc(var(--rot) - 8deg)) scale(.98)}16%{opacity:1;transform:translate(calc(-50% + var(--sway-a,0px)),calc(-50% - 208px)) rotate(calc(var(--rot) + 4deg)) scale(1)}45%{transform:translate(calc(-50% + var(--sway-b,0px)),calc(-50% - 112px)) rotate(calc(var(--rot) - 2.6deg)) scale(1)}69%{transform:translate(calc(-50% + var(--sway-c,0px)),calc(-50% - 35px)) rotate(calc(var(--rot) + 1.2deg)) scale(1)}84%{transform:translate(calc(-50% + var(--slide-x,1px)),calc(-50% - 1px)) rotate(calc(var(--rot) + .35deg)) scale(1,.97)}92%{transform:translate(calc(-50% + var(--slide-x,1px)),calc(-50% + 1px)) rotate(var(--rot)) scale(1.003,.985)}100%{opacity:1;transform:translate(-50%,-50%) rotate(var(--rot)) scale(1)}}
'''

new_css = '''      .clover-specimen{position:absolute;left:var(--x);top:var(--y);width:104px;height:116px;border:0;background:transparent;padding:0;margin:0;transform:translate3d(-50%,-50%,0) rotate(var(--rot));transform-origin:50% 58%;cursor:pointer;-webkit-tap-highlight-color:transparent;z-index:var(--z);filter:drop-shadow(0 4px 4px rgba(64,79,46,.08));transition:transform .32s ease,filter .32s ease;backface-visibility:hidden;-webkit-backface-visibility:hidden;transform-style:preserve-3d}.clover-specimen:active{transform:translate3d(-50%,-50%,0) rotate(var(--rot)) scale(.96)}
      .clover-specimen:hover{filter:drop-shadow(0 7px 8px rgba(64,79,46,.12))}.clover-specimen.is-drop-pending{opacity:0;filter:none;transform:translate3d(calc(-50% + var(--drop-x,0px)),calc(-50% - 260px),0) rotate(calc(var(--rot) - 6deg)) scale(.985)}.clover-specimen.is-dropping{animation:cloverGardenDrop var(--drop-duration,2.08s) cubic-bezier(.22,.61,.26,1) both;z-index:30;will-change:transform,opacity;filter:none!important;transition:none!important}.clover-specimen.is-dropping .ca-monthly-clover-svg,.clover-specimen.is-drop-pending .ca-monthly-clover-svg,.clover-specimen.is-dropping .clover-specimen-plant>svg,.clover-specimen.is-drop-pending .clover-specimen-plant>svg,.clover-specimen.is-dropping .clover-specimen-plant>img,.clover-specimen.is-drop-pending .clover-specimen-plant>img{filter:none!important}
      @keyframes cloverGardenDrop{0%{opacity:0;transform:translate3d(calc(-50% + var(--drop-x,0px)),calc(-50% - 260px),0) rotate(calc(var(--rot) - 6deg)) scale(.985)}20%{opacity:1;transform:translate3d(calc(-50% + var(--sway-a,0px)),calc(-50% - 188px),0) rotate(calc(var(--rot) + 3.2deg)) scale(1)}52%{transform:translate3d(calc(-50% + var(--sway-b,0px)),calc(-50% - 92px),0) rotate(calc(var(--rot) - 1.5deg)) scale(1)}78%{transform:translate3d(calc(-50% + var(--sway-c,0px)),calc(-50% - 18px),0) rotate(calc(var(--rot) + .6deg)) scale(1)}90%{transform:translate3d(calc(-50% + var(--slide-x,1px)),calc(-50% + 1px),0) rotate(var(--rot)) scale(1,.972)}100%{opacity:1;transform:translate3d(-50%,-50%,0) rotate(var(--rot)) scale(1)}}
'''

if old_css not in text:
    raise SystemExit('target Garden drop CSS not found')
text = text.replace(old_css, new_css, 1)

old_fn = '''  function startGardenDrops(section,selector){
    if(!section)return;
    const items=[...section.querySelectorAll(selector||".clover-specimen.is-drop-pending")];
    items.forEach((el,i)=>{
      el.classList.remove("is-dropping","is-drop-pending");
      el.style.animationDelay="";
      void el.getBoundingClientRect();
      el.classList.add("is-drop-pending");
      setTimeout(()=>{
        if(!el.isConnected)return;
        el.classList.remove("is-drop-pending");
        el.style.animationDelay=(i*.12)+"s";
        el.classList.add("is-dropping");
        el.addEventListener("animationend",()=>{
          el.classList.remove("is-dropping");
          el.style.animationDelay="";
        },{once:true});
      },i*120);
    });
  }
'''

new_fn = '''  function startGardenDrops(section,selector){
    if(!section)return;
    const items=[...section.querySelectorAll(selector||".clover-specimen.is-drop-pending")];
    if(!items.length)return;
    items.forEach((el,i)=>{
      el.classList.remove("is-dropping","is-drop-pending");
      el.style.animationDelay=(i*.12)+"s";
      el.classList.add("is-drop-pending");
    });
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      items.forEach(el=>{
        if(!el.isConnected)return;
        el.classList.remove("is-drop-pending");
        el.classList.add("is-dropping");
        el.addEventListener("animationend",()=>{
          el.classList.remove("is-dropping");
          el.style.animationDelay="";
        },{once:true});
      });
    }));
  }
'''

if old_fn not in text:
    raise SystemExit('target startGardenDrops function not found')
text = text.replace(old_fn, new_fn, 1)

old_duration = 'const dropDuration=(1.90+(hash(seed+"d")%50)/100).toFixed(2)+"s";'
new_duration = 'const dropDuration=(1.96+(hash(seed+"d")%27)/100).toFixed(2)+"s";'
if old_duration not in text:
    raise SystemExit('drop duration source not found')
text = text.replace(old_duration, new_duration, 1)

path.write_text(text, encoding='utf-8')

index = Path('docs/index.html')
html = index.read_text(encoding='utf-8')
old_version = './clover-garden.js?v=20260926-garden-test-entry1'
new_version = './clover-garden.js?v=20260926-garden-smooth1'
if old_version not in html:
    raise SystemExit('Garden script cache key not found')
html = html.replace(old_version, new_version, 1)
index.write_text(html, encoding='utf-8')
