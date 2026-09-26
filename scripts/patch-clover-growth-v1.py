from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"pattern not found: {label}")
    return text.replace(old, new, 1)


monthly = Path("docs/monthly-clover.js")
s = monthly.read_text(encoding="utf-8")
s = replace_once(
    s,
    ".ca-monthly-clover-body{display:grid;grid-template-columns:minmax(220px,360px) 1fr;align-items:center;gap:18px;margin-top:12px}.ca-monthly-clover-stage{min-width:0}.ca-monthly-clover-svg{width:100%;max-width:350px;display:block;margin:auto;overflow:visible}",
    ".ca-monthly-clover-body{display:grid;grid-template-columns:minmax(220px,360px) 1fr;align-items:center;gap:18px;margin-top:12px}.ca-monthly-clover-stage{min-width:0;perspective:760px}.ca-monthly-clover-svg{width:100%;max-width:350px;display:block;margin:auto;overflow:visible}",
    "monthly perspective",
)
s = replace_once(
    s,
    ".ca-month-leaf-scale{transform-box:fill-box;transform-origin:50% 96%;transform:scale(var(--leaf-scale));opacity:var(--leaf-opacity);transition:transform .48s cubic-bezier(.2,.8,.2,1),opacity .35s ease}",
    ".ca-month-leaf-scale{transform-box:fill-box;transform-origin:50% 96%;transform:scale(var(--leaf-scale));opacity:var(--leaf-opacity);transition:transform .48s cubic-bezier(.2,.8,.2,1),opacity .35s ease;transform-style:preserve-3d;backface-visibility:hidden}",
    "monthly leaf transform",
)
s = replace_once(
    s,
    ".ca-month-leaf.is-flipping .ca-month-leaf-scale{animation:caCloverFlip .76s cubic-bezier(.22,.76,.25,1)}\n      @keyframes caCloverFlip{0%{transform:scale(var(--leaf-scale)) rotateX(0deg)}42%{transform:scale(var(--leaf-scale)) rotateX(82deg) translateY(-5px)}58%{transform:scale(calc(var(--leaf-scale) * 1.035)) rotateX(98deg) translateY(-4px)}100%{transform:scale(var(--leaf-scale)) rotateX(180deg)}}",
    ".ca-month-leaf.is-flipping{pointer-events:none}.ca-month-leaf.is-flipping .ca-month-leaf-scale{animation:caCloverFlip .78s cubic-bezier(.2,.78,.24,1)}.ca-month-leaf.is-flipping .ca-month-leaf-light{animation:caCloverGrowLight .78s ease}\n      @keyframes caCloverFlip{0%{transform:scale(var(--leaf-scale)) rotateX(0deg) translateY(0)}34%{transform:scale(var(--leaf-scale)) rotateX(74deg) translateY(-6px)}56%{transform:scale(calc(var(--leaf-scale) * 1.055)) rotateX(-11deg) translateY(-7px)}78%{transform:scale(calc(var(--leaf-scale) * 1.025)) rotateX(4deg) translateY(-3px)}100%{transform:scale(var(--leaf-scale)) rotateX(0deg) translateY(0)}}\n      @keyframes caCloverGrowLight{0%,100%{opacity:calc(.55 * var(--gloss-opacity))}48%{opacity:calc(.86 * var(--gloss-opacity))}}",
    "monthly flip animation",
)
s = replace_once(
    s,
    '''  function flip(root,key){
    if(!root)return;
    const leaf=root.querySelector('[data-axis="'+key+'"]');
    if(!leaf)return;
    leaf.classList.remove("is-flipping"); void leaf.getBoundingClientRect(); leaf.classList.add("is-flipping");
    setTimeout(()=>leaf.classList.remove("is-flipping"),800);
  }''',
    '''  function flip(root,key){
    if(!root)return Promise.resolve(false);
    const leaf=root.querySelector('[data-axis="'+key+'"]');
    if(!leaf)return Promise.resolve(false);
    leaf.classList.remove("is-flipping");
    void leaf.getBoundingClientRect();
    leaf.classList.add("is-flipping");
    return new Promise(resolve=>setTimeout(()=>{
      leaf.classList.remove("is-flipping");
      resolve(true);
    },820));
  }''',
    "monthly flip function",
)
monthly.write_text(s, encoding="utf-8")


