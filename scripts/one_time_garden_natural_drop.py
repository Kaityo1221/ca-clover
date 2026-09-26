from pathlib import Path

js_path = Path('docs/clover-garden.js')
text = js_path.read_text(encoding='utf-8')

old_css = '''      .clover-specimen{position:absolute;left:var(--x);top:var(--y);width:104px;height:116px;border:0;background:transparent;padding:0;margin:0;transform:translate3d(-50%,-50%,0) rotate(var(--rot));transform-origin:50% 58%;cursor:pointer;-webkit-tap-highlight-color:transparent;z-index:var(--z);filter:drop-shadow(0 4px 4px rgba(64,79,46,.08));transition:transform .32s ease,filter .32s ease;backface-visibility:hidden;-webkit-backface-visibility:hidden;transform-style:preserve-3d}.clover-specimen:active{transform:translate3d(-50%,-50%,0) rotate(var(--rot)) scale(.96)}
      .clover-specimen:hover{filter:drop-shadow(0 7px 8px rgba(64,79,46,.12))}.clover-specimen.is-drop-pending{opacity:0;filter:none;transform:translate3d(calc(-50% + var(--drop-x,0px)),calc(-50% - 260px),0) rotate(calc(var(--rot) - 6deg)) scale(.985)}.clover-specimen.is-dropping{animation:cloverGardenDrop var(--drop-duration,2.08s) cubic-bezier(.22,.61,.26,1) both;z-index:30;will-change:transform,opacity;filter:none!important;transition:none!important}.clover-specimen.is-dropping .ca-monthly-clover-svg,.clover-specimen.is-drop-pending .ca-monthly-clover-svg,.clover-specimen.is-dropping .clover-specimen-plant>svg,.clover-specimen.is-drop-pending .clover-specimen-plant>svg,.clover-specimen.is-dropping .clover-specimen-plant>img,.clover-specimen.is-drop-pending .clover-specimen-plant>img{filter:none!important}
      @keyframes cloverGardenDrop{0%{opacity:0;transform:translate3d(calc(-50% + var(--drop-x,0px)),calc(-50% - 260px),0) rotate(calc(var(--rot) - 6deg)) scale(.985)}20%{opacity:1;transform:translate3d(calc(-50% + var(--sway-a,0px)),calc(-50% - 188px),0) rotate(calc(var(--rot) + 3.2deg)) scale(1)}52%{transform:translate3d(calc(-50% + var(--sway-b,0px)),calc(-50% - 92px),0) rotate(calc(var(--rot) - 1.5deg)) scale(1)}78%{transform:translate3d(calc(-50% + var(--sway-c,0px)),calc(-50% - 18px),0) rotate(calc(var(--rot) + .6deg)) scale(1)}90%{transform:translate3d(calc(-50% + var(--slide-x,1px)),calc(-50% + 1px),0) rotate(var(--rot)) scale(1,.972)}100%{opacity:1;transform:translate3d(-50%,-50%,0) rotate(var(--rot)) scale(1)}}
'''

new_css = '''      .clover-specimen{position:absolute;left:var(--x);top:var(--y);width:104px;height:116px;border:0;background:transparent;padding:0;margin:0;transform:translate3d(-50%,-50%,0);transform-origin:50% 58%;cursor:pointer;-webkit-tap-highlight-color:transparent;z-index:var(--z);filter:drop-shadow(0 4px 4px rgba(64,79,46,.08));transition:transform .32s ease,filter .32s ease;backface-visibility:hidden;-webkit-backface-visibility:hidden;transform-style:preserve-3d}.clover-specimen:active{transform:translate3d(-50%,-50%,0) scale(.96)}
      .clover-specimen:hover{filter:drop-shadow(0 7px 8px rgba(64,79,46,.12))}.clover-specimen-motion{position:absolute;inset:0;transform:translate3d(0,0,0) rotate(var(--rot));transform-origin:50% 58%;backface-visibility:hidden;-webkit-backface-visibility:hidden;will-change:auto}.clover-specimen.is-drop-pending{opacity:0;filter:none;transform:translate3d(-50%,calc(-50% - 236px),0)}.clover-specimen.is-drop-pending .clover-specimen-motion{transform:translate3d(var(--drop-x,0px),0,0) rotate(calc(var(--rot) - 4deg)) scale(.985)}.clover-specimen.is-dropping{animation:cloverGardenFall var(--drop-duration,2.18s) cubic-bezier(.18,.58,.24,1) var(--drop-delay,0s) both;z-index:30;will-change:transform,opacity;filter:none!important;transition:none!important}.clover-specimen.is-dropping .clover-specimen-motion{animation:cloverGardenDrift var(--drop-duration,2.18s) ease-in-out var(--drop-delay,0s) both;will-change:transform}.clover-specimen.is-dropping .ca-monthly-clover-svg,.clover-specimen.is-drop-pending .ca-monthly-clover-svg,.clover-specimen.is-dropping .clover-specimen-plant>svg,.clover-specimen.is-drop-pending .clover-specimen-plant>svg,.clover-specimen.is-dropping .clover-specimen-plant>img,.clover-specimen.is-drop-pending .clover-specimen-plant>img{filter:none!important}
      @keyframes cloverGardenFall{0%{opacity:0;transform:translate3d(-50%,calc(-50% - 236px),0)}10%{opacity:1}86%{opacity:1;transform:translate3d(-50%,calc(-50% - 7px),0)}94%{transform:translate3d(-50%,calc(-50% + 1px),0)}100%{opacity:1;transform:translate3d(-50%,-50%,0)}}
      @keyframes cloverGardenDrift{0%{transform:translate3d(var(--drop-x,0px),0,0) rotate(calc(var(--rot) - 4deg)) scale(.985)}28%{transform:translate3d(var(--sway-a,0px),0,0) rotate(calc(var(--rot) + 1.8deg)) scale(1)}58%{transform:translate3d(var(--sway-b,0px),0,0) rotate(calc(var(--rot) - .9deg)) scale(1)}82%{transform:translate3d(var(--sway-c,0px),0,0) rotate(calc(var(--rot) + .25deg)) scale(1)}93%{transform:translate3d(var(--slide-x,1px),0,0) rotate(var(--rot)) scale(1,.974)}100%{transform:translate3d(0,0,0) rotate(var(--rot)) scale(1)}}
'''

