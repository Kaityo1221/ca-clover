from pathlib import Path
import re

path = Path("docs/clover-garden.js")
text = path.read_text(encoding="utf-8")


def sub_once(pattern, replacement, label):
    global text
    updated, count = re.subn(pattern, lambda _m: replacement, text, count=1, flags=re.M)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 replacement, got {count}")
    text = updated


sub_once(
    r"^      \.clover-specimen:hover\{[^\n]*\}\.clover-specimen\.is-drop-pending\{[^\n]*\}\.clover-specimen\.is-dropping\{[^\n]*\}\n      @keyframes cloverGardenDrop\{[^\n]*\}\n",
    """      .clover-specimen:hover{filter:drop-shadow(0 7px 8px rgba(64,79,46,.12))}.clover-specimen.is-drop-pending{opacity:0;transform:translate(calc(-50% + var(--drop-x,0px)),calc(-50% - 280px)) rotate(calc(var(--rot) - 8deg)) scale(.98)}.clover-specimen.is-dropping{animation:cloverGardenDrop var(--drop-duration,2.15s) cubic-bezier(.22,.66,.20,1) both;z-index:30;will-change:transform,opacity}
      @keyframes cloverGardenDrop{0%{opacity:0;transform:translate(calc(-50% + var(--drop-x,0px)),calc(-50% - 280px)) rotate(calc(var(--rot) - 8deg)) scale(.98)}16%{opacity:1;transform:translate(calc(-50% + var(--sway-a,0px)),calc(-50% - 208px)) rotate(calc(var(--rot) + 4deg)) scale(1)}45%{transform:translate(calc(-50% + var(--sway-b,0px)),calc(-50% - 112px)) rotate(calc(var(--rot) - 2.6deg)) scale(1)}69%{transform:translate(calc(-50% + var(--sway-c,0px)),calc(-50% - 35px)) rotate(calc(var(--rot) + 1.2deg)) scale(1)}84%{transform:translate(calc(-50% + var(--slide-x,1px)),calc(-50% - 1px)) rotate(calc(var(--rot) + .35deg)) scale(1,.97)}92%{transform:translate(calc(-50% + var(--slide-x,1px)),calc(-50% + 1px)) rotate(var(--rot)) scale(1.003,.985)}100%{opacity:1;transform:translate(-50%,-50%) rotate(var(--rot)) scale(1)}}
""",
    "drop css",
)

sub_once(
    r"^      \.clover-specimen-plant\{[^\n]*\}\.clover-specimen-plant svg\{[^\n]*\}\n",
    """      .clover-specimen-plant{position:absolute;left:7px;right:7px;top:0;height:86px;transform:rotate(-1.25deg);pointer-events:none}.clover-specimen-plant .ca-monthly-clover-svg,.clover-specimen-plant>svg,.clover-specimen-plant>img{display:block;width:100%;height:100%;max-width:none;margin:0;object-fit:contain;overflow:visible;filter:drop-shadow(0 4px 4px rgba(47,106,53,.12))}.clover-specimen-plant-fallback>img{object-fit:contain}
""",
    "plant css",
)

old_mobile = ".clover-specimen-plant{left:4px;right:4px;top:0;height:94px;transform:rotate(-2deg)}"
new_mobile = ".clover-specimen-plant{left:5px;right:5px;top:0;height:88px;transform:rotate(-1.25deg)}"
if old_mobile not in text:
    raise SystemExit("mobile plant css: expected source fragment not found")
text = text.replace(old_mobile, new_mobile, 1)

sub_once(
    r"^  function startGardenDrops\(section,selector\)\{.*?^  function replayGardenTest\(section\)\{",
    """  function startGardenDrops(section,selector){
    if(!section)return;
    const items=[...section.querySelectorAll(selector||\".clover-specimen.is-drop-pending\")];
    items.forEach((el,i)=>{
      el.classList.remove(\"is-dropping\",\"is-drop-pending\");
      el.style.animationDelay=\"\";
      void el.getBoundingClientRect();
      el.classList.add(\"is-drop-pending\");
      setTimeout(()=>{
        if(!el.isConnected)return;
        el.classList.remove(\"is-drop-pending\");
        el.style.animationDelay=(i*.12)+\"s\";
        el.classList.add(\"is-dropping\");
        el.addEventListener(\"animationend\",()=>{
          el.classList.remove(\"is-dropping\");
          el.style.animationDelay=\"\";
        },{once:true});
      },i*120);
    });
  }

  function replayGardenTest(section){""",
    "startGardenDrops",
)