home = Path("docs/home-clover.js")
s = home.read_text(encoding="utf-8")
s = replace_once(
    s,
    'script.src="./monthly-clover.js?v=20260926-home2";',
    'script.src="./monthly-clover.js?v=20260926-growth1";',
    "monthly cache version",
)
s = replace_once(
    s,
    "  let renderToken=0;\n",
    "  let renderToken=0;\n  const activeGrowthControllers=new Set();\n",
    "growth controller set",
)
s = replace_once(
    s,
    "      .home-clover-growth{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:12px;padding:10px 13px;border-radius:16px;background:rgba(255,247,237,.88);border:1px solid #fed7aa;color:#c2410c;font-size:12px;font-weight:950;text-align:center}",
    "      .home-clover-growth{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:12px;padding:10px 12px 10px 13px;border-radius:16px;background:rgba(255,247,237,.88);border:1px solid #fed7aa;color:#c2410c;font-size:12px;font-weight:950;text-align:left}.home-clover-growth-message{flex:1;min-width:0}.home-clover-skip{border:1px solid #fdba74;background:rgba(255,255,255,.9);color:#9a3412;border-radius:999px;padding:6px 10px;font-size:11px;font-weight:950;line-height:1;box-shadow:0 3px 10px rgba(154,52,18,.06)}.home-clover-skip[hidden]{display:none!important}",
    "growth message style",
)
s = replace_once(
    s,
    '''  function grownAxes(before,after){
    if(!before)return [];
    return window.CAMonthlyClover.AXES.filter(a=>number(after[a.key])>number(before[a.key])).map(a=>a.key);
  }
''',
    '''  function grownAxes(before,after){
    if(!before)return [];
    return window.CAMonthlyClover.AXES.filter(a=>number(after[a.key])>number(before[a.key])).map(a=>a.key);
  }
  function cancelAllGrowthAnimations(save){
    [...activeGrowthControllers].forEach(controller=>controller.cancel(Boolean(save)));
  }
''',
    "growth cancel helper",
)
old_bind = '''  function bindModel(root,model,uid){
    root.querySelectorAll("[data-clover-axis]").forEach(btn=>btn.addEventListener("click",()=>openAxisModal(model,btn.dataset.cloverAxis)));
    root.querySelectorAll(".ca-month-leaf[data-axis]").forEach(leaf=>{
      leaf.setAttribute("tabindex","0");
      leaf.setAttribute("role","button");
      leaf.addEventListener("click",()=>openAxisModal(model,leaf.dataset.axis));
      leaf.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();openAxisModal(model,leaf.dataset.axis)}});
    });
    const before=previousStages(uid,model.community.id,model.now);
    const grown=grownAxes(before,model.stages);
    const growth=root.querySelector("[data-growth-message]");
    if(growth){
      growth.innerHTML=grown.length?'🌱 今回、'+grown.length+'枚の葉が育ちました。':'🍀 今月の活動がCloverに育っています。';
    }
    if(grown.length&&!matchMedia("(prefers-reduced-motion: reduce)").matches){
      grown.forEach((key,i)=>setTimeout(()=>window.CAMonthlyClover.flip(root,key),420+i*430));
    }
    saveStages(uid,model.community.id,model.now,model.stages);
  }'''
