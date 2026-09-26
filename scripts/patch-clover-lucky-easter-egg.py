from pathlib import Path


def rep(text, old, new, label):
    if old not in text:
        raise SystemExit(f"pattern not found: {label}")
    return text.replace(old, new, 1)

p = Path("docs/clover-garden.js")
s = p.read_text(encoding="utf-8")

s = rep(
    s,
    '  const SEEN_KEY_PREFIX="ca-clover-garden-seen:";\n',
    '  const SEEN_KEY_PREFIX="ca-clover-garden-seen:";\n  const LUCKY_CLOVER_CHANCE=0.005; // 0.5% per Garden view. Decorative only, never saved.\n',
    "lucky chance constant",
)

lucky_css = r'''      .clover-lucky{position:absolute;left:var(--lucky-left);top:0;width:54px;height:64px;z-index:90;border:0;background:transparent;padding:0;margin:0;cursor:pointer;-webkit-tap-highlight-color:transparent;transform-origin:50% 50%;filter:drop-shadow(0 4px 6px rgba(38,104,48,.18));animation:cloverLuckyFall var(--lucky-duration,6.1s) cubic-bezier(.23,.57,.22,1) both;will-change:transform,opacity,filter}
      .clover-lucky:before{content:"";position:absolute;left:50%;top:25px;width:58px;height:58px;border-radius:50%;transform:translate(-50%,-50%);background:radial-gradient(circle,rgba(203,255,126,.38),rgba(179,244,91,.14) 42%,transparent 72%);opacity:.18;animation:cloverLuckyGlow 1.45s ease-in-out 2.4s 2 alternate;pointer-events:none}
      .clover-lucky-leaf{position:absolute;left:19px;top:10px;width:22px;height:22px;border:1px solid rgba(37,122,59,.28);border-radius:76% 42% 76% 42%;background:linear-gradient(145deg,#c8f47c 0%,#67cb51 48%,#239244 100%);box-shadow:inset 3px 3px 6px rgba(255,255,255,.26),inset -3px -3px 6px rgba(23,92,43,.08);transform-origin:90% 90%}.clover-lucky-leaf.a{transform:rotate(45deg) translate(-8px,-8px)}.clover-lucky-leaf.b{transform:rotate(135deg) translate(-8px,-8px)}.clover-lucky-leaf.c{transform:rotate(225deg) translate(-8px,-8px)}.clover-lucky-leaf.d{transform:rotate(315deg) translate(-8px,-8px)}
      .clover-lucky-center{position:absolute;left:25px;top:20px;width:8px;height:8px;border-radius:50%;background:#4bb447;border:1px solid rgba(230,250,154,.72)}.clover-lucky-stem{position:absolute;left:29px;top:27px;width:4px;height:34px;border-radius:999px;background:linear-gradient(90deg,#8bd46b,#2b8d49);transform:rotate(18deg);transform-origin:50% 0;z-index:-1}
      .clover-lucky.is-caught{animation:cloverLuckyTap .48s cubic-bezier(.2,.8,.24,1) forwards!important}.clover-lucky.is-caught:before{animation:cloverLuckyCaughtGlow .48s ease forwards!important}
      @keyframes cloverLuckyFall{0%{opacity:0;transform:translate3d(-50%,-72px,0) rotate(-24deg) scale(.82)}9%{opacity:1}48%{opacity:1;transform:translate3d(calc(-50% + var(--lucky-drift-a)),var(--lucky-mid),0) rotate(126deg) scale(1)}68%{opacity:1;transform:translate3d(calc(-50% + var(--lucky-drift-b)),var(--lucky-late),0) rotate(202deg) scale(1.03);filter:drop-shadow(0 0 10px rgba(138,221,74,.48)) brightness(1.08)}82%{opacity:.96;transform:translate3d(calc(-50% + var(--lucky-roll)),calc(var(--lucky-late) + 28px),0) rotate(290deg) scale(.96)}100%{opacity:0;transform:translate3d(calc(-50% + var(--lucky-exit)),var(--lucky-fall),0) rotate(430deg) scale(.72)}}
      @keyframes cloverLuckyGlow{0%{opacity:.12;transform:translate(-50%,-50%) scale(.8)}100%{opacity:.62;transform:translate(-50%,-50%) scale(1.28)}}
      @keyframes cloverLuckyTap{0%{opacity:1;transform:translate3d(-50%,0,0) rotate(0) scale(1)}48%{opacity:1;transform:translate3d(-50%,-8px,0) rotate(15deg) scale(1.22)}100%{opacity:0;transform:translate3d(-50%,-16px,0) rotate(28deg) scale(.42)}}
      @keyframes cloverLuckyCaughtGlow{0%{opacity:.28;transform:translate(-50%,-50%) scale(.8)}55%{opacity:.86;transform:translate(-50%,-50%) scale(1.6)}100%{opacity:0;transform:translate(-50%,-50%) scale(2)}}
'''
s = rep(
    s,
    '      .clover-garden-note{position:relative;z-index:1;margin-top:10px;color:#98a08e;font-size:9px;font-weight:800;line-height:1.55}\n',
    lucky_css + '      .clover-garden-note{position:relative;z-index:1;margin-top:10px;color:#98a08e;font-size:9px;font-weight:800;line-height:1.55}\n',
    "lucky clover styles",
)

