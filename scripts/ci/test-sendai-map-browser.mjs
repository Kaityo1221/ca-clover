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
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
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
  assert.equal(await page.locator('dialog:visible').count(),0);
  assert.equal(await page.locator('iframe').count(),0);
  assert.equal(calls.length,0,'No map/API load before icon is pressed');
  assert.equal((await page.locator('[data-open]').boundingBox()).width,44);
  await page.click('[data-open]');
  try { await page.waitForFunction(()=>document.querySelector('[data-status]').textContent==='作戦MAPを表示しています。'); }
  catch(error) { console.error({role,status:await page.locator('[data-status]').textContent(),calls,frames:page.frames().map(f=>f.url()),received:await page.frames().find(f=>f.url().includes('cloverViewer'))?.evaluate(()=>window.received)}); throw error; }
  const bounds=await page.locator('dialog').boundingBox();
  assert.equal(bounds.width,390);assert.equal(bounds.height,844);
  assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden');
  const frame=page.frames().find(f=>f.url().includes('cloverViewer'));
  assert.equal(await frame.evaluate(()=>received.workspace.current),'B');
  assert.equal(await page.locator('iframe').getAttribute('sandbox'),'allow-scripts allow-same-origin');
  if(role==='admin'){
   assert.equal(await page.locator('[data-admin]').isVisible(),false);
   await page.click('[data-manage]');
   await page.locator('[data-file]').setInputFiles({name:'selected.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...workspace,caRoster:[{name:'private'}]}))});
   assert.match(await page.locator('[data-file-name]').textContent(),/selected.json/);
   reject=true;await page.click('[data-publish]');await page.waitForFunction(()=>document.querySelector('[data-status]').textContent.startsWith('登録失敗：'));
   assert.match(await page.locator('[data-file-name]').textContent(),/selected.json/);
   reject=false;await page.click('[data-publish]');await page.waitForFunction(()=>document.querySelector('[data-status]').textContent.includes('登録・読み戻し確認が完了'));
   assert.equal(stored.caRoster,undefined);
  }
  // Closing destroys the iframe, stops playback and restores focus/scroll.
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('dialog:visible').count(),0);
  assert.equal(await page.locator('iframe').count(),0);
  assert.equal(await page.evaluate(()=>document.body.style.overflow),'');
  assert.equal(await page.locator('[data-open]').evaluate(el=>document.activeElement===el),true);
  await page.click('[data-open]');
  await page.waitForFunction(()=>document.querySelector('iframe'));
  // Short drag snaps back, long downward drag dismisses; iframe gestures never reach this handle.
  const handle=await page.locator('[data-drag]').boundingBox();
  await page.mouse.move(handle.x+55,handle.y+20);await page.mouse.down();await page.mouse.move(handle.x+55,handle.y+55);await page.mouse.up();
  assert.equal(await page.locator('dialog').evaluate(el=>el.open),true);
  await page.mouse.move(handle.x+55,handle.y+20);await page.mouse.down();await page.mouse.move(handle.x+55,handle.y+155,{steps:5});await page.mouse.up();
  assert.equal(await page.locator('dialog:visible').count(),0);
  assert.equal(await page.locator('iframe').count(),0);
  await page.click('[data-open]');await page.waitForFunction(()=>document.querySelector('iframe'));
  // Publishing elsewhere is detected on the next 30-second poll, but does not
  // replace the active iframe or rewind ongoing playback.
  const oldFrame=page.locator('iframe');
  await oldFrame.evaluate(el=>el.dataset.playbackMarker='still-playing');
  stored={version:2,current:'B',plans:{B:{squads:[{id:'updated'}]}}};
  await page.clock.fastForward(30_001);
  await page.waitForFunction(()=>!document.querySelector('[data-update]').hidden);
  assert.equal(await oldFrame.evaluate(el=>el.dataset.playbackMarker),'still-playing');
  assert.equal(await page.locator('iframe').count(),1);
  assert.equal(await page.locator('[data-apply-update]').isVisible(),true);
  await page.click('[data-apply-update]');
  await page.waitForFunction(()=>document.querySelector('[data-update]').hidden);
  await page.waitForFunction(()=>document.querySelector('iframe') && document.querySelector('iframe').dataset.playbackMarker!=='still-playing');
  await page.frames().find(frame=>frame.url().includes('cloverViewer')).waitForFunction(()=>window.received?.workspace?.plans?.B?.squads?.[0]?.id==='updated');
  assert.equal(await page.locator('iframe').count(),1);
  reject=true;await page.clock.fastForward(30_001);await page.waitForFunction(()=>!document.querySelector('iframe'));
  assert.ok(calls.filter(method=>method==='GET').length>=3);
  await page.evaluate(()=>window.leave());assert.equal(await page.locator('#host *').count(),0);
  assert.equal(await page.locator('dialog').count(),0);
  assert.equal(await page.evaluate(()=>document.body.style.overflow),'');
  assert.equal(await page.evaluate(()=>localStorage.length),0);
  await context.close();
 }
 console.log('Pages Sendai browser PASS: admin/ca/pending/anonymous, upload retry/roundtrip, fullscreen sheet, swipe/Escape/reopen/focus, iframe handshake, revocation, cleanup');
} finally {await browser.close();}