new_bind = '''  function bindModel(root,model,uid){
    root.querySelectorAll("[data-clover-axis]").forEach(btn=>btn.addEventListener("click",()=>openAxisModal(model,btn.dataset.cloverAxis)));
    root.querySelectorAll(".ca-month-leaf[data-axis]").forEach(leaf=>{
      leaf.setAttribute("tabindex","0");
      leaf.setAttribute("role","button");
      leaf.addEventListener("click",()=>openAxisModal(model,leaf.dataset.axis));
      leaf.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();openAxisModal(model,leaf.dataset.axis)}});
    });

    const before=previousStages(uid,model.community.id,model.now);
    const grown=grownAxes(before,model.stages);
    const growth=root.querySelector("[data-growth-message]");
    const skip=root.querySelector("[data-growth-skip]");
    const reduced=Boolean(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    if(growth){
      growth.textContent=grown.length?'🌱 今回、'+grown.length+'枚の葉が育ちました。':'🍀 今月の活動がCloverに育っています。';
    }

    // 初回表示は現在値を基準として保存し、成長演出は行わない。
    if(!before){
      saveStages(uid,model.community.id,model.now,model.stages);
      return;
    }
    if(!grown.length||reduced){
      saveStages(uid,model.community.id,model.now,model.stages);
      return;
    }

    if(skip)skip.hidden=false;
    let cancelled=false;
    let completed=false;
    let timers=[];
    const clearTimers=()=>{
      timers.forEach(id=>clearTimeout(id));
      timers=[];
    };
    const finish=()=>{
      if(completed)return;
      completed=true;
      clearTimers();
      root.querySelectorAll(".ca-month-leaf.is-flipping").forEach(leaf=>leaf.classList.remove("is-flipping"));
      if(skip)skip.hidden=true;
      saveStages(uid,model.community.id,model.now,model.stages);
      activeGrowthControllers.delete(controller);
    };
    const controller={
      cancel(save){
        if(completed)return;
        cancelled=true;
        clearTimers();
        root.querySelectorAll(".ca-month-leaf.is-flipping").forEach(leaf=>leaf.classList.remove("is-flipping"));
        if(skip)skip.hidden=true;
        if(save)saveStages(uid,model.community.id,model.now,model.stages);
        completed=true;
        activeGrowthControllers.delete(controller);
      }
    };
    activeGrowthControllers.add(controller);
    if(skip)skip.addEventListener("click",()=>controller.cancel(true),{once:true});

    const schedule=(fn,ms)=>{
      const id=setTimeout(()=>{
        timers=timers.filter(x=>x!==id);
        if(!cancelled)fn();
      },ms);
      timers.push(id);
    };
    let index=0;
    const playNext=()=>{
      if(cancelled)return;
      if(index>=grown.length){
        finish();
        return;
      }
      const key=grown[index++];
      window.CAMonthlyClover.flip(root,key);
      schedule(playNext,1060);
    };

    schedule(playNext,420);
  }'''
s = replace_once(s, old_bind, new_bind, "bindModel growth queue")
s = replace_once(
    s,
    '''    return label+monthly+'<div class="home-clover-growth" data-growth-message>🍀 今月の活動がCloverに育っています。</div>'+weeklyHtml(model);''',
    '''    return label+monthly+'<div class="home-clover-growth"><span class="home-clover-growth-message" data-growth-message aria-live="polite">🍀 今月の活動がCloverに育っています。</span><button type="button" class="home-clover-skip" data-growth-skip hidden>Skip</button></div>'+weeklyHtml(model);''',
    "growth markup",
)
s = replace_once(
    s,
    '    window.addEventListener("hashchange",()=>{renderToken++;document.getElementById(ROOT_ID)?.remove();schedule()});',
    '    window.addEventListener("hashchange",()=>{cancelAllGrowthAnimations(false);renderToken++;document.getElementById(ROOT_ID)?.remove();schedule()});',
    "hashchange cleanup",
)
home.write_text(s, encoding="utf-8")


index = Path("docs/index.html")
s = index.read_text(encoding="utf-8")
s = replace_once(
    s,
    '<script src="./home-clover.js?v=20260926-2" defer></script>',
    '<script src="./home-clover.js?v=20260926-growth1" defer></script>',
    "home cache version",
)
index.write_text(s, encoding="utf-8")
