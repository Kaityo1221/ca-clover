// Full real Pages HTML + module under synthetic SDK/HTTP, mobile WebKit only.
// No real origin, names, tokens or network are used.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const runtime=resolve(process.env.PLAYWRIGHT_RUNTIME||'scripts/ci/participant-runtime/node_modules');
const require=createRequire(join(runtime,'playwright/package.json'));
const {webkit}=require('playwright');
const root=fileURLToPath(new URL('../../',import.meta.url));
const index=readFileSync(join(root,'docs/index.html'),'utf8');
const origin='https://fixture.invalid',actor='00000000-0000-0000-0000-000000000001',community='00000000-0000-0000-0000-000000000002',meetup='00000000-0000-0000-0000-000000000003';
const setup=({role='ca',d=true,own=true,permissionFails=false}={})=>String.raw`
window.__d=${JSON.stringify(d)};window.__own=${JSON.stringify(own)};window.__permissionFails=${JSON.stringify(permissionFails)};window.__calls=[];
const id=${JSON.stringify(actor)},community=${JSON.stringify(community)},meetup=${JSON.stringify(meetup)};
const session={user:{id,email:'synthetic@example.invalid'},access_token:'synthetic-jwt'};
const profile={role:${JSON.stringify(role)},niantic_id:'synthetic-ca',email:'synthetic@example.invalid'};
const fixture={
 profiles:[profile],community_memberships:[{community_id:community}],user_permissions:[{permission_code:'D'}],
 communities:[{id:community,name:'合成Community',prefecture:'東京都',member_count:100,coverage:'complete'}],
 community_ca_members:[],ca_members:[],community_member_snapshots:[],community_access_requests:[],
 meetups:[{id:meetup,title:'合成Meetup🍀',starts_at:'2026-10-16T06:00:00Z',ends_at:'2026-10-16T09:00:00Z',location:'合成会場',details:'合成データ',is_ca_meetup:true,rsvp_count:40,checkin_count:22}],
};
const client={auth:{getSession:async()=>({data:{session},error:null}),onAuthStateChange(cb){window.__authChange=cb;return {data:{subscription:{unsubscribe(){}}}}},signOut:async()=>({error:null})},
 from(table){const filters=[];const q={select(){return q},eq(k,v){filters.push([k,v]);return q},in(){return q},order(){return q},limit(){return q},gte(){return q},lte(){return q},gt(){return q},
  then(ok,bad){let data=fixture[table]??[],error=null;
   if(table==='user_permissions'){if(window.__permissionFails)error={message:'synthetic'};data=window.__d?fixture[table]:[];}
   if(table==='community_memberships')data=window.__own?fixture[table]:[];
   return Promise.resolve({data,error}).then(ok,bad)},
  async maybeSingle(){const r=await q;return {...r,data:r.data[0]??null}}};return q;},
 rpc:async()=>({data:[],error:null}),functions:{invoke:async()=>({data:{},error:null})}};
window.supabase={createClient:()=>client};
`;
let groups=0;
const browser=await webkit.launch({headless:true});
async function fixture(options={}){
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true,acceptDownloads:true});
 const page=await context.newPage();const calls=[],errors=[];let code=200,waitForExport;
 await page.addInitScript({content:setup(options)});page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{
   const u=new URL(route.request().url());
   if(u.hostname==='wgiittrvgtiosogyhfcl.supabase.co'&&u.pathname==='/functions/v1/participant-export'){
     calls.push(JSON.parse(route.request().postData()));if(waitForExport)await waitForExport;
     try{await route.fulfill({status:code,headers:{'access-control-allow-origin':'*','access-control-expose-headers':'X-CA-Clover-Checkin-Count, X-CA-Clover-Verified-At, X-CA-Clover-CSV-Version',
       'content-type':code===200?'text/csv; charset=utf-8':'application/json','x-ca-clover-csv-version':'2','x-ca-clover-checkin-count':'29','x-ca-clover-verified-at':'2026-10-17T00:00:00.000Z'},body:code===200?'\uFEFF"表示名","抽選番号"\r\n"合成参加者","v1-0123456789abcdef0123456789abcdef"\r\n':JSON.stringify({error:code===409?'STALE_COUNT':'FORBIDDEN'})});}catch{/* browser abort is expected in cancellation scenario */}
     return;
   }
   if(u.hostname===origin.slice(8)){
     const path=u.pathname==='/'?'index.html':u.pathname.slice(1);
     if(path==='index.html'){await route.fulfill({contentType:'text/html',body:index});return;}
     if(/^participant-export(?:-ui\.mjs|\/(client-adapter|csv-click-guard|engine-policy)\.mjs)$/.test(path)){
       await route.fulfill({contentType:'application/javascript',body:readFileSync(join(root,'docs',path),'utf8')});return;
     }
   }
   await route.abort();
 });
 await page.goto(origin+'/#community:'+community,{waitUntil:'domcontentloaded'});
 await page.getByRole('heading',{name:options.own===false?'このCommunityは表示できません':'合成Community'}).waitFor();
 return {page,context,calls,errors,setStatus:n=>code=n,hold(){let release;waitForExport=new Promise(r=>{release=r});return ()=>{waitForExport=undefined;release();}}};
}
function pass(name){groups++;console.log('PASS '+name)}
try{
 for(const opts of [{d:false},{role:'admin'},{permissionFails:true}]){
   const f=await fixture(opts);await f.page.waitForTimeout(100);assert.equal(await f.page.locator('[data-csv-meetup]').count(),0);
   assert.equal(await f.page.locator('[data-meetup-index]').count(),2);assert.equal(f.calls.length,0);assert.deepEqual(f.errors,[]);await f.context.close();
 }pass('Dなし/ADMIN/権限読込エラーでCSV非表示、既存Meetupカード継続');
 const f=await fixture();await f.page.locator('[data-csv-meetup]').first().waitFor();
 assert.equal(await f.page.locator('[data-csv-meetup]').count(),2);assert.equal(f.calls.length,0);pass('D+本人Communityのみボタン、表示だけでは名簿取得しない');
 await f.page.locator('[data-csv-meetup]').first().click();await f.page.locator('dialog').waitFor();
 assert.equal(await f.page.locator('select[name=purpose] option').count(),4);assert.equal(await f.page.locator('[data-csv-meetup]').count(),3); // two buttons + dialog heading marker
 await f.page.locator('select[name=purpose]').selectOption('other');assert.equal(await f.page.locator('textarea[name=note]').getAttribute('required'),'');
 await f.page.locator('[data-csv-submit]').click();assert.equal(f.calls.length,0);pass('目的4択、その他の補足必須、入力前POSTなし');
 await f.page.locator('textarea[name=note]').fill('合成ミニゲームの表彰');
 const release=f.hold();
 await f.page.locator('form').evaluate(form=>{form.requestSubmit();form.requestSubmit();});
 await f.page.waitForFunction(()=>document.querySelector('[data-csv-submit]')?.disabled);
 assert.equal(f.calls.length,1);assert.equal(await f.page.locator('[data-csv-submit]').isDisabled(),true);
 assert.deepEqual(f.calls[0],{meetupId:meetup,purpose:'other',note:'合成ミニゲームの表彰'});pass('目的申告から実POST、連打でも1要求');
 const downloading=f.page.waitForEvent('download');release();const download=await downloading;
 assert.equal(download.suggestedFilename(),'participants-'+meetup+'.csv');
 await f.page.getByText('人数確認済み 29人',{exact:false}).waitFor();
 const content=readFileSync(await download.path(),'utf8');assert(content.includes('表示名'));assert(content.includes('抽選番号'));assert(!content.includes('raw-person'));
 assert.equal(await f.page.locator('[data-csv-submit]').isDisabled(),true);pass('Safari系でCSVファイル生成、確認人数/時刻、再取得間隔');
 const width=await f.page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth,dialog:document.querySelector('dialog').getBoundingClientRect().width}));
 assert(width.document<=width.viewport+1);assert(width.dialog<=width.viewport);pass('390px画面で横はみ出しなし');
 mkdirSync('test-results/participant-ui',{recursive:true});await f.page.screenshot({path:'test-results/participant-ui/iphone-csv-verified.png',fullPage:true});
 await f.page.locator('[data-csv-close]').click();assert.equal(await f.page.locator('dialog').count(),0);assert.equal(f.calls.length,1);pass('ダイアログ閉鎖で追加要求なし');
 await f.context.close();
 const stale=await fixture();await stale.page.locator('[data-csv-meetup]').first().waitFor();stale.setStatus(409);
 await stale.page.locator('[data-csv-meetup]').first().click();await stale.page.locator('[data-csv-submit]').click();
 await stale.page.getByText('新しい参加者が反映されるまで再取得',{exact:true}).waitFor();assert.equal(stale.calls.length,1);assert(!await stale.page.getByText('人数確認済み',{exact:false}).count());pass('人数巻き戻り409で成功表示・CSV発行なし');
 await stale.context.close();
 const logout=await fixture();await logout.page.locator('[data-csv-meetup]').first().waitFor();const unblock=logout.hold();
 await logout.page.locator('[data-csv-meetup]').first().click();await logout.page.locator('[data-csv-submit]').click();
 await logout.page.evaluate(()=>window.__authChange('SIGNED_OUT',null));await logout.page.waitForFunction(()=>!document.querySelector('dialog'));
 unblock();assert(!await logout.page.locator('[data-csv-meetup]').count());assert.equal(logout.calls.length,1);pass('取得中ログアウトで中止・ダイアログとボタン除去');await logout.context.close();
 const foreign=await fixture({own:false});assert.equal(await foreign.page.locator('[data-csv-meetup]').count(),0);assert.equal(foreign.calls.length,0);pass('所属外Communityの表示とCSV取得を拒否');await foreign.context.close();
 // Test the module's own membership guard without relying on the page's earlier denial screen.
 const revoked=await fixture();await revoked.page.locator('[data-csv-meetup]').first().waitFor();
 await revoked.page.evaluate(()=>{window.__d=false;location.hash='my'});await revoked.page.waitForTimeout(50);
 await revoked.page.evaluate(c=>location.hash='community:'+c,community);await revoked.page.getByRole('heading',{name:'合成Community'}).waitFor();
 await revoked.page.waitForTimeout(50);assert.equal(await revoked.page.locator('[data-csv-meetup]').count(),0);pass('D解除後の再表示で導線消去');assert.deepEqual(revoked.errors,[]);await revoked.context.close();
 console.log(`PASS ${groups} mobile WebKit participant UI groups; synthetic only`);
}finally{await browser.close();}
