import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFileSync,mkdirSync} from "node:fs";
import {join,extname,normalize,sep} from "node:path";
import {webkit} from "playwright";

const root=process.cwd(),artifacts=join(root,"qa-artifacts","zoroark-notebook");
mkdirSync(artifacts,{recursive:true});
const fixture='<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0;background:#f7fce9;color:#1f2937;font:16px system-ui,-apple-system,sans-serif}.card{background:white;border-radius:20px;padding:16px;margin:10px 0}section{box-sizing:border-box}h1{font-size:25px}h2{font-size:21px}.muted{color:#64748b}#testHost{padding:12px;max-width:740px;margin:auto}button:disabled{cursor:not-allowed;opacity:.5}</style></head><body><div id="testHost"></div></body></html>';
const server=createServer((req,res)=>{
 const url=new URL(req.url||"/","http://127.0.0.1");
 if(url.pathname==="/qa/zoroark-notebook")return res.writeHead(200,{"content-type":"text/html; charset=utf-8","cache-control":"no-store"}).end(fixture);
 if(!url.pathname.startsWith("/docs/"))return res.writeHead(404).end("not found");
 const file=normalize(join(root,decodeURIComponent(url.pathname).replace(/^\/+/,"")));
 if(!file.startsWith(root+sep))return res.writeHead(403).end();
 try{
  const data=readFileSync(file);
  const kind={".mjs":"text/javascript",".js":"text/javascript",".json":"application/json"}[extname(file)]||"application/octet-stream";
  res.writeHead(200,{"content-type":kind,"cache-control":"no-store"}).end(data);
 }catch{res.writeHead(404).end("not found")}
});
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
const origin="http://127.0.0.1:"+server.address().port;
let browser;
const record=msg=>console.log("ZOROARK_WEBKIT "+msg+" PASS");
async function testAt(width){
 const context=await browser.newContext({viewport:{width,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});
 const page=await context.newPage();const errors=[];
 page.on("pageerror",e=>errors.push(String(e)));
 try{
  await page.goto(origin+"/qa/zoroark-notebook",{waitUntil:"domcontentloaded"});
  await page.evaluate(async()=>{
   localStorage.setItem("ca-zoroark-admin-ideas-v1",JSON.stringify([{
     a:"ピカチュウ",b:"イーブイ",aNo:"25",bNo:"133",note:"既存のメモ",difference:"初期の相違点",level:"easy",status:"draft"
   }]));
   window.__qa={states:[],mutations:[],allow:true,connected:true};
   window.confirm=()=>window.__qa.allow;
   const gateway={
    async listStates(){
     if(!window.__qa.connected)throw Error("mock disconnection");
     return {states:[...window.__qa.states],writeEnabled:true};
    },
    async setState(topicId,disabled,expectedRevision){
     if(!window.__qa.connected)throw Error("mock disconnection");
     const old=window.__qa.states.find(row=>row.topic_id===topicId);
     if((old?.revision||0)!==expectedRevision)throw Error("stale revision");
     const state={topic_id:topicId,disabled,revision:expectedRevision+1};
     window.__qa.states=window.__qa.states.filter(x=>x.topic_id!==topicId).concat(state);
     window.__qa.mutations.push(state);
     return {state,gameConfirmed:true};
    }
   };
   const mod=await import("/docs/zoroark-ideas.mjs");
   window.__qa.destroy=mod.mountIdeaMemo({host:document.getElementById("testHost"),role:"admin",
    gameCatalogGateway:gateway,onBack(){}});
  });
  await page.locator('[data-book-kind="official"]').click();
  assert.equal(await page.locator(".zim-list-card").count(),42,"official initial count");
  await page.locator('[data-official-edit="e01"]').click();
  assert.ok(await page.locator("#zim-official-common").isVisible());
  await page.locator("#zim-official-common").fill("WebKitで編集した共通点");
  // Remote status refresh must not erase unsaved editor contents.
  await page.locator("[data-game-refresh]").click();
  await page.waitForFunction(()=>!document.querySelector("[data-game-refresh]")?.disabled);
  assert.equal(await page.locator("#zim-official-common").inputValue(),"WebKitで編集した共通点",
    "unsaved official text survives remote refresh");
  assert.equal(await page.evaluate(()=>localStorage.getItem("ca-zoroark-official42-drafts-v1")),null,
    "refresh must not silently persist the draft");
  await page.locator("#zim-official-b").fill("デデンネ");
  await page.locator("[data-official-save]").click();
  assert.equal(await page.locator("#zim-official-b").inputValue(),"デデンネ",
    "failed validation does not erase entered text");
  assert.ok((await page.locator("#testHost").textContent()).includes("保存できません"),
    "invalid pair is refused");
  await page.locator("#zim-official-b").fill("エモンガ");
  await page.locator("[data-official-save]").click();
  await page.locator('[data-official-edit="e01"]').waitFor();
  assert.ok((await page.locator("#testHost").textContent()).includes("WebKitで編集した共通点"),"local draft visible");
  const d=await page.evaluate(()=>JSON.parse(localStorage.getItem("ca-zoroark-official42-drafts-v1")||"{}"));
  assert.equal(d.e01.common,"WebKitで編集した共通点");
  await page.locator('[data-official-edit="e01"]').click();
  const stop=page.locator("[data-official-delete]");
  assert.equal(await stop.isEnabled(),true,"live state confirmed");
  await page.evaluate(()=>window.__qa.allow=false);
  await stop.click();
  assert.equal(await page.evaluate(()=>window.__qa.mutations.length),0,"cancel has no write");
  await page.evaluate(()=>window.__qa.allow=true);
  await stop.click();
  await page.waitForFunction(()=>window.__qa.states[0]?.disabled===true&&document.querySelectorAll(".zim-list-card").length===41);
  assert.equal(await page.locator(".zim-list-card").count(),41,"42→41 active official");
  assert.equal(await page.evaluate(()=>localStorage.getItem("ca-zoroark-notebook-trash-v1")),null,"official not faked locally");
  await page.locator('[data-book-kind="trash"]').click();
  assert.equal(await page.locator(".zim-list-card").count(),1,"trash contains stopped official");
  await page.locator('[data-official-restore="e01"]').click();
  await page.waitForFunction(()=>window.__qa.states[0]?.disabled===false&&document.querySelectorAll(".zim-list-card").length===0);
  assert.equal(await page.locator(".zim-list-card").count(),0,"restored official removed from trash");
  await page.locator('[data-book-kind="official"]').click();
  assert.equal(await page.locator(".zim-list-card").count(),42);
  record(width+"px official edit / stop / restore");
  await page.locator('[data-book-kind="memo"]').click();
  assert.equal(await page.locator(".zim-list-card").count(),1);
  await page.locator('[data-memo-delete="0"]').click();
  assert.equal(await page.locator(".zim-list-card").count(),0);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem("ca-zoroark-admin-ideas-v1")).length),1);
  await page.locator('[data-book-kind="trash"]').click();
  assert.equal(await page.locator(".zim-list-card").count(),1);
  await page.locator('[data-memo-restore="0"]').click();
  await page.locator('[data-book-kind="memo"]').click();
  assert.equal(await page.locator(".zim-list-card").count(),1);
  record(width+"px custom memo deletion / restoration");
  await page.locator('[data-catalog-view="create"]').click();
  assert.ok((await page.locator("#testHost").textContent()).includes("ネタを新しく作る"));
  const geom=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,innerWidth:innerWidth,hostRight:document.querySelector("#testHost").getBoundingClientRect().right}));
  assert.ok(geom.scrollWidth<=width+2,"horizontal scroll "+JSON.stringify(geom));
  assert.ok(geom.hostRight<=width+1,"host overflow "+JSON.stringify(geom));
  assert.deepEqual(errors,[],"WebKit JS exceptions");
  await page.screenshot({path:join(artifacts,"webkit-"+width+".png")});
  record(width+"px no overflow / JS exceptions");
 }finally{await page.close();await context.close()}
}
try{
 browser=await webkit.launch({headless:true});
 for(const width of [320,390,430])await testAt(width);
 console.log("ZOROARK_WEBKIT_ISOLATED_PASS mobile_webkit=true actual_ios=false");
}catch(e){console.error("ZOROARK_WEBKIT_ISOLATED_FAIL",e?.stack||e);process.exitCode=1}
finally{await browser?.close();await new Promise(resolve=>server.close(resolve))}
