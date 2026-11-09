import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve, extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

const root=resolve(fileURLToPath(new URL('../../',import.meta.url)));
const webkit= (await import('../../.qa-browser/node_modules/playwright/index.mjs')).webkit;
const server=http.createServer(async(req,res)=>{
 const path=(req.url??'/').split('?')[0];
 const routes={
  '/qa':'scripts/ci/fixtures/full-roster-webkit.html',
  '/docs/participant-export-ui.mjs':'docs/participant-export-ui.mjs',
  '/docs/participant-export/client-adapter.mjs':'docs/participant-export/client-adapter.mjs',
  '/docs/participant-export/full-roster-validate.mjs':'docs/participant-export/full-roster-validate.mjs',
  '/docs/participant-export/csv-click-guard.mjs':'docs/participant-export/csv-click-guard.mjs',
  '/docs/participant-export/engine-policy.mjs':'docs/participant-export/engine-policy.mjs'
 };
 if(!Object.hasOwn(routes,path)){res.writeHead(404);res.end('Not Found');return;}
 try{
  const bytes=await readFile(resolve(root,routes[path]));
  res.writeHead(200,{'content-type':path==='/qa'?'text/html; charset=utf-8':'application/javascript; charset=utf-8',
    'cache-control':'no-store','x-content-type-options':'nosniff'});
  res.end(bytes);
 }catch{res.writeHead(500);res.end('Fixture unavailable');}
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const port=server.address().port,base='http://127.0.0.1:'+port;
const browser=await webkit.launch({headless:true});
let failures=0;
const contexts=[];
async function caseRun(name,mode,action){
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,
  isMobile:true,hasTouch:true,locale:'ja-JP'});
 contexts.push(context);
 const page=await context.newPage();
 const browserErrors=[];
 page.on('pageerror',e=>browserErrors.push(e.message));
 try{
  await page.goto(base+'/qa?mode='+encodeURIComponent(mode),{waitUntil:'load'});
  await page.waitForFunction(()=>globalThis.qa?.ready===true);
  const qa=await page.evaluate(()=>globalThis.qa);
  assert.equal(qa.error,null);
  await action(page,qa);
  assert.deepEqual(browserErrors,[]);
  console.log('PASS',name);
 }catch(e){failures++;console.error('FAIL',name,e?.message??e);}
 finally{await context.close()}
}
async function submit(page){
 await page.locator('[data-full-roster-meetup]').click();
 await page.locator('[data-csv-submit]').click();
 await page.waitForTimeout(180);
 return await page.evaluate(()=>({saved:globalThis.qa.saved,requests:globalThis.qa.requests,
  status:document.querySelector('[data-csv-status]')?.textContent??''}));
}
try{
 await caseRun('iPhone WebKit D-authorized four-column CSV with missing DECLINED name','success',
  async(page)=>{
   assert.equal(await page.locator('[data-full-roster-meetup]').count(),1);
   const result=await submit(page);
   assert.equal(result.requests,1);
   assert.ok(result.saved?.filename?.startsWith('meetup-roster-'));
   assert.match(result.saved.text,/"username","display_name","rsvp_status","checked_in"/);
   assert.match(result.saved.text,/"","","DECLINED","FALSE"/);
   assert.equal(result.saved.text.split('\r\n').filter(Boolean).length,5);
   assert.match(result.status,/人数確認済み 4人/);
   assert.match(result.status,/辞退者 1人/);
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
   assert.equal(overflow,false,'unexpected horizontal viewport overflow');
  });
 await caseRun('iPhone WebKit missing D permission hides roster export','notD',async(page)=>{
  assert.equal(await page.locator('[data-full-roster-meetup]').count(),0);
  assert.equal(await page.evaluate(()=>globalThis.qa.saved),null);
 });
 for(const [mode,label] of [
   ['wrongCount','server count mismatch'],['wrongUnresolved','missing DECLINED count mismatch'],
   ['headerOnly','header-only partial CSV'],['noSession','invalid current session']
 ]){
  await caseRun('iPhone WebKit refuses '+label,mode,async(page)=>{
   assert.equal(await page.locator('[data-full-roster-meetup]').count(),1);
   const result=await submit(page);
   assert.equal(result.saved,null);
   if(mode==='noSession')assert.equal(result.requests,0);
   else assert.equal(result.requests,1);
  });
 }
}finally{await browser.close();await new Promise(ok=>server.close(ok))}
console.log('WEBKIT',6-failures,'/ 6 PASS');
if(failures)process.exitCode=1;
