import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require = createRequire(new URL('./participant-runtime/package.json',import.meta.url));
const {chromium} = require('playwright');
const source = readFileSync(new URL('../../docs/sendai-map.mjs',import.meta.url),'utf8');
const browser = await chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
const workspace = {version:2,current:'B',plans:{B:{squads:[]}}};
try {
 for (const role of ['admin','ca','pending',null]) {
  const context=await browser.newContext({viewport:{width:390,height:844}});
  const page=await context.newPage(); const calls=[]; let stored=workspace, reject=false;
  await page.clock.install({time:new Date('2026-10-26T11:00:00Z')});
  await page.route('**/*',async route=>{
   const req=route.request(),url=req.url();
   if(url.includes('/sendai-map.mjs'))return route.fulfill({contentType:'text/javascript',body:source});
   if(url==='https://ca-clover.vercel.app/api/sendai-map'){
    calls.push(req.method());
    assert.equal(req.headers().authorization,'Bearer synthetic-token');
    const headers={'Access-Control-Allow-Origin':'https://kaityo1221.github.io','Content-Type':'application/json'};
    if(reject)return route.fulfill({status:403,headers,body:JSON.stringify({error:'承認済みCA専用です。'})});
    if(req.method()==='POST')stored=JSON.parse(req.postData());
    return route.fulfill({status:200,headers,body:req.method()==='HEAD'?'':JSON.stringify(req.method()==='POST'?{ok:true}:{workspace:stored})});
   }
   if(url.startsWith('https://meetup-operations-simulator.vercel.app/'))return route.fulfill({contentType:'text/html',body:`<button id="play">再生</button><script>addEventListener('message',e=>{if(e.origin!=='https://kaityo1221.github.io')return;window.received=e.data;parent.postMessage({type:'sendai:loaded'},e.origin)});</script>`});
   if(url==='https://kaityo1221.github.io/ca-clover/')return route.fulfill({contentType:'text/html',body:`<div id="host"></div><script type="module">import {mountSendaiMap} from './sendai-map.mjs';window.identity={userId:${role?'"synthetic-user"':'null'},role:${JSON.stringify(role)}};window.leave=mountSendaiMap({host:document.getElementById('host'),getIdentity:()=>window.identity,client:{auth:{getSession:async()=>({data:{session:{access_token:'synthetic-token',user:{id:'synthetic-user'}}}})}}});window.ready=true;</script>`});
   return route.abort();
  });
  await page.goto('https://kaityo1221.github.io/ca-clover/'); await page.waitForFunction(()=>window.ready);
  if(role==='pending'||!role){assert.equal(await page.locator('button').count(),0);assert.equal(calls.length,0);await context.close();continue;}
  assert.equal(await page.locator('[data-file]').count(),role==='admin'?1:0);
  await page.click('[data-open]');
  try { await page.waitForFunction(()=>document.querySelector('[data-status]').textContent==='作戦MAPを表示しています。'); }
  catch(error) { console.error({role,status:await page.locator('[data-status]').textContent(),calls,frames:page.frames().map(f=>f.url()),received:await page.frames().find(f=>f.url().includes('cloverViewer'))?.evaluate(()=>window.received)}); throw error; }
  const frame=page.frames().find(f=>f.url().includes('cloverViewer'));
  assert.equal(await frame.evaluate(()=>received.workspace.current),'B');
  assert.equal(await page.locator('iframe').getAttribute('sandbox'),'allow-scripts allow-same-origin');
  if(role==='admin'){
   await page.locator('[data-file]').setInputFiles({name:'selected.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...workspace,caRoster:[{name:'private'}]}))});
   assert.match(await page.locator('[data-file-name]').textContent(),/selected.json/);
   reject=true;await page.click('[data-publish]');await page.waitForFunction(()=>document.querySelector('[data-status]').textContent.startsWith('登録失敗：'));
   assert.match(await page.locator('[data-file-name]').textContent(),/selected.json/);
   reject=false;await page.click('[data-publish]');await page.waitForFunction(()=>document.querySelector('[data-status]').textContent.includes('登録・読み戻し確認が完了'));
   assert.equal(stored.caRoster,undefined);
  }
  reject=true;await page.clock.fastForward(30_001);await page.waitForFunction(()=>!document.querySelector('iframe'));
  assert.ok(calls.includes('HEAD'));
  await page.evaluate(()=>window.leave());assert.equal(await page.locator('#host *').count(),0);
  assert.equal(await page.evaluate(()=>localStorage.length),0);
  await context.close();
 }
 console.log('Pages Sendai browser PASS: admin/ca/pending/anonymous, upload retry/roundtrip, iframe handshake, revocation, cleanup');
} finally {await browser.close();}
