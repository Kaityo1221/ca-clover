from pathlib import Path


def rep(text, old, new, label):
    if old not in text:
        raise SystemExit(f"pattern not found: {label}")
    return text.replace(old, new, 1)

# Expose the already-loaded current-month models to the Garden preview.
home = Path("docs/home-clover.js")
s = home.read_text(encoding="utf-8")
s = rep(
    s,
    '      if(!models.length){root.innerHTML=\'<div class="home-clover-status">今月のCloverを読み込めませんでした。</div>\';return}\n      root.innerHTML=models.map(monthHtml).join("");',
    '      if(!models.length){root.innerHTML=\'<div class="home-clover-status">今月のCloverを読み込めませんでした。</div>\';return}\n      window.CAHomeCloverCurrent={uid:session.user.id,models};\n      root.innerHTML=models.map(monthHtml).join("");',
    "expose current Clover models",
)
home.write_text(s, encoding="utf-8")

# Add a no-write Garden test mode driven by ?gardenTest=1.
garden = Path("docs/clover-garden.js")
s = garden.read_text(encoding="utf-8")
s = rep(
    s,
    '  const LUCKY_CLOVER_CHANCE=0.005; // 0.5% per Garden view. Decorative only, never saved.\n',
    '  const LUCKY_CLOVER_CHANCE=0.005; // 0.5% per Garden view. Decorative only, never saved.\n  const GARDEN_TEST_MODE=new URLSearchParams(location.search).get("gardenTest")==="1";\n',
    "test mode constant",
)

s = rep(
    s,
    '      .clover-garden-head{position:relative;z-index:1;display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.clover-garden-title{margin:0;color:#31511f;font-size:clamp(22px,4.5vw,29px);font-weight:950;letter-spacing:-.025em}.clover-garden-sub{margin:5px 0 0;color:#7b8b73;font-size:11px;font-weight:850;line-height:1.6}.clover-garden-badge{flex:0 0 auto;border:1px solid #e2d7be;background:#fff9e9;color:#8b7659;border-radius:999px;padding:6px 10px;font-size:10px;font-weight:950;letter-spacing:.08em}\n',
    '      .clover-garden-head{position:relative;z-index:1;display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.clover-garden-title{margin:0;color:#31511f;font-size:clamp(22px,4.5vw,29px);font-weight:950;letter-spacing:-.025em}.clover-garden-sub{margin:5px 0 0;color:#7b8b73;font-size:11px;font-weight:850;line-height:1.6}.clover-garden-badge{flex:0 0 auto;border:1px solid #e2d7be;background:#fff9e9;color:#8b7659;border-radius:999px;padding:6px 10px;font-size:10px;font-weight:950;letter-spacing:.08em}.clover-garden-testbar{position:relative;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:12px;padding:9px 10px;border:1px solid #c7df9b;border-radius:14px;background:rgba(244,253,229,.92);color:#55713d;font-size:10px;font-weight:900}.clover-garden-replay{flex:0 0 auto;border:1px solid #b7d58a;border-radius:999px;background:#fffef8;color:#4f6c37;padding:6px 9px;font-size:10px;font-weight:950}\n',
    "test mode styles",
)

