from pathlib import Path


def rep(text, old, new, label):
    if old not in text:
        raise SystemExit(f"pattern not found: {label}")
    return text.replace(old, new, 1)

p=Path('docs/clover-garden.js')
s=p.read_text(encoding='utf-8')

# Keep new specimens invisible until the Garden is actually visible.
s=rep(s,
'.clover-specimen:hover{filter:drop-shadow(0 7px 8px rgba(64,79,46,.12))}.clover-specimen.is-dropping{animation:cloverGardenDrop var(--drop-duration,2.2s) cubic-bezier(.18,.72,.16,1) both;z-index:30}.clover-specimen.is-year-shuffling{animation:cloverYearShuffle 1.55s cubic-bezier(.2,.75,.22,1) both}',
'.clover-specimen:hover{filter:drop-shadow(0 7px 8px rgba(64,79,46,.12))}.clover-specimen.is-drop-pending{opacity:0;transform:translate(calc(-50% + var(--drop-x,0px)),calc(-50% - 240px)) rotate(calc(var(--rot) - 24deg)) scale(.88)}.clover-specimen.is-dropping{animation:cloverGardenDrop var(--drop-duration,2.2s) cubic-bezier(.18,.72,.16,1) both;z-index:30}.clover-specimen.is-year-shuffling{animation:cloverYearShuffle 1.55s cubic-bezier(.2,.75,.22,1) both}',
'drop pending style')

# Replace the rough CSS-leaf specimen with an inline SVG specimen.
old_css='''      .clover-specimen-plant{position:absolute;left:8px;top:4px;width:88px;height:88px;transform:rotate(-2deg)}.clover-specimen-stem{position:absolute;left:43px;top:50px;width:6px;height:51px;border-radius:999px;background:linear-gradient(90deg,#83c769,#3f9650);transform:rotate(15deg);transform-origin:50% 0;box-shadow:inset 1px 0 rgba(255,255,255,.5);z-index:0}\n      .clover-specimen-leaf{position:absolute;width:40px;height:40px;border-radius:74% 43% 74% 43%;transform-origin:92% 92%;border:1px solid rgba(37,119,57,.24);box-shadow:inset 4px 4px 10px rgba(255,255,255,.18),inset -4px -5px 9px rgba(24,92,45,.09);opacity:var(--leaf-opacity);filter:saturate(var(--sat));z-index:2}.clover-specimen-leaf:after{content:"";position:absolute;left:9px;top:8px;width:19px;height:25px;border-left:1px solid rgba(235,248,184,.38);border-radius:50%;transform:rotate(-42deg)}\n      .clover-specimen-leaf.stage-0{background:linear-gradient(145deg,#eff5db,#c8dda5);--leaf-opacity:.58;--sat:.70}.clover-specimen-leaf.stage-1{background:linear-gradient(145deg,#e0f2b2,#9dcf69);--leaf-opacity:.78;--sat:.86}.clover-specimen-leaf.stage-2{background:linear-gradient(145deg,#c8ec78,#69b84f);--leaf-opacity:.9;--sat:.98}.clover-specimen-leaf.stage-3{background:linear-gradient(145deg,#aee85c,#3fa34b);--leaf-opacity:.97;--sat:1.06}.clover-specimen-leaf.stage-4{background:linear-gradient(145deg,#9ce147,#218841);--leaf-opacity:1;--sat:1.13}\n      .clover-specimen-leaf.top{left:24px;top:1px;transform:rotate(45deg) scale(var(--leaf-scale))}.clover-specimen-leaf.right{left:47px;top:24px;transform:rotate(135deg) scale(var(--leaf-scale))}.clover-specimen-leaf.bottom{left:24px;top:47px;transform:rotate(225deg) scale(var(--leaf-scale))}.clover-specimen-leaf.left{left:1px;top:24px;transform:rotate(315deg) scale(var(--leaf-scale))}.clover-specimen-center{position:absolute;left:38px;top:38px;width:12px;height:12px;border-radius:50%;background:#4fa147;border:1px solid rgba(225,241,154,.72);box-shadow:0 2px 5px rgba(50,91,42,.12);z-index:3}\n'''
new_css='''      .clover-specimen-plant{position:absolute;left:6px;right:6px;top:0;height:92px;transform:rotate(-2deg);pointer-events:none}.clover-specimen-plant svg{display:block;width:100%;height:100%;overflow:visible;filter:drop-shadow(0 4px 4px rgba(47,106,53,.12))}\n'''
s=rep(s,old_css,new_css,'replace rough specimen css')

