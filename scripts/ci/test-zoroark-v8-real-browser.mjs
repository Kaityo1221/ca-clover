// Isolated real Chromium + WebKit DOM / interaction E2E.
// Synthetic fixtures only: no external calls, no sessions, no production writes.
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {createRequire} from "node:module";
import {resolve,join} from "node:path";
const require=createRequire(join(resolve(process.env.PLAYWRIGHT_RUNTIME||"node_modules"),"playwright/package.json"));
const {chromium,webkit}=require("playwright");
const out=resolve(process.env.QA_OUTPUT||"qa-artifacts/zoroark-v8-browser");
await mkdir(out,{recursive:true});
const allowed=new Set(["/docs/zoroark-ca-notebook.mjs","/docs/zoroark-admin-notebook.mjs","/docs/zoroark-pokemon-picker-v8.mjs"]);
const html="<!doctype html><html lang=\"ja\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>V8 Isolated Browser QA</title><style>\n*{box-sizing:border-box}body{font-family:system-ui,sans-serif;margin:0;padding:12px;background:#f8fafc;color:#1f2937}.card{background:white;border-radius:14px;padding:12px;box-shadow:0 1px 4px #0001}button{cursor:pointer}h1{font-size:22px}h2{font-size:18px}\n</style></head><body><main id=\"host\"></main><script type=\"module\">\nimport {mountCANotebook} from \"/docs/zoroark-ca-notebook.mjs\";\nimport {mountAdminNotebook} from \"/docs/zoroark-admin-notebook.mjs\";\nconst opts=new URLSearchParams(location.search),role=opts.get(\"role\")||\"ca\";\nconst sample={id:71,a:\"ピカチュウ\",b:\"イーブイ\",a_no:\"025\",b_no:\"133\",common:\"似ている\",difference:\"進化\",level:\"easy\",edit_revision:2,version:1,submitted_by:\"synthetic-ca\",status:\"pending\"};\nconst privateView=row=>{const {id,a,b,a_no,b_no,common,difference,level,edit_revision}=row;return {id,a,b,a_no,b_no,common,difference,level,edit_revision}};\nlet rows=[{...sample}],sequence=72;const calls=[];\nconst gateway={async request(method,payload,scope){\n calls.push({method,payload,scope});\n if(method===\"GET\"){\n  if(role===\"leak\")return {entries:rows.map(r=>({...r}))};\n  return scope===\"all\"\n   ?{entries:rows.map(r=>({...r})),baseCount:42,catalogVersion:3,runtimeEnabled:false,publishEnabled:true,liveIds:[]}\n   :{entries:rows.map(privateView)};\n }\n if(!payload||method!==\"POST\")throw Error(\"Unexpected method\");\n if(payload.action===\"submit\"){\n  const row={...payload.topic,id:sequence++,a_no:payload.topic.aNo,b_no:payload.topic.bNo,status:\"pending\",edit_revision:0,version:0,submitted_by:\"synthetic-ca\"};\n  rows.push(row);return {entry:privateView(row)};\n }\n const index=rows.findIndex(r=>r.id===payload.id);\n if(index<0)throw Error(\"Not found\");\n const prev=rows[index];\n if(payload.action===\"edit\"){\n  if(prev.edit_revision!==payload.expectedRevision)throw Error(\"stale_revision\");\n  rows[index]={...prev,...payload.topic,a_no:payload.topic.aNo,b_no:payload.topic.bNo,edit_revision:prev.edit_revision+1};\n  return {entry:privateView(rows[index])};\n }\n if(payload.action===\"move-status\"){\n  if(prev.status!==payload.expectedStatus||prev.edit_revision!==payload.expectedRevision)throw Error(\"stale_cas\");\n  if(payload.targetStatus===\"published\"&&payload.confirmPublish!==true)throw Error(\"publish_confirmation\");\n  if(payload.targetStatus===\"deleted\"&&payload.confirmDelete!==true)throw Error(\"delete_confirmation\");\n  rows[index]={...prev,status:payload.targetStatus,edit_revision:prev.edit_revision+1,version:prev.version+1};\n  return {entry:{...rows[index]}};\n }\n if(payload.action===\"edit-published\"){\n  if(prev.status!==\"published\"||payload.expectedRevision!==prev.edit_revision||payload.expectedVersion!==prev.version||payload.confirmPublishEdit!==true)throw Error(\"stale_published\");\n  rows[index]={...prev,...payload.topic,a_no:payload.topic.aNo,b_no:payload.topic.bNo,version:prev.version+1,edit_revision:prev.edit_revision+1};\n  return {entry:{...rows[index]}};\n }\n throw Error(\"Unexpected API action\");\n}};\nwindow.__qa={calls,getRows:()=>rows,ready:false};\nconst host=document.getElementById(\"host\");\nif(role===\"admin\")mountAdminNotebook({host,gateway,onBack(){}});\nelse mountCANotebook({host,gateway,onBack(){}});\nwindow.__qa.ready=true;\n</script></body></html>";
const server=createServer(async(req,res)=>{
 try {
  const url=new URL(req.url||"/","http://127.0.0.1");
  if(url.pathname==="/"){res.writeHead(200,{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"});res.end(html);return}
  if(!allowed.has(url.pathname)){res.writeHead(404);res.end("not found");return}
  const data=await readFile(resolve("."+url.pathname));
  res.writeHead(200,{"Content-Type":"text/javascript; charset=utf-8","Cache-Control":"no-store"});res.end(data);
 }catch{res.writeHead(500);res.end("server error")}
});
await new Promise((ok,fail)=>server.listen(0,"127.0.0.1",e=>e?fail(e):ok()));
const base="http://127.0.0.1:"+server.address().port;
let passes=0;const results=[],errors=[];
const mark=s=>{results.push(s);passes++;console.log("V8_BROWSER_PASS "+s)};
const mockJSON=[{jp:"ピカチュウ",en:"Pikachu",no:"025",gen:1},{jp:"イーブイ",en:"Eevee",no:"133",gen:1}];
async function isolate(page){
 page.on("pageerror",e=>errors.push(e.message));
 await page.route("**/*",route=>{
  const url=new URL(route.request().url());
  if(url.hostname==="127.0.0.1")return route.continue();
  if(url.hostname==="raw.githubusercontent.com"&&/^\/Kaityo1221\/Global-EN-Trainer\/main\/data\/gen[1-9]\.json$/.test(url.pathname)){
   return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(mockJSON)});
  }
  return route.abort();
 });
}
try{
 for(const [engine,browserType] of [["chromium",chromium],["webkit",webkit]]){
  const browser=await browserType.launch({headless:true});
  try{
   for(const width of [320,390,430]){
    const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true});
    const page=await context.newPage();
    await isolate(page);
    await page.goto(base+"/?role=ca");
    await page.waitForFunction(()=>window.__qa?.ready===true);
    await page.getByRole("heading",{name:"📚 みんなのネタ帳"}).waitFor();
    assert.equal(await page.locator(".zca article.entry").count(),1);
    assert.equal(await page.locator("[data-field=common]").count(),1);
    assert.equal(await page.locator("[data-field=difference]").count(),1);
    assert.equal(await page.locator("[data-field=level]").count(),1);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,engine+" "+width+" CA overflow");
    assert.equal(await page.locator(".zca article.entry").first().innerText().then(t=>t.includes("審査待ち")),false);
    await page.locator("[data-send]").click();
    await page.getByRole("alert").getByText("全必須項目を入力してください。").waitFor();
    await page.locator("[data-pick=a]").click();
    await page.locator("[data-query]").fill("ピカ");
    await page.locator(".zpk [data-index]").first().waitFor();
    await page.locator(".zpk [data-index]").first().click();
    await page.locator("[data-pick=b]").click();
    await page.locator("[data-query]").fill("イーブイ");
    await page.locator(".zpk [data-index]").first().waitFor();
    await page.locator(".zpk [data-index]").first().click();
    await page.locator("[data-field=common]").fill("かわいい");
    await page.locator("[data-field=difference]").fill("進化の仕方");
    await page.locator("[data-field=level]").selectOption("normal");
    await page.locator("[data-send]").click();
    await page.getByRole("status").getByText("投稿を受け付けました。").waitFor();
    await page.waitForFunction(()=>window.__qa.getRows().length===2);
    const calls=await page.evaluate(()=>window.__qa.calls.filter(x=>x.method==="POST"));
    assert.equal(calls.length,1);
    assert.equal(calls[0].payload.action,"submit");
    assert.equal(calls[0].payload.topic.level,"normal");
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,engine+" "+width+" CA submitted overflow");
    if(width===390)await page.screenshot({path:join(out,engine+"-ca-390.png"),fullPage:true});
    mark(engine+" "+width+" CA picker, validated submit, privacy, no overflow");
    await context.close();
   }
   const leak=await browser.newPage({viewport:{width:390,height:844}});
   await isolate(leak);await leak.goto(base+"/?role=leak");
   await leak.getByRole("alert").getByText(/非公開の審査状態/).waitFor();
   assert.equal(await leak.locator(".zca article.entry").count(),0);
   mark(engine+" CA review-state leak fail-closed");await leak.close();
   const page=await browser.newPage({viewport:{width:390,height:844}});
   await isolate(page);page.on("dialog",d=>d.accept());
   await page.goto(base+"/?role=admin");
   await page.getByRole("heading",{name:"📚 会長のお題管理"}).waitFor();
   await page.locator("[data-act=move-status][data-target=published]").first().click();
   await page.waitForFunction(()=>window.__qa.getRows()[0].status==="published");
   await page.locator("[data-filter=published]").click();
   await page.locator("[data-edit]").first().click();
   await page.locator("#zad-common").fill("更新した共通点");
   await page.locator("[data-save]").click();
   await page.waitForFunction(()=>window.__qa.getRows()[0].common==="更新した共通点");
   assert.equal(await page.evaluate(()=>window.__qa.getRows()[0].status),"published");
   await page.locator("[data-act=move-status][data-target=deleted]").first().click();
   await page.waitForFunction(()=>window.__qa.getRows()[0].status==="deleted");
   await page.locator("[data-filter=deleted]").click();
   await page.locator("[data-act=move-status][data-target=approved]").first().click();
   await page.waitForFunction(()=>window.__qa.getRows()[0].status==="approved");
   const calls=await page.evaluate(()=>window.__qa.calls.filter(x=>x.method==="POST"));
   assert.deepEqual(calls.map(x=>x.payload.action),["move-status","edit-published","move-status","move-status"]);
   assert.equal(calls[0].payload.confirmPublish,true);
   assert.equal(calls[2].payload.confirmDelete,true);
   assert.equal(calls[1].payload.confirmPublishEdit,true);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   await page.screenshot({path:join(out,engine+"-admin-390.png"),fullPage:true});
   mark(engine+" ADMIN publish->edit published->delete->restore / confirmation");
   await page.close();
  }finally{await browser.close()}
 }
 assert.deepEqual(errors,[],"no uncaught browser errors");
}finally{
 await new Promise(r=>server.close(r));
 await writeFile(join(out,"results.json"),JSON.stringify({passes,results,errors,syntheticOnly:true},null,2));
}
assert.equal(passes,10);
console.log("ZOROARK_V8_REAL_BROWSER_CI_PASS engines=chromium,webkit sizes=320,390,430 passes="+passes+" external_connections=0");
