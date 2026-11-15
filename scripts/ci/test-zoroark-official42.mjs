import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {OFFICIAL_ZOROARK_42,findOfficialZoroarkPairs} from "../../docs/zoroark-official42.mjs";
import {normalizeEntry,parseImport,exportDocument} from "../../docs/zoroark-idea-library.mjs";
import {
 loadOfficialDrafts,saveOfficialDrafts,notebookRows,notebookBackup,parseNotebookImport,
 safeMergeNotebook,OFFICIAL_DRAFTS_KEY,verifyOfficialDrafts,
 loadNotebookTrash,saveNotebookTrash,verifyNotebookTrash,NOTEBOOK_TRASH_KEY
} from "../../docs/zoroark-notebook.mjs";
import {mountIdeaMemo} from "../../docs/zoroark-ideas.mjs";

assert.equal(OFFICIAL_ZOROARK_42.length,42);
assert.deepEqual(["easy","normal","hard"].map(level=>findOfficialZoroarkPairs({level}).length),[12,15,15]);
assert.equal(new Set(OFFICIAL_ZOROARK_42.map(x=>x.id)).size,42);
assert.equal(new Set(OFFICIAL_ZOROARK_42.map(x=>[x.a,x.b].sort().join("|"))).size,42);
for(const row of OFFICIAL_ZOROARK_42)assert.ok(Object.isFrozen(row));
assert.equal(findOfficialZoroarkPairs({level:"easy",query:"デデンネ"}).length,1);
assert.throws(()=>verifyOfficialDrafts({e01:{a:"デデンネ",b:"デデンネ",common:"x",difference:"y",level:"easy"}}));
assert.throws(()=>verifyOfficialDrafts({bad:{a:"A",b:"B",common:"x",difference:"y",level:"easy"}}));
assert.equal(notebookRows([],{},{}).length,42);
assert.equal(notebookRows([],{},{kind:"official",level:"easy"}).length,12);
assert.equal(notebookRows([],{},{kind:"official",query:"ﾃﾞﾃﾞﾝﾈ"}).length,1);
const officialDeleted={officialIds:["e01"],memoKeys:[]};
assert.equal(notebookRows([],{},{kind:"official",trash:officialDeleted}).length,41);
assert.equal(notebookRows([],{},{kind:"trash",trash:officialDeleted}).length,1);
assert.equal(notebookRows([],{},{kind:"trash",level:"hard",trash:officialDeleted}).length,0);
assert.throws(()=>verifyNotebookTrash({officialIds:["invalid"],memoKeys:[]}));
assert.throws(()=>verifyNotebookTrash({officialIds:["e01","e01"],memoKeys:[]}));
const archived=notebookBackup([],{},officialDeleted);
assert.deepEqual(parseNotebookImport(JSON.stringify(archived)).trash,officialDeleted);
assert.equal(safeMergeNotebook([],{},parseNotebookImport(JSON.stringify(archived))).addedDeleted,1);
assert.deepEqual(parseNotebookImport(JSON.stringify(notebookBackup([],{}))).trash,{officialIds:[],memoKeys:[]});

const html=readFileSync("docs/index.html","utf8");
const ui=readFileSync("docs/zoroark-ideas.mjs","utf8");
const engine=readFileSync("docs/zoroark-official42.mjs","utf8");
assert.ok(html.includes('if(profile?.role!=="admin")'));
assert.ok(ui.includes('if(role!=="admin")throw Error'));
assert.ok(ui.includes('data-catalog-view="create"')&&ui.includes('data-catalog-view="book"'));
assert.ok(ui.includes("保存する変更は、この端末の"));
assert.ok(!ui.includes("ZOROARK_CATALOG_QA_URL"));
assert.ok(!ui.includes("zoroark_topic_submit"));
assert.ok(!engine.includes("localStorage"));
assert.ok(html.includes("zoroark-ideas.mjs?v=20261115-live-control1"));