s=rep(s,
'      @media(max-width:680px){.clover-garden-base{padding:16px}.clover-year-sheet{min-height:500px;padding-left:12px;padding-right:12px}.clover-sheet-field{left:2px;right:2px;top:64px}.clover-specimen{width:86px;height:105px}.clover-specimen-plant{left:3px;top:5px;transform:scale(.86) rotate(-2deg);transform-origin:top left}.clover-specimen-tag{left:0;right:0}.clover-sheet-community{max-width:52%}}',
'      @media(max-width:680px){.clover-garden-base{padding:16px}.clover-year-sheet{min-height:500px;padding-left:12px;padding-right:12px}.clover-sheet-field{left:2px;right:2px;top:64px}.clover-specimen{width:94px;height:126px}.clover-specimen-plant{left:4px;right:4px;top:0;height:94px;transform:rotate(-2deg)}.clover-specimen-tag{left:0;right:0;bottom:1px}.clover-sheet-community{max-width:52%}}',
'mobile specimen sizing')

# Add mini SVG helper before specimenHtml.
needle='''  function specimenHtml(s,communityName,isNew,index){\n'''
helper=r'''  function specimenPlantSvg(stages,index){
    const colors=[
      ["#f1f8df","#c7dfaa"],
      ["#e5f6bd","#9dce69"],
      ["#ccf07c","#65b84d"],
      ["#b9ed60","#2f9d47"],
      ["#aee94f","#208640"]
    ];
    const leafPath="M60 59 C49 50 34 43 27 31 C20 19 24 8 34 4 C44 0 55 7 59 18 C60 21 60 24 60 27 C60 24 61 21 62 18 C66 7 77 0 87 4 C97 8 101 19 94 31 C87 43 72 50 60 59 Z";
    const rotations=[0,90,180,270];
    const defs=[];
    const leaves=stages.map((stage,i)=>{
      const st=clampStage(stage),scale=.78+st*.055;
      const gid="cgLeaf"+index+"_"+i;
      const c=colors[st];
      defs.push('<linearGradient id="'+gid+'" x1="15%" y1="10%" x2="88%" y2="92%"><stop offset="0" stop-color="'+c[0]+'"/><stop offset="1" stop-color="'+c[1]+'"/></linearGradient>');
      return '<g transform="rotate('+rotations[i]+' 60 60) translate(60 60) scale('+scale.toFixed(3)+') translate(-60 -60)"><path d="'+leafPath+'" fill="url(#'+gid+')" stroke="#2b8c42" stroke-width=".8" stroke-opacity=".34"/><path d="M60 56 C60 45 60 34 60 23" fill="none" stroke="#e7f5a7" stroke-width="1" stroke-linecap="round" opacity="'+(.18+st*.10).toFixed(2)+'"/></g>';
    }).join('');
    const stemId="cgStem"+index;
    defs.push('<linearGradient id="'+stemId+'" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b8ef6f"/><stop offset=".55" stop-color="#5fbd46"/><stop offset="1" stop-color="#237039"/></linearGradient>');
    return '<span class="clover-specimen-plant" aria-hidden="true"><svg viewBox="0 0 120 122"><defs>'+defs.join('')+'</defs><path d="M60 62 C58 78 52 94 46 116" fill="none" stroke="url(#'+stemId+')" stroke-width="5.5" stroke-linecap="round"/><path d="M59 64 C56 79 52 94 48 108" fill="none" stroke="#d9f3a0" stroke-width="1.2" stroke-linecap="round" opacity=".72"/>'+leaves+'<circle cx="60" cy="60" r="4.4" fill="#58b846" stroke="#d9ef8b" stroke-width="1"/></svg></span>';
  }

'''
s=rep(s,needle,helper+needle,'insert specimen svg helper')

old_plant='''    const stages=[s.host_stage,s.join_stage,s.exchange_stage,s.continue_stage].map(clampStage);\n    const plant='<span class="clover-specimen-plant" aria-hidden="true"><i class="clover-specimen-stem"></i>'+\n      '<i class="clover-specimen-leaf top stage-'+stages[0]+'" style="--leaf-scale:'+leafScale(stages[0])+'"></i>'+\n      '<i class="clover-specimen-leaf right stage-'+stages[1]+'" style="--leaf-scale:'+leafScale(stages[1])+'"></i>'+\n      '<i class="clover-specimen-leaf bottom stage-'+stages[2]+'" style="--leaf-scale:'+leafScale(stages[2])+'"></i>'+\n      '<i class="clover-specimen-leaf left stage-'+stages[3]+'" style="--leaf-scale:'+leafScale(stages[3])+'"></i><i class="clover-specimen-center"></i></span>';\n    return '<button type="button" class="clover-specimen'+(isNew?' is-dropping':'')+'" data-snapshot-index="'+index+'"'+(s._test?' data-test-preview="1"':'')+'''
new_plant='''    const stages=[s.host_stage,s.join_stage,s.exchange_stage,s.continue_stage].map(clampStage);\n    const plant=specimenPlantSvg(stages,index);\n    return '<button type="button" class="clover-specimen'+(isNew?' is-drop-pending':'')+'" data-snapshot-index="'+index+'"'+(s._test?' data-test-preview="1"':'')+'''
s=rep(s,old_plant,new_plant,'specimen markup and pending class')

