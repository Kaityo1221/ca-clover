import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {OFFICIAL_ZOROARK_42,findOfficialZoroarkPairs} from "../../docs/zoroark-official42.mjs";
import {normalizeEntry} from "../../docs/zoroark-idea-library.mjs";
import {
 NOTEBOOK_TRASH_KEY,OFFICIAL_DRAFTS_KEY,notebookRows,notebookBackup,
 parseNotebookImport,safeMergeNotebook,loadNotebookTrash,verifyNotebookTrash
} from "../../docs/zoroark-notebook.mjs";
import {mountIdeaMemo} from "../../docs/zoroark-ideas.mjs";

assert.equal(OFFICIAL_ZOROARK_42.length,42);
assert.deepEqual(["easy","normal","hard"].map(level=>findOfficialZoroarkPairs({level}).length),[12,15,15]);
assert.deepEqual(notebookRows([],{},{kind:"trash",trash:{officialIds:["e01"],memoKeys:[]}}).map(x=>x.id),["e01"]);
assert.equal(notebookRows([],{},{kind:"official",trash:{officialIds:["e01"],memoKeys:[]}}).length,41);
assert.throws(()=>verifyNotebookTrash({officialIds:["bad"],memoKeys:[]}));
assert.deepEqual(parseNotebookImport(JSON.stringify(notebookBackup([],{},{
 officialIds:["e01"],memoKeys:[]
}))).trash,{officialIds:["e01"],memoKeys:[]});

const index=readFileSync("docs/index.html","utf8");
const ui=readFileSync("docs/zoroark-ideas.mjs","utf8");
assert.ok(index.includes("zoroark-ideas.mjs?v=20261115-management-compat3"));
assert.ok(index.includes("gameCatalogGateway:zoroarkOfficialGateway"));
assert.ok(index.includes("/api/zoroark/official"));
assert.ok(ui.includes("data-official-delete")&&ui.includes("data-official-restore"));
assert.ok(ui.includes("data-memo-delete")&&ui.includes("data-memo-restore"));
assert.ok(ui.includes("gameConfirmed"),"live state must be server-confirmed");
assert.ok(ui.includes('if(role!=="admin")throw Error'),"no untrusted role access");
assert.ok(!ui.includes("service_role"),"never reveal privileged key");

