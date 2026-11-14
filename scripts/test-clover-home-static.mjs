// Global top-left Clover is the single home navigation across 15 Pages HTML files.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const pages=["docs/index.html","docs/admin.html","docs/admin-stamp-events.html","docs/changelog.html","docs/clover-monthly-test.html","docs/map.html","docs/new-ca-test/index.html","docs/stamp-bulk.html","docs/stamp-events.html","docs/stamp-exchange-community.html","docs/stamp-exchange-stats.html","docs/stamp-exchange.html","docs/stamp-kanto.html","docs/stamp-rally.html","docs/suzuki-pm-revolution.html"];
const get=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
let checks=0;
function check(name,assertion){assert.ok(assertion,name);checks++;console.log('PASS '+name);}
for(const path of pages){
 const src=get(path),rel=path.startsWith('docs/new-ca-test/')?'../':'./';
 check(path+' has common stylesheet',src.includes('<link rel="stylesheet" href="'+rel+'clover-global-home.css?v=20261113-home1">'));
 check(path+' has common script',src.includes('<script src="'+rel+'clover-global-home.js?v=20261113-home1"></script>'));
 check(path+' asset includes exactly once',(src.match(/clover-global-home\.js\?v=20261113-home1/g)||[]).length===1);
}
const index=get('docs/index.html');
check('right My Community navigation removed',index.includes('const items=[]; // The top-left Clover is the My Community home action.')&&!index.includes('const items=[["my","My Community"]];'));
check('account still reachable via Settings',index.includes("onAccount:function(){go('account')}")&&index.includes('if(v==="account"){renderAccount();return}'));
check('settings and profile photo remain enabled',index.includes('id="mySettingsButton"')&&index.includes('CA_PROFILE_PHOTO_UPLOAD_ENABLED = true'));
check('administrator navigation preserved',index.includes('items.push(["zoroark-ideas","🦊 お題メモ"])')&&index.includes('admin.html?v=20260921-1815'));
const shared=get('docs/clover-global-home.js');
new Function(shared);
check('universal link provides accessible name',shared.includes('data-ca-home-link')&&shared.includes('aria-label')&&shared.includes('index.html#my'));
check('existing logos reused and fallback added',shared.includes('body > header .logo')&&shared.includes('ca-home-icon')&&shared.includes('ca-home-row'));
check('fullscreen game has safe alternate position',shared.includes('suzuki-pm-revolution.html')&&get('docs/clover-global-home.css').includes('top:calc(54px + env(safe-area-inset-top))'));
check('nested demo paths resolved from asset URL',shared.includes("new URL('index.html#my',asset.src)")&&get('docs/new-ca-test/index.html').includes('../clover-global-home.js'));
const minigames=get('docs/community-minigames-placeholder.js');
new Function(minigames);
check('mini-games avoids history.back() entirely',!minigames.includes('history.back()'));
check('mini-games hub returns to fixed My Community URL',minigames.includes('function returnToMyCommunity()')&&minigames.includes('url.searchParams.delete("caMini")')&&minigames.includes('url.hash="my"'));
check('list Back always returns to hub',minigames.includes('setMiniHistory("hub",true);renderHub()'));
check('shared Clover click closes mini-games overlay',minigames.includes('[data-ca-home-link], #nav [data-go="my"]'));
check('cache-busted mini-games script on Safari',get('docs/home-clover.js').includes('community-minigames-placeholder.js?v=20261114-nav1')&&index.includes('home-clover.js?v=20261114-minigames-nav1'));

check('My Community mini-game entry is native and role-gated',
  index.includes('const miniGamesEntry=(profile.role==="admin"||profile.role==="ca")')
  && index.includes('href="./index.html?caMini=hub#my"')
  && index.includes("const myHeading="));
check('mini-game recovery uses a CA-only home marker',
  minigames.includes('app.querySelector("#sendaiMapHost")')
  && minigames.includes('if(timer)return;')
  && minigames.includes('timer=0;reconcileMiniView()'));
let observerCallback=null;
let scheduledCallback=null;
let scheduledCount=0;
runInNewContext(minigames,{
  document:{getElementById:()=>null,createElement:()=>({}),
    head:{appendChild(){}},body:{},readyState:"complete",addEventListener(){}},
  window:{addEventListener(){}},
  location:{hash:"#my",href:"https://example.test/index.html#my"},
  MutationObserver:class {constructor(callback){observerCallback=callback} observe(){}},
  setTimeout(callback){scheduledCount++;scheduledCallback=callback;return scheduledCount},
  clearTimeout(){throw Error("A pending reconcile timer must never be postponed")},
  URL,
});
check('mini-game observer schedules initial reconciliation',
  scheduledCount===1 && typeof observerCallback==="function");
for(let i=0;i<20;i++)observerCallback();
check('rapid My Community changes cannot starve navigation',scheduledCount===1);
scheduledCallback();observerCallback();
check('mini-game observer re-arms after run',scheduledCount===2);

console.log('CLOVER GLOBAL HOME STATIC PASS '+checks+'/'+checks);