const globals={document:globalThis.document,window:globalThis.window,localStorage:globalThis.localStorage,fetch:globalThis.fetch};
try{
 const key="ca-zoroark-admin-ideas-v1";
 const sample=[normalizeEntry({a:"ピカチュウ",b:"イーブイ",aNo:"025",bNo:"133",note:"端末内の既存メモ",status:"draft"})];
 const values=new Map([[key,JSON.stringify(sample)]]);
 const writes=[];
 globalThis.localStorage={getItem(k){return values.get(k)||null},setItem(k,v){writes.push(k);values.set(k,v)}};
 const style={remove(){}},dialogHandlers={},dialog={
  addEventListener(k,v){dialogHandlers[k]=v},removeEventListener(){},close(){},remove(){},showModal(){},
  querySelector(){return null},querySelectorAll(){return []}
 };
 globalThis.document={createElement(type){return type==="style"?style:dialog},head:{append(){}},body:{append(){}}};
 let approveDelete=true;
 globalThis.window={scrollTo(){},confirm(){return approveDelete}};
 globalThis.fetch=async(url)=>({ok:true,json:async()=>[
  {jp:"ピカチュウ",no:"025",en:"Pikachu",gen:1},
  {jp:"ニャース",no:"052",en:"Meowth",gen:1}
 ]});
 const handlers={},inputs={};
 const host={innerHTML:"",addEventListener(k,v){handlers[k]=v},removeEventListener(){},
  querySelector(s){return Object.hasOwn(inputs,s)?{value:inputs[s]}:null}};
 assert.throws(()=>mountIdeaMemo({host,role:"ca",onBack(){}}),/ADMIN only/);
 const destroy=mountIdeaMemo({host,role:"admin",onBack(){}});
 const click=(selector,dataset={})=>handlers.click({target:{closest(k){return k===selector?{dataset}:null}}});
 assert.ok(host.innerHTML.includes("ネタを新しく作る")&&host.innerHTML.includes("📚 ネタ帳"));
 assert.ok(host.innerHTML.includes("端末内の既存メモ"));
 assert.equal((host.innerHTML.match(/class="zim-list-card"/g)||[]).length,43);
 click("[data-book-kind]",{bookKind:"official"});
 assert.equal((host.innerHTML.match(/class="zim-list-card"/g)||[]).length,42);
 click("[data-book-level]",{bookLevel:"easy"});
 assert.equal((host.innerHTML.match(/class="zim-list-card"/g)||[]).length,12);
 inputs["#zim-book-search"]="デデンネ";click("[data-book-search]");
 assert.equal((host.innerHTML.match(/class="zim-list-card"/g)||[]).length,1);
 click("[data-book-clear]");
 assert.equal((host.innerHTML.match(/class="zim-list-card"/g)||[]).length,12);

 click("[data-official-edit]",{officialEdit:"e01"});
 assert.ok(host.innerHTML.includes('id="zim-official-a"'));
 Object.assign(inputs,{"#zim-official-a":"デデンネ","#zim-official-b":"エモンガ",
  "#zim-official-common":"会長が編集した共通点","#zim-official-difference":"会長が編集した違い",
  "#zim-official-level":"easy"});
 click("[data-official-save]");
 assert.ok(values.get(OFFICIAL_DRAFTS_KEY).includes("会長が編集した共通点"));
 assert.equal(OFFICIAL_ZOROARK_42[0].common,"小型のでんきタイプ","game source immutable");
 assert.equal(values.get(key),JSON.stringify(sample),"official editing does not overwrite legacy notes");
 assert.ok(host.innerHTML.includes("✏️ 編集下書きあり"));
 assert.ok(host.innerHTML.includes("会長が編集した共通点"));
 const officialDrafts=loadOfficialDrafts(globalThis.localStorage);
 assert.equal(officialDrafts.error,null);
 assert.equal(officialDrafts.drafts.e01.common,"会長が編集した共通点");
 const exportData=notebookBackup(sample,officialDrafts.drafts);
 const roundtrip=parseNotebookImport(JSON.stringify(exportData));
 assert.equal(roundtrip.officialDrafts.e01.common,"会長が編集した共通点");
 const merged=safeMergeNotebook(sample,officialDrafts.drafts,roundtrip);
 assert.equal(merged.skippedMemo,1);
 assert.equal(merged.skippedOfficial,1);
 click("[data-official-edit]",{officialEdit:"e01"});
 click("[data-official-revert]");
 assert.deepEqual(loadOfficialDrafts(globalThis.localStorage).drafts,{});
 assert.ok(!host.innerHTML.includes("会長が編集した共通点"));

 click("[data-catalog-view]",{catalogView:"create"});
 assert.ok(host.innerHTML.includes("ネタを新しく作る"));
 click("[data-catalog-view]",{catalogView:"book"});
 click("[data-book-kind]",{bookKind:"memo"});
 click("[data-book-level]",{bookLevel:"all"});
 click("[data-book-clear]");
 assert.equal((host.innerHTML.match(/class="zim-list-card"/g)||[]).length,1);
 click("[data-edit]",{edit:"0"});
 assert.ok(host.innerHTML.includes("自作メモを編集"));
 Object.assign(inputs,{"#zim-note":"自作メモを編集しました","#zim-difference":"新しい相違点","#zim-level":"normal"});
 click("[data-save]");
 const stored=JSON.parse(values.get(key));
 assert.equal(stored[0].note,"自作メモを編集しました");
 assert.equal(stored[0].difference,"新しい相違点");
 assert.equal(stored[0].level,"normal");
 assert.equal(stored.length,1);
 assert.equal(parseImport(JSON.stringify(exportDocument(stored)))[0].difference,"新しい相違点");
 // Creating a fresh pair still works after switching modes; the Gen1 selector is retained.
 click("[data-catalog-view]",{catalogView:"create"});
 click("[data-choose]",{choose:"0"});await new Promise(resolve=>setImmediate(resolve));
 dialogHandlers.click({target:{closest(k){return k==="[data-id]"?{dataset:{id:"025"}}:null}}});
 click("[data-choose]",{choose:"1"});await new Promise(resolve=>setImmediate(resolve));
 dialogHandlers.click({target:{closest(k){return k==="[data-id]"?{dataset:{id:"052"}}:null}}});
 Object.assign(inputs,{"#zim-note":"新規ペア共通点","#zim-difference":"新規ペア相違点","#zim-level":"easy"});
 click("[data-save]");
 const latest=JSON.parse(values.get(key));
 assert.equal(latest.length,2,"new pair added without dropping prior memo");
 assert.equal(latest[1].a,"ピカチュウ");
 assert.equal(latest[1].b,"ニャース");
 assert.equal(latest[1].note,"新規ペア共通点");
 // Official entries are hidden locally, never removed from source PAIRS or legacy memo storage.
 inputs["#zim-book-search"]="";
 click("[data-book-kind]",{bookKind:"official"});
 click("[data-book-level]",{bookLevel:"all"});
 click("[data-book-clear]");
 assert.equal((host.innerHTML.match(/class="zim-list-card"/g)||[]).length,42);
 click("[data-official-edit]",{officialEdit:"e01"});
 assert.ok(host.innerHTML.includes("data-official-delete"),"Delete exists on the official edit screen");
 approveDelete=false;
 click("[data-official-delete]",{});
 assert.equal(loadNotebookTrash(globalThis.localStorage).trash.officialIds.length,0,"cancel does not delete");
 approveDelete=true;
 click("[data-official-delete]",{});
 assert.deepEqual(loadNotebookTrash(globalThis.localStorage).trash.officialIds,["e01"]);
 assert.equal((host.innerHTML.match(/class="zim-list-card"/g)||[]).length,41);
 assert.equal(OFFICIAL_ZOROARK_42.length,42,"game catalog remains unchanged");
 assert.equal(OFFICIAL_ZOROARK_42[0].id,"e01","canonical official ID remains");
 assert.equal(JSON.parse(values.get(key)).length,2,"existing memo entries remain untouched");

 // Import/export round-trip preserves deletions and can reconstruct the hidden state.
 const stateAfterDelete=loadNotebookTrash(globalThis.localStorage).trash;
 const archive=notebookBackup(latest,loadOfficialDrafts(globalThis.localStorage).drafts,stateAfterDelete);
 const restored=parseNotebookImport(JSON.stringify(archive));
 assert.deepEqual(restored.trash,stateAfterDelete);
 assert.equal(safeMergeNotebook(latest,{},restored,{officialIds:[],memoKeys:[]}).addedDeleted,1);

 click("[data-book-kind]",{bookKind:"trash"});
 assert.equal((host.innerHTML.match(/class="zim-list-card"/g)||[]).length,1);
 assert.ok(host.innerHTML.includes("data-official-restore"));
 click("[data-official-restore]",{officialRestore:"e01"});
 assert.deepEqual(loadNotebookTrash(globalThis.localStorage).trash.officialIds,[]);
 click("[data-book-kind]",{bookKind:"official"});
 assert.equal((host.innerHTML.match(/class="zim-list-card"/g)||[]).length,42,"official restore shows all 42");

 // Custom memo is also soft-deleted, without rewriting the 2 stored notes.
 click("[data-book-kind]",{bookKind:"memo"});
 assert.equal((host.innerHTML.match(/class="zim-list-card"/g)||[]).length,2);
 approveDelete=false;
 click("[data-memo-delete]",{memoDelete:"0"});
 assert.equal((host.innerHTML.match(/class="zim-list-card"/g)||[]).length,2,"memo cancel leaves list unchanged");
 approveDelete=true;
 click("[data-memo-delete]",{memoDelete:"0"});
 assert.equal((host.innerHTML.match(/class="zim-list-card"/g)||[]).length,1);
 assert.equal(JSON.parse(values.get(key)).length,2,"custom deletion keeps original storage");
 assert.equal(loadNotebookTrash(globalThis.localStorage).trash.memoKeys.length,1);
 click("[data-book-kind]",{bookKind:"trash"});
 assert.equal((host.innerHTML.match(/class="zim-list-card"/g)||[]).length,1);
 click("[data-memo-restore]",{memoRestore:"0"});
 assert.equal(loadNotebookTrash(globalThis.localStorage).trash.memoKeys.length,0);
 click("[data-book-kind]",{bookKind:"memo"});
 assert.equal((host.innerHTML.match(/class="zim-list-card"/g)||[]).length,2);
 destroy();
 // Corrupt existing storage cannot be silently overwritten.
 const corruptStorage={getItem(k){return k===key?"not-json":null},setItem(){throw Error("must not overwrite")}};
 globalThis.localStorage=corruptStorage;
 const other={...host,innerHTML:"",querySelector(){return null}};
 const close=mountIdeaMemo({host:other,role:"admin",onBack(){}});
 assert.ok(other.innerHTML.includes("書き込みを停止"));
 close();
 const trashStore={getItem(k){return k===NOTEBOOK_TRASH_KEY?"{broken":null},setItem(){throw Error("must not overwrite corrupt trash")}};
 globalThis.localStorage=trashStore;
 const broken={...host,innerHTML:"",querySelector(){return null}};
 const stop=mountIdeaMemo({host:broken,role:"admin",onBack(){}});
 assert.ok(broken.innerHTML.includes("削除済みデータを読み取れません"),"corrupt trash preserves originals");
 stop();
}finally{
 for(const [k,v] of Object.entries(globals)){if(v===undefined)delete globalThis[k];else globalThis[k]=v}
}
console.log("ZOROARK_OFFICIAL42_NOTEBOOK_EDIT_PASS");