if old_css not in text:
    raise SystemExit('current smooth drop CSS not found')
text = text.replace(old_css, new_css, 1)

old_html = '''    return '<button type="button" class="clover-specimen'+(isNew?' is-drop-pending':'')+'" data-snapshot-index="'+index+'"'+(s._test?' data-test-preview="1"':'')+' style="--x:'+x+';--y:'+y+';--rot:'+rot+';--z:'+(10+month)+';--drop-duration:'+dropDuration+';--drop-x:'+dropX+';--sway-a:'+swayA+';--sway-b:'+swayB+';--sway-c:'+swayC+';--slide-x:'+slideX+';--shuffle-x:'+shuffleX+';--shuffle-y:'+shuffleY+';--shuffle-r:'+shuffleR+'" aria-label="'+esc(month+'月のCloverを開く')+'">'+plant+'<span class="clover-specimen-tag"><span class="clover-specimen-month">'+month+'月'+(s._test?' TEST':'')+'</span><span class="clover-specimen-name">'+esc(communityName||"Community")+'</span></span></button>';
'''
new_html = '''    return '<button type="button" class="clover-specimen'+(isNew?' is-drop-pending':'')+'" data-snapshot-index="'+index+'"'+(s._test?' data-test-preview="1"':'')+' style="--x:'+x+';--y:'+y+';--rot:'+rot+';--z:'+(10+month)+';--drop-duration:'+dropDuration+';--drop-x:'+dropX+';--sway-a:'+swayA+';--sway-b:'+swayB+';--sway-c:'+swayC+';--slide-x:'+slideX+';--shuffle-x:'+shuffleX+';--shuffle-y:'+shuffleY+';--shuffle-r:'+shuffleR+'" aria-label="'+esc(month+'月のCloverを開く')+'"><span class="clover-specimen-motion">'+plant+'<span class="clover-specimen-tag"><span class="clover-specimen-month">'+month+'月'+(s._test?' TEST':'')+'</span><span class="clover-specimen-name">'+esc(communityName||"Community")+'</span></span></span></button>';
'''
if old_html not in text:
    raise SystemExit('specimen HTML target not found')
text = text.replace(old_html, new_html, 1)

old_fn = '''  function startGardenDrops(section,selector){
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
new_fn = '''  function startGardenDrops(section,selector){
    if(!section)return;
    const items=[...section.querySelectorAll(selector||".clover-specimen.is-drop-pending")];
    if(!items.length)return;
    items.forEach((el,i)=>{
      el.classList.remove("is-dropping","is-drop-pending");
      el.style.setProperty("--drop-delay",(i*.12)+"s");
      el.classList.add("is-drop-pending");
    });
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      items.forEach(el=>{
        if(!el.isConnected)return;
        el.classList.remove("is-drop-pending");
        el.classList.add("is-dropping");
        el.addEventListener("animationend",e=>{
          if(e.animationName!=="cloverGardenFall")return;
          el.classList.remove("is-dropping");
          el.style.removeProperty("--drop-delay");
        },{once:true});
      });
    }));
  }
'''
if old_fn not in text:
    raise SystemExit('startGardenDrops target not found')
text = text.replace(old_fn, new_fn, 1)

old_duration = 'const dropDuration=(1.96+(hash(seed+"d")%27)/100).toFixed(2)+"s";'
new_duration = 'const dropDuration=(2.12+(hash(seed+"d")%19)/100).toFixed(2)+"s";'
if old_duration not in text:
    raise SystemExit('duration target not found')
text = text.replace(old_duration, new_duration, 1)

js_path.write_text(text, encoding='utf-8')

index_path = Path('docs/index.html')
html = index_path.read_text(encoding='utf-8')
old_key = './clover-garden.js?v=20260926-garden-smooth1'
new_key = './clover-garden.js?v=20260926-garden-natural1'
if old_key not in html:
    raise SystemExit('cache key target not found')
html = html.replace(old_key, new_key, 1)
index_path.write_text(html, encoding='utf-8')