s = rep(
    s,
    '      @media(prefers-reduced-motion:reduce){.clover-specimen.is-dropping,.clover-specimen.is-year-shuffling,.clover-year-complete.show{animation:none!important}.clover-year-complete.show{opacity:1;transform:translate(-50%,0)}}',
    '      @media(prefers-reduced-motion:reduce){.clover-specimen.is-dropping,.clover-specimen.is-year-shuffling,.clover-year-complete.show{animation:none!important}.clover-year-complete.show{opacity:1;transform:translate(-50%,0)}.clover-lucky{display:none!important}}',
    "reduced motion lucky guard",
)

lucky_fn = r'''
  function maybeSpawnLuckyClover(section){
    if(!section||section.querySelector(".clover-lucky"))return;
    if(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
    if(Math.random()>=LUCKY_CLOVER_CHANCE)return;

    const lucky=document.createElement("button");
    lucky.type="button";
    lucky.className="clover-lucky";
    lucky.setAttribute("aria-label","小さな四つ葉");
    lucky.title="🍀";
    lucky.innerHTML='<i class="clover-lucky-stem" aria-hidden="true"></i><i class="clover-lucky-leaf a" aria-hidden="true"></i><i class="clover-lucky-leaf b" aria-hidden="true"></i><i class="clover-lucky-leaf c" aria-hidden="true"></i><i class="clover-lucky-leaf d" aria-hidden="true"></i><i class="clover-lucky-center" aria-hidden="true"></i>';

    const width=Math.max(280,section.clientWidth||320);
    const height=Math.max(280,section.clientHeight||420);
    const start=24+Math.random()*52;
    const direction=Math.random()<.5?-1:1;
    lucky.style.setProperty("--lucky-left",start.toFixed(2)+"%");
    lucky.style.setProperty("--lucky-duration",(5.6+Math.random()*1.25).toFixed(2)+"s");
    lucky.style.setProperty("--lucky-mid",Math.round(height*.42)+"px");
    lucky.style.setProperty("--lucky-late",Math.round(height*.66)+"px");
    lucky.style.setProperty("--lucky-fall",Math.round(height+110)+"px");
    lucky.style.setProperty("--lucky-drift-a",Math.round((Math.random()-.5)*42)+"px");
    lucky.style.setProperty("--lucky-drift-b",Math.round((Math.random()-.5)*58)+"px");
    lucky.style.setProperty("--lucky-roll",Math.round(direction*(34+Math.random()*28))+"px");
    lucky.style.setProperty("--lucky-exit",Math.round(direction*(width*.72+90))+"px");

    const remove=()=>{if(lucky.isConnected)lucky.remove()};
    lucky.addEventListener("click",()=>{
      if(lucky.classList.contains("is-caught"))return;
      lucky.classList.add("is-caught");
      setTimeout(remove,520);
    });
    lucky.addEventListener("animationend",e=>{
      if(e.animationName==="cloverLuckyFall"||e.animationName==="cloverLuckyTap")remove();
    });

    const delay=900+Math.random()*2600;
    setTimeout(()=>{
      if(section.isConnected&&!section.querySelector(".clover-lucky"))section.appendChild(lucky);
    },delay);
  }
'''
s = rep(
    s,
    '  function renderGarden(root,snapshots,communityMap,now,uid){\n',
    lucky_fn + '\n  function renderGarden(root,snapshots,communityMap,now,uid){\n',
    "lucky clover function",
)

s = rep(
    s,
    '      });\n    }\n  }\n\n  async function run(){',
    '      });\n    }\n    maybeSpawnLuckyClover(section);\n  }\n\n  async function run(){',
    "spawn lucky clover",
)

p.write_text(s, encoding="utf-8")

idx = Path("docs/index.html")
i = idx.read_text(encoding="utf-8")
i = rep(
    i,
    '<script src="./clover-garden.js?v=20260926-scrapbook1" defer></script>',
    '<script src="./clover-garden.js?v=20260926-lucky1" defer></script>',
    "garden cache bust",
)
idx.write_text(i, encoding="utf-8")
