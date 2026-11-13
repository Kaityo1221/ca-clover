// Global top-left Clover is the single home navigation across 15 Pages HTML files.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
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
console.log('CLOVER GLOBAL HOME STATIC PASS '+checks+'/'+checks);
