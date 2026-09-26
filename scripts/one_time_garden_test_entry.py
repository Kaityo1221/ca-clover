from pathlib import Path

path = Path('docs/clover-garden.js')
text = path.read_text(encoding='utf-8')

old_css = '.clover-garden-testbar{position:relative;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:12px;padding:9px 10px;border:1px solid #c7df9b;border-radius:14px;background:rgba(244,253,229,.92);color:#55713d;font-size:10px;font-weight:900}.clover-garden-replay{flex:0 0 auto;border:1px solid #b7d58a;border-radius:999px;background:#fffef8;color:#4f6c37;padding:6px 9px;font-size:10px;font-weight:950}'
new_css = '.clover-garden-testbar{position:relative;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:12px;padding:9px 10px;border:1px solid #c7df9b;border-radius:14px;background:rgba(244,253,229,.92);color:#55713d;font-size:10px;font-weight:900}.clover-garden-test-actions{display:flex;align-items:center;gap:6px;flex:0 0 auto}.clover-garden-replay{flex:0 0 auto;border:1px solid #b7d58a;border-radius:999px;background:#fffef8;color:#4f6c37;padding:6px 9px;font-size:10px;font-weight:950}.clover-garden-test-open{background:#eaffbf;border-color:#9fc85d;color:#3f641f}'
if old_css not in text:
    raise SystemExit('testbar css source not found')
text = text.replace(old_css, new_css, 1)

anchor = '''  function replayGardenTest(section){
    startGardenDrops(section,".clover-specimen[data-test-preview='1']");
  }

'''
insert = '''  function replayGardenTest(section){
    startGardenDrops(section,".clover-specimen[data-test-preview='1']");
  }

  function hasAdminAccess(){
    return [...document.querySelectorAll("#nav button,#nav a")].some(el=>String(el.textContent||"").includes("管理画面"));
  }

  function setGardenTestMode(enabled){
    try{sessionStorage.setItem("ca-clover-garden-jump","1")}catch(_){}
    const url=new URL(location.href);
    if(enabled)url.searchParams.set("gardenTest","1");
    else url.searchParams.delete("gardenTest");
    location.assign(url.toString());
  }

  function restoreGardenViewport(section){
    let jump=false;
    try{
      jump=sessionStorage.getItem("ca-clover-garden-jump")==="1";
      if(jump)sessionStorage.removeItem("ca-clover-garden-jump");
    }catch(_){}
    if(!jump)return;
    setTimeout(()=>{
      if(section&&section.isConnected)section.scrollIntoView({behavior:"smooth",block:"start"});
    },120);
  }

'''
if anchor not in text:
    raise SystemExit('replay anchor not found')
text = text.replace(anchor, insert, 1)

old_testbar = '''    const testbar=GARDEN_TEST_MODE?'<div class="clover-garden-testbar"><span>🧪 Garden TEST表示です。正式な月末保存には影響しません。</span><button type="button" class="clover-garden-replay" data-garden-replay>演出をもう一度</button></div>':'';
'''
new_testbar = '''    const testbar=GARDEN_TEST_MODE
      ?'<div class="clover-garden-testbar"><span>🧪 Garden TEST表示です。正式な月末保存には影響しません。</span><span class="clover-garden-test-actions"><button type="button" class="clover-garden-replay" data-garden-replay>演出をもう一度</button><button type="button" class="clover-garden-replay" data-garden-test-close>TEST終了</button></span></div>'
      :(hasAdminAccess()?'<div class="clover-garden-testbar"><span>🧪 今月のCloverでGardenの落下演出を確認できます。</span><button type="button" class="clover-garden-replay clover-garden-test-open" data-garden-test-open>Garden TEST</button></div>':'');
'''
if old_testbar not in text:
    raise SystemExit('testbar render source not found')
text = text.replace(old_testbar, new_testbar, 1)

old_bind = '''    section.querySelector("[data-garden-replay]")?.addEventListener("click",()=>replayGardenTest(section));

    if(!window.matchMedia||!window.matchMedia("(prefers-reduced-motion: reduce)").matches){
'''
new_bind = '''    section.querySelector("[data-garden-replay]")?.addEventListener("click",()=>replayGardenTest(section));
    section.querySelector("[data-garden-test-open]")?.addEventListener("click",()=>setGardenTestMode(true));
    section.querySelector("[data-garden-test-close]")?.addEventListener("click",()=>setGardenTestMode(false));

    if(!window.matchMedia||!window.matchMedia("(prefers-reduced-motion: reduce)").matches){
'''
if old_bind not in text:
    raise SystemExit('event bind source not found')
text = text.replace(old_bind, new_bind, 1)

old_tail = '''    maybeSpawnLuckyClover(section);
  }
'''
new_tail = '''    maybeSpawnLuckyClover(section);
    restoreGardenViewport(section);
  }
'''
if old_tail not in text:
    raise SystemExit('render tail source not found')
text = text.replace(old_tail, new_tail, 1)

path.write_text(text, encoding='utf-8')

index = Path('docs/index.html')
html = index.read_text(encoding='utf-8')
old_ver = './clover-garden.js?v=20260926-garden-polish1'
new_ver = './clover-garden.js?v=20260926-garden-test-entry1'
if old_ver not in html:
    raise SystemExit('Garden script cache key not found')
index.write_text(html.replace(old_ver, new_ver, 1), encoding='utf-8')
