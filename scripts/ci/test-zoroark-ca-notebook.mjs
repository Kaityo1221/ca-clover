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