helper = r'''
  function currentMonthTestSnapshots(uid){
    if(!GARDEN_TEST_MODE)return [];
    const current=window.CAHomeCloverCurrent;
    if(!current||current.uid!==uid||!Array.isArray(current.models))return [];
    return current.models.map(model=>({
      id:"garden-test-"+model.community.id+"-"+monthKey(model.now||new Date()),
      owner_user_id:uid,
      community_id:model.community.id,
      month_start:monthKey(model.now||new Date()),
      meetup_count:Number(model.metrics&&model.metrics.meetups||0),
      checkin_count:Number(model.metrics&&model.metrics.checkins||0),
      exchange_count:Number(model.metrics&&model.metrics.exchanges||0),
      active_week_count:Number(model.metrics&&model.metrics.activeWeeks||0),
      host_stage:clampStage(model.stages&&model.stages.host),
      join_stage:clampStage(model.stages&&model.stages.join),
      exchange_stage:clampStage(model.stages&&model.stages.exchange),
      continue_stage:clampStage(model.stages&&model.stages.continue),
      rules_version:"TEST_PREVIEW",
      refreshed_at:new Date().toISOString(),
      _test:true
    }));
  }

  function replayGardenTest(section){
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
s = rep(
    s,
    '  function seenState(uid,snapshots){\n',
    helper + '\n  function seenState(uid,snapshots){\n',
    "test snapshot helper",
)

s = rep(
    s,
    '    const all=snapshots.map(snapshotKey);\n',
    '    const persistable=snapshots.filter(s=>!s._test);\n    const all=persistable.map(snapshotKey);\n',
    "exclude test snapshots from seen state",
)

s = rep(
    s,
    '    return new Set(fresh);\n  }\n\n  function specimenHtml(s,communityName,isNew,index){',
    '    const testKeys=snapshots.filter(s=>s._test).map(snapshotKey);\n    return new Set([...fresh,...testKeys]);\n  }\n\n  function specimenHtml(s,communityName,isNew,index){',
    "test snapshots always animate",
)

s = rep(
    s,
    '    return \'<button type="button" class="clover-specimen\'+(isNew?\' is-dropping\':\'\')+\'" data-snapshot-index="\'+index+\'" style="--x:\'+x+\';--y:\'+y+\';--rot:\'+rot+\';--z:\'+(10+month)+\';--drop-duration:\'+dropDuration+\';--drift-x:\'+driftX+\';--drift-x2:\'+driftX2+\';--drop-x:\'+dropX+\';--shuffle-x:\'+shuffleX+\';--shuffle-y:\'+shuffleY+\';--shuffle-r:\'+shuffleR+\'" aria-label="\'+esc(month+\'月のCloverを開く\')+\'">\'+plant+\'<span class="clover-specimen-tag"><span class="clover-specimen-month">\'+month+\'月</span><span class="clover-specimen-name">\'+esc(communityName||"Community")+\'</span></span></button>\';',
    '    return \'<button type="button" class="clover-specimen\'+(isNew?\' is-dropping\':\'\')+\'" data-snapshot-index="\'+index+\'"\'+(s._test?\' data-test-preview="1"\':\'\')+\' style="--x:\'+x+\';--y:\'+y+\';--rot:\'+rot+\';--z:\'+(10+month)+\';--drop-duration:\'+dropDuration+\';--drift-x:\'+driftX+\';--drift-x2:\'+driftX2+\';--drop-x:\'+dropX+\';--shuffle-x:\'+shuffleX+\';--shuffle-y:\'+shuffleY+\';--shuffle-r:\'+shuffleR+\'" aria-label="\'+esc(month+\'月のCloverを開く\')+\'">\'+plant+\'<span class="clover-specimen-tag"><span class="clover-specimen-month">\'+month+\'月\'+(s._test?\' TEST\':\'\')+\'</span><span class="clover-specimen-name">\'+esc(communityName||"Community")+\'</span></span></button>\';',
    "mark test specimen",
)

s = rep(
    s,
    '    section.innerHTML=\'<div class="clover-garden-head"><div><h2 class="clover-garden-title">🍀 Clover Garden</h2><p class="clover-garden-sub">ひと月ごとのCloverを、押し花のように1年のシートへ残していきます。</p></div><span class="clover-garden-badge">HERBARIUM</span></div>\'+body+\'<div class="clover-garden-note">過去月は、あとから同期されたMeetupがあれば再計算して更新します。</div>\';',
    '    const testbar=GARDEN_TEST_MODE?\'<div class="clover-garden-testbar"><span>🧪 Garden TEST表示です。正式な月末保存には影響しません。</span><button type="button" class="clover-garden-replay" data-garden-replay>演出をもう一度</button></div>\':\'\';\n    section.innerHTML=\'<div class="clover-garden-head"><div><h2 class="clover-garden-title">🍀 Clover Garden</h2><p class="clover-garden-sub">ひと月ごとのCloverを、押し花のように1年のシートへ残していきます。</p></div><span class="clover-garden-badge">\'+(GARDEN_TEST_MODE?\'TEST\':\'HERBARIUM\')+\'</span></div>\'+testbar+body+\'<div class="clover-garden-note">過去月は、あとから同期されたMeetupがあれば再計算して更新します。</div>\';',
    "test banner",
)

s = rep(
    s,
    '    section.querySelectorAll("[data-snapshot-index]").forEach(btn=>btn.addEventListener("click",()=>{\n      const s=snapshots[Number(btn.dataset.snapshotIndex)];\n      if(s)openSnapshotModal(s,communityMap.get(s.community_id)||"Community");\n    }));\n',
    '    section.querySelectorAll("[data-snapshot-index]").forEach(btn=>btn.addEventListener("click",()=>{\n      const s=snapshots[Number(btn.dataset.snapshotIndex)];\n      if(s)openSnapshotModal(s,communityMap.get(s.community_id)||"Community");\n    }));\n    section.querySelector("[data-garden-replay]")?.addEventListener("click",()=>replayGardenTest(section));\n',
    "replay button",
)

s = rep(
    s,
    '      const refreshed=await refreshArchives(sb,uid,ids,snapshotsResult,new Date());\n      if(seq!==renderSeq)return;\n      const communityMap=new Map(((communityResult&&communityResult.data)||[]).map(x=>[x.id,x.name]));\n      const liveRoot=document.getElementById(ROOT_ID);\n      if(liveRoot&&liveRoot.dataset.ready==="1"){\n        renderGarden(liveRoot,refreshed,communityMap,new Date(),uid);',
    '      const refreshed=await refreshArchives(sb,uid,ids,snapshotsResult,new Date());\n      if(seq!==renderSeq)return;\n      const preview=currentMonthTestSnapshots(uid);\n      const displaySnapshots=[...refreshed,...preview];\n      const communityMap=new Map(((communityResult&&communityResult.data)||[]).map(x=>[x.id,x.name]));\n      const liveRoot=document.getElementById(ROOT_ID);\n      if(liveRoot&&liveRoot.dataset.ready==="1"){\n        renderGarden(liveRoot,displaySnapshots,communityMap,new Date(),uid);',
    "inject current month preview",
)

garden.write_text(s, encoding="utf-8")

idx = Path("docs/index.html")
i = idx.read_text(encoding="utf-8")
i = rep(i, '<script src="./home-clover.js?v=20260926-stage2" defer></script>', '<script src="./home-clover.js?v=20260926-gardentest1" defer></script>', "home cache")
i = rep(i, '<script src="./clover-garden.js?v=20260926-lucky1" defer></script>', '<script src="./clover-garden.js?v=20260926-gardentest1" defer></script>', "garden cache")
idx.write_text(i, encoding="utf-8")