sub_once(
    r"^  function armGardenViewportDrop\(section\)\{.*?^  function seenState\(uid,snapshots\)\{",
    """  function armGardenViewportDrop(section){
    if(!section)return;
    const pending=section.querySelector(\".clover-specimen.is-drop-pending\");
    if(!pending)return;

    const target=section.querySelector(\".clover-year-sheet\")||section;
    let inView=false;
    let idleTimer=0;
    let observer=null;
    let finished=false;

    const clearIdle=()=>{
      if(idleTimer){clearTimeout(idleTimer);idleTimer=0}
    };
    const cleanup=()=>{
      clearIdle();
      if(observer)observer.disconnect();
      window.removeEventListener(\"scroll\",onScroll);
    };
    const fire=()=>{
      if(finished||!section.isConnected)return;
      finished=true;
      cleanup();
      startGardenDrops(section);
    };
    const armIdle=()=>{
      clearIdle();
      if(!inView||finished)return;
      idleTimer=setTimeout(fire,950);
    };
    const onScroll=()=>{
      if(!inView||finished)return;
      armIdle();
    };

    if(!(\"IntersectionObserver\" in window)){
      inView=true;
      window.addEventListener(\"scroll\",onScroll,{passive:true});
      armIdle();
      return;
    }

    observer=new IntersectionObserver(entries=>{
      const visible=entries.some(entry=>entry.isIntersecting&&entry.intersectionRatio>=.30);
      if(visible===inView){
        if(visible)armIdle();
        return;
      }
      inView=visible;
      if(inView)armIdle();
      else clearIdle();
    },{threshold:[0,.25,.30,.35,.5],rootMargin:\"0px 0px -4% 0px\"});
    observer.observe(target);
    window.addEventListener(\"scroll\",onScroll,{passive:true});
  }

  function seenState(uid,snapshots){""",
    "armGardenViewportDrop",
)

sub_once(
    r"^  function specimenPlantSvg\(stages,index\)\{.*?^  function specimenHtml\(s,communityName,isNew,index\)\{",
    """  function specimenPlantSvg(stages,index){
    const normalized={
      host:clampStage(stages[0]),
      join:clampStage(stages[1]),
      exchange:clampStage(stages[2]),
      continue:clampStage(stages[3])
    };
    const monthly=window.CAMonthlyClover;
    if(monthly&&typeof monthly.svg===\"function\"){
      if(typeof monthly.ensureStyle===\"function\")monthly.ensureStyle();
      const markup=monthly.svg(normalized).replace('role=\"img\" aria-label=\"今月のClover\"','aria-hidden=\"true\" focusable=\"false\"');
      return '<span class=\"clover-specimen-plant\" aria-hidden=\"true\">'+markup+'</span>';
    }
    return '<span class=\"clover-specimen-plant clover-specimen-plant-fallback\" aria-hidden=\"true\"><img src=\"./assets/clover-official-b.svg\" alt=\"\" draggable=\"false\"></span>';
  }

  function specimenHtml(s,communityName,isNew,index){""",
    "specimenPlantSvg",
)

sub_once(
    r"^  function specimenHtml\(s,communityName,isNew,index\)\{.*?^  function stageDots\(stage\)\{",
    """  function specimenHtml(s,communityName,isNew,index){
    const d=new Date(s.month_start+\"T00:00:00\");
    const month=Math.max(1,Math.min(12,d.getMonth()+1));
    const slot=SLOT_LAYOUT[month-1];
    const seed=snapshotKey(s);
    const x=(slot[0]+jitter(seed+\"x\",2.5)).toFixed(2)+\"%\";
    const y=(slot[1]+jitter(seed+\"y\",2.1)).toFixed(2)+\"%\";
    const rot=(slot[2]+jitter(seed+\"r\",3.2)).toFixed(2)+\"deg\";
    const dropDuration=(1.90+(hash(seed+\"d\")%50)/100).toFixed(2)+\"s\";
    const dropX=(jitter(seed+\"drop\",12)).toFixed(1)+\"px\";
    const swayA=(jitter(seed+\"sa\",9)).toFixed(1)+\"px\";
    const swayB=(jitter(seed+\"sb\",6)).toFixed(1)+\"px\";
    const swayC=(jitter(seed+\"sc\",3)).toFixed(1)+\"px\";
    const slideX=((hash(seed+\"slide\")%2===0?-1:1)*(1+(hash(seed+\"slide2\")%11)/10)).toFixed(1)+\"px\";
    const shuffleX=(jitter(seed+\"sx\",8)).toFixed(1)+\"px\";
    const shuffleY=(jitter(seed+\"sy\",6)).toFixed(1)+\"px\";
    const shuffleR=(jitter(seed+\"sr\",3.5)).toFixed(1)+\"deg\";
    const stages=[s.host_stage,s.join_stage,s.exchange_stage,s.continue_stage].map(clampStage);
    const plant=specimenPlantSvg(stages,index);
    return '<button type=\"button\" class=\"clover-specimen'+(isNew?' is-drop-pending':'')+'\" data-snapshot-index=\"'+index+'\"'+(s._test?' data-test-preview=\"1\"':'')+' style=\"--x:'+x+';--y:'+y+';--rot:'+rot+';--z:'+(10+month)+';--drop-duration:'+dropDuration+';--drop-x:'+dropX+';--sway-a:'+swayA+';--sway-b:'+swayB+';--sway-c:'+swayC+';--slide-x:'+slideX+';--shuffle-x:'+shuffleX+';--shuffle-y:'+shuffleY+';--shuffle-r:'+shuffleR+'\" aria-label=\"'+esc(month+'月のCloverを開く')+'\">'+plant+'<span class=\"clover-specimen-tag\"><span class=\"clover-specimen-month\">'+month+'月'+(s._test?' TEST':'')+'</span><span class=\"clover-specimen-name\">'+esc(communityName||\"Community\")+'</span></span></button>';
  }

  function stageDots(stage){""",
    "specimenHtml",
)

path.write_text(text, encoding="utf-8")