const before={document:globalThis.document,window:globalThis.window,localStorage:globalThis.localStorage,fetch:globalThis.fetch};
try{
 const localKey="ca-zoroark-admin-ideas-v1";
 const memo=[normalizeEntry({a:"ピカチュウ",b:"イーブイ",aNo:"025",bNo:"133",note:"元のメモ"})];
 const storage=new Map([[localKey,JSON.stringify(memo)]]);
 const writes=[];
 globalThis.localStorage={getItem(k){return storage.get(k)||null},setItem(k,v){writes.push(k);storage.set(k,v)}};
 let allow=true;
 globalThis.window={scrollTo(){},confirm(){return allow}};
 globalThis.fetch=async()=>({ok:true,json:async()=>[{jp:"ピカチュウ",no:"025",gen:1,en:"Pikachu"},{jp:"ニャース",no:"052",gen:1,en:"Meowth"}]});
 const sty={remove(){}},dialogEvents={},dlg={addEventListener(k,f){dialogEvents[k]=f},
  removeEventListener(){},close(){},remove(){},showModal(){},querySelector(){return null},querySelectorAll(){return[]}};
 globalThis.document={head:{append(){}},body:{append(){}},createElement(k){return k==="style"?sty:dlg}};
 let apiWrites=0,apiReads=0,apiFailure=false,serverStates=[];
 const gateway={
  async listStates(){
   apiReads++;
   if(apiFailure)throw Error("synthetic upstream disconnected");
   return {states:[...serverStates],writeEnabled:true};
  },
  async setState(topicId,disabled,expectedRevision){
   apiWrites++;
   if(apiFailure)throw Error("synthetic upstream disconnected");
   const old=serverStates.find(x=>x.topic_id===topicId);
   if((old?.revision||0)!==expectedRevision)throw Error("stale");
   if(old)old.disabled=disabled,old.revision++;
   else serverStates.push({topic_id:topicId,disabled,revision:1});
   return {state:old?{...old}:{...serverStates.at(-1)},gameConfirmed:true};
  }
 };
 const events={},inputs={};
 const host={innerHTML:"",addEventListener(k,f){events[k]=f},removeEventListener(){},querySelector(k){
   return Object.hasOwn(inputs,k)?{value:inputs[k]}:null;
 }};
 const flush=async()=>{for(let n=0;n<8;n++)await Promise.resolve()};
 const click=(selector,dataset={})=>events.click({target:{closest(key){return key===selector?{dataset}:null}}});
 assert.throws(()=>mountIdeaMemo({host,role:"ca",onBack(){},gameCatalogGateway:gateway}),/ADMIN only/);
 const close=mountIdeaMemo({host,role:"admin",onBack(){},gameCatalogGateway:gateway});
 await flush();
 assert.equal(apiReads,1);
 assert.equal((host.innerHTML.match(/class="zim-list-card"/g)||[]).length,43);
 click("[data-book-kind]",{bookKind:"official"});
 assert.equal((host.innerHTML.match(/class="zim-list-card"/g)||[]).length,42);
 click("[data-official-edit]",{officialEdit:"e01"});
 assert.ok(host.innerHTML.includes("🗑 ゲームの出題から停止"));
 allow=false;
 click("[data-official-delete]");await flush();
 assert.equal(apiWrites,0,"declining confirmation does not write");
 allow=true;
 click("[data-official-delete]");await flush();
 assert.equal(apiWrites,1,"official delete calls server");
 assert.equal(serverStates[0].topic_id,"e01");
 assert.equal(serverStates[0].disabled,true);
 assert.equal((host.innerHTML.match(/class="zim-list-card"/g)||[]).length,41);
 assert.equal(OFFICIAL_ZOROARK_42.length,42,"official source still has 42");
 assert.equal(storage.get(localKey),JSON.stringify(memo),"official disabling does not alter local memo");
 assert.equal(storage.has(NOTEBOOK_TRASH_KEY),false,"official disabled status is not faked in localStorage");
 click("[data-book-kind]",{bookKind:"trash"});
 assert.ok(host.innerHTML.includes("↩ ゲーム出題へ復元"));
 click("[data-official-restore]",{officialRestore:"e01"});await flush();
 assert.equal(serverStates[0].disabled,false);
 assert.equal(serverStates[0].revision,2);
 click("[data-book-kind]",{bookKind:"official"});
 assert.equal((host.innerHTML.match(/class="zim-list-card"/g)||[]).length,42,"restoring returns official row");

 // Revalidation failure cannot produce a false success state.
 click("[data-official-edit]",{officialEdit:"e02"});
 apiFailure=true;
 click("[data-official-delete]");await flush();
 assert.ok(host.innerHTML.includes("ゲームへの反映に失敗しました"));
 assert.equal(serverStates.some(v=>v.topic_id==="e02"),false);
 apiFailure=false;
 click("[data-game-refresh]");await flush();
 assert.ok(host.innerHTML.includes("ゲームの出題から停止"),"reconnected control still available");
 click("[data-official-cancel]");

 // Self-created memos are not in game, so their trash works locally.
 click("[data-book-kind]",{bookKind:"memo"});
 click("[data-memo-delete]",{memoDelete:"0"});
 assert.equal(JSON.parse(storage.get(localKey)).length,1);
 assert.equal(loadNotebookTrash(globalThis.localStorage).trash.memoKeys.length,1);
 click("[data-book-kind]",{bookKind:"trash"});
 assert.equal((host.innerHTML.match(/class="zim-list-card"/g)||[]).length,1);
 click("[data-memo-restore]",{memoRestore:"0"});
 assert.equal(loadNotebookTrash(globalThis.localStorage).trash.memoKeys.length,0);
 assert.equal(apiWrites,3,"local memo operations do not call remote game API");
 close();

 // Without backend there is no public game-deletion button that can execute.
 const offlineEvents={};
 const offline={innerHTML:"",addEventListener(k,f){offlineEvents[k]=f},removeEventListener(){},querySelector(){return null}};
 const stop=mountIdeaMemo({host:offline,role:"admin",onBack(){}});
 assert.ok(offline.innerHTML.includes("ゲーム出題との接続は未確認"));
 assert.ok(offline.innerHTML.includes("data-official-delete")&&offline.innerHTML.includes("disabled"));
 stop();

 const brokenStore={getItem(k){return k===NOTEBOOK_TRASH_KEY?"{broken":null},setItem(){throw Error("corrupt data overwritten")}};
 globalThis.localStorage=brokenStore;
 const unsafe={...offline,innerHTML:""};
 const end=mountIdeaMemo({host:unsafe,role:"admin",onBack(){}});
 assert.ok(unsafe.innerHTML.includes("削除済みデータを読み取れません"));
 end();
}finally{
 for(const [key,v] of Object.entries(before)){if(v===undefined)delete globalThis[key];else globalThis[key]=v}
}
console.log("ZOROARK_OFFICIAL_LIVE_DELETE_UI_PASS");
