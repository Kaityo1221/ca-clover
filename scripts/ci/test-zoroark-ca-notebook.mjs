// Static + JS parser checks; no credentials, DB calls, or browser side effects.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Script} from "node:vm";

const read=p=>readFileSync(p,"utf8");
const html=read("docs/index.html");
const ca=read("docs/zoroark-ca-notebook.mjs");
const admin=read("docs/zoroark-admin-notebook.mjs");
const game=read("docs/zoroark-local.mjs");
for(const [i,source] of [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(x=>x[1]).entries()){
 if(source.trim())new Script(source,{filename:"inline-"+i});
}
for(const [name,source] of [["ca",ca],["admin",admin]]){
 assert.ok(source.includes("makePokemonPickerV8"),name+" uses shared V8 Pokemon picker");
 assert.ok(!source.includes("supabase")&&!source.includes("Bearer"),name+" has no credentials");
 assert.ok(!source.includes("localStorage.setItem")&&!source.includes("localStorage.removeItem"),name+" never modifies iPhone drafts");
 assert.ok(source.includes("gateway.request"),name+" uses parent capability");
 const code=source.replace(/^import .*;\s*$/mg,"").replace(/^export\s+(?=function\s)/mg,"");
 new Script(code,{filename:name+"-notebook"});
}
assert.ok(html.includes('notebookQAReady'),"QA-only setting required");
assert.ok(html.includes('const notebookLocalStack='),"explicit local GoTrue QA opt-in required");
assert.ok(html.includes('notebookQA?.useLocalStack===true'),"browser QA cannot silently use loopback");
assert.ok(html.includes('notebookLocalHost&&'),"only loopback Pages may use local GoTrue");
assert.ok(html.includes('notebookQA.url.includes("wgiittrvgtiosogyhfcl")'),"production Supabase is forbidden in QA");
assert.ok(html.includes('http://localhost:3000/api/zoroark/notebook'),"fixed local API target");
assert.ok(html.includes('notebookProductionPage=!notebookLocalHost && location.origin==="https://kaityo1221.github.io"'),"production gateway only on canonical Pages origin");
assert.ok(html.includes('notebookQAReady?"http://localhost:3000/api/zoroark/notebook":"https://ca-clover.vercel.app/api/zoroark/notebook"'),"strict QA / production API split");
assert.ok(html.includes('if(!notebookRequestReady)throw Error'),"non canonical origin remains blocked");
assert.ok(html.includes('["move-status","edit-published"].includes(payload.action)'),"new ADMIN-only actions guarded in parent");
assert.ok(html.includes('zoroarkSubmit') || html.includes('zoroark-submit'),"CA route retained");
assert.ok(html.includes('zoroarkShowLocal'),"local management integrated");
assert.ok(html.includes("zoroarkNotebookGateway"),"token confined to parent page");
assert.ok(html.includes('notebookQAReady?"http://localhost:3000/api/zoroark/round":"https://ca-clover.vercel.app/api/zoroark/round"'),"local QA never sends isolated JWT to production game API");
assert.ok(html.includes("zoroarkOfficialQAGateway"),"official 42 read/write gateway is QA-only");
assert.ok(html.includes("gameCatalogGateway:zoroarkOfficialQAGateway"),"original official42 local editor receives isolated gateway");
assert.ok(game.includes('data-act="openNotebook"'),"PR317 placement remains intact");
assert.ok(!ca.includes('row.status==="pending"'),"CA edit affordance does not leak review classification");
assert.ok(ca.includes('Object.prototype.hasOwnProperty.call(x,"status")'),"CA refuses review metadata");
assert.ok(html.includes("20261117-v8"),"Pages V8 imports cache-busted");
for(const action of ["move-status","edit-published","expectedRevision","confirmPublish","confirmDelete"])
 assert.ok(admin.includes(action),"admin V8 "+action+" UI exists");
assert.ok(!admin.includes('data-filter="retired"'),"legacy retired is not a tab");
assert.ok(admin.includes("window.confirm"),"high-impact actions require explicit confirmation");
console.log("ZOROARK_CA_NOTEBOOK_PAGES_PASS role_router=on qa_api_gate=on PR317_entry=preserved");
const {mountAdminNotebook}=await import("../../docs/zoroark-admin-notebook.mjs");
const {mountCANotebook}=await import("../../docs/zoroark-ca-notebook.mjs");
const {searchPokemonV8}=await import("../../docs/zoroark-pokemon-picker-v8.mjs");
// Isolated in-memory DOM simulation. This does not substitute for Safari or real RLS.
const originalDocument=globalThis.document, originalWindow=globalThis.window;
globalThis.document={head:{append(){}},createElement(){return {textContent:"",remove(){}}}};
globalThis.window={confirm(){return true}};
const fakeHost=()=>{const handlers={};return {innerHTML:"",handlers,
 addEventListener(k,f){handlers[k]=f},removeEventListener(k){delete handlers[k]},
 scrollIntoView(){}}};
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
let transitionCount=0;
for(const current of ["pending","approved","published","rejected","deleted","retired"]){
 for(const dest of ["pending","approved","published","rejected","deleted"]){
  if(current===dest)continue;
  let entry={id:1,a:"ピカチュウ",b:"イーブイ",status:current,
   common:"小型",difference:"形態",level:"easy",edit_revision:3,version:10,submitted_by:"test"};
  let posted=null;
  const gateway={async request(method,payload){
   if(method==="GET")return {entries:[entry],baseCount:42,publishEnabled:true,runtimeEnabled:false};
   posted=payload;entry={...entry,status:dest,edit_revision:4};
   return {entry};
  }};
  const host=fakeHost(),stop=mountAdminNotebook({host,gateway,onBack(){}});
  await tick();
  assert.ok(!host.innerHTML.includes('data-filter="retired"'),"retired button prohibited");
  host.handlers.click({target:{closest(){return {dataset:{act:"move-status",target:dest,id:"1"},
   hasAttribute(n){return n==="data-act"}}}}});
  await tick();
  assert.equal(posted?.expectedStatus,current);
  assert.equal(posted?.targetStatus,dest);
  assert.equal(posted?.expectedRevision,3);
  assert.equal(posted?.confirmPublish,dest==="published");
  assert.equal(posted?.confirmDelete,dest==="deleted");
  ++transitionCount;stop();
 }
}
assert.equal(transitionCount,25);
const privateHost=fakeHost();
const stopPrivate=mountCANotebook({host:privateHost,gateway:{
 async request(){return {entries:[{id:2,status:"rejected",a:"ルカリオ",b:"ゾロア"}]}}},onBack(){}});
await tick();
assert.ok(privateHost.innerHTML.includes("非公開の審査状態"),"leaked CA state blocked");
assert.ok(!privateHost.innerHTML.includes("ルカリオ × ゾロア"),"CA leaked row not rendered");
stopPrivate();
globalThis.fetch=async()=>({ok:true,json:async()=>[{jp:"ピカチュウ",en:"Pikachu",no:"025",gen:"1"}]});
for(const v of ["ピカ","pik","025"]){
 const out=await searchPokemonV8(v);
 assert.equal(out.hits.length,9,"each of nine stub generations searched");
}
globalThis.document=originalDocument;globalThis.window=originalWindow;
console.log("ZOROARK_V8_INMEMORY_PASS",transitionCount,"moves + CA privacy + 9-gen search");

