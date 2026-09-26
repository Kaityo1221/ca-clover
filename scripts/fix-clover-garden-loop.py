from pathlib import Path

p=Path('docs/clover-garden.js')
s=p.read_text(encoding='utf-8')

def rep(old,new,label):
    global s
    if old not in s:
        raise SystemExit(f'pattern not found: {label}')
    s=s.replace(old,new,1)

rep('  let running=false;\n  let renderSeq=0;','  let running=false;\n  let renderSeq=0;\n  let lastRoot=null;','state guard')
rep('    const root=document.getElementById(ROOT_ID);\n    if(!root||root.dataset.ready!=="1")return;','    const root=document.getElementById(ROOT_ID);\n    if(!root||root.dataset.ready!=="1")return;\n    if(root===lastRoot&&root.querySelector("#"+GARDEN_ID))return;','run guard')
rep('      if(liveRoot&&liveRoot.dataset.ready==="1")renderGarden(liveRoot,refreshed,communityMap,new Date());','      if(liveRoot&&liveRoot.dataset.ready==="1"){\n        renderGarden(liveRoot,refreshed,communityMap,new Date());\n        lastRoot=liveRoot;\n      }','remember root')
rep('  window.addEventListener("hashchange",()=>{renderSeq++;document.getElementById(GARDEN_ID)?.remove();schedule()});','  window.addEventListener("hashchange",()=>{renderSeq++;lastRoot=null;document.getElementById(GARDEN_ID)?.remove();schedule()});','hash reset')
p.write_text(s,encoding='utf-8')