# Replace replay function with common start function.
old_replay='''  function replayGardenTest(section){
    if(!section)return;
    section.querySelectorAll(".clover-specimen[data-test-preview='1']").forEach((el,i)=>{
      el.classList.remove("is-dropping");
      el.style.animationDelay="";
      void el.getBoundingClientRect();
      el.style.animationDelay=(i*.16)+"s";
      el.classList.add("is-dropping");
    });
  }
'''
new_replay='''  function startGardenDrops(section,selector){
    if(!section)return;
    const items=[...section.querySelectorAll(selector||".clover-specimen.is-drop-pending")];
    items.forEach((el,i)=>{
      el.classList.remove("is-dropping");
      el.classList.add("is-drop-pending");
      el.style.animationDelay="";
      void el.getBoundingClientRect();
      setTimeout(()=>{
        if(!el.isConnected)return;
        el.classList.remove("is-drop-pending");
        el.style.animationDelay=(i*.16)+"s";
        el.classList.add("is-dropping");
        el.addEventListener("animationend",()=>el.classList.remove("is-dropping"),{once:true});
      },i*150);
    });
  }

  function replayGardenTest(section){
    startGardenDrops(section,".clover-specimen[data-test-preview='1']");
  }

  function armGardenViewportDrop(section){
    if(!section)return;
    const pending=section.querySelector(".clover-specimen.is-drop-pending");
    if(!pending)return;
    if(!("IntersectionObserver" in window)){
      setTimeout(()=>startGardenDrops(section),180);
      return;
    }
    const observer=new IntersectionObserver(entries=>{
      if(!entries.some(entry=>entry.isIntersecting&&entry.intersectionRatio>=.14))return;
      observer.disconnect();
      setTimeout(()=>startGardenDrops(section),220);
    },{threshold:[.14,.28],rootMargin:"0px 0px -8% 0px"});
    observer.observe(section);
  }
'''
s=rep(s,old_replay,new_replay,'viewport/replay drop functions')

# Remove immediate animation scheduling and arm observer instead. Keep year-completion logic but only after drop starts is overkill for test; just replace fresh scheduling block.
old_block='''    if(!window.matchMedia||!window.matchMedia("(prefers-reduced-motion: reduce)").matches){
      section.querySelectorAll(".clover-year-sheet[data-has-fresh='1']").forEach((sheet,sheetIndex)=>{
        const fresh=sheet.querySelectorAll(".clover-specimen.is-dropping");
        fresh.forEach((el,i)=>{el.style.animationDelay=(sheetIndex*.12+i*.22)+"s"});
        if(sheet.dataset.complete==="1"){
          const maxDelay=Math.max(0,fresh.length-1)*220+2450;
          setTimeout(()=>{
            sheet.querySelectorAll(".clover-specimen").forEach((el,i)=>{
              el.style.animationDelay=(i*24)+"ms";
              el.classList.add("is-year-shuffling");
              setTimeout(()=>el.classList.remove("is-year-shuffling"),1750+i*24);
            });
            const msg=sheet.querySelector(".clover-year-complete");
            if(msg){msg.classList.add("show");setTimeout(()=>msg.classList.remove("show"),4300)}
          },maxDelay);
        }
      });
    }
    maybeSpawnLuckyClover(section);'''
new_block='''    if(!window.matchMedia||!window.matchMedia("(prefers-reduced-motion: reduce)").matches){
      armGardenViewportDrop(section);
    }else{
      section.querySelectorAll(".clover-specimen.is-drop-pending").forEach(el=>el.classList.remove("is-drop-pending"));
    }
    maybeSpawnLuckyClover(section);'''
s=rep(s,old_block,new_block,'remove offscreen immediate animation')

p.write_text(s,encoding='utf-8')

idx=Path('docs/index.html')
i=idx.read_text(encoding='utf-8')
i=rep(i,'<script src="./clover-garden.js?v=20260926-gardentest1" defer></script>','<script src="./clover-garden.js?v=20260926-gardentest2" defer></script>','garden cache bust')
idx.write_text(i,encoding='utf-8')
