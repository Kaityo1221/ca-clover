import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {pairKey,normalizeEntry,mergeEntries,parseImport,exportDocument,ideaStatusCounts,ideaVisibleIndexes,candidateForServer,compareServerCatalog,topicNameKey} from "../../docs/zoroark-idea-library.mjs";
import {mountIdeaMemo} from "../../docs/zoroark-ideas.mjs";
const legacy=[{a:"ピカチュウ",b:"イーブイ",aNo:"025",bNo:"133",note:"人気",at:"2026-10-31"}];
const rows=parseImport(JSON.stringify(legacy));
assert.equal(rows.length,1);
assert.equal(rows[0].status,"draft");
assert.equal(pairKey(rows[0]),pairKey({a:"イーブイ",b:"ピカチュウ",aNo:"133",bNo:"025"}));
const next=mergeEntries(rows,[{...rows[0],a:"イーブイ",b:"ピカチュウ",aNo:"133",bNo:"025"},{a:"ヤクデ",b:"マルヤクデ",aNo:"850",bNo:"851",note:"むし",status:"adopted"}]);
assert.equal(next.added,1);
assert.equal(next.skipped,1);
assert.equal(next.entries[1].status,"adopted");
assert.equal(parseImport(JSON.stringify(exportDocument(next.entries))).length,2);
assert.throws(()=>normalizeEntry({a:"同じ",b:"同じ"}));
assert.throws(()=>parseImport('{"not":"supported"}'));
assert.throws(()=>parseImport("not json"));
const ui=readFileSync("docs/zoroark-ideas.mjs","utf8");
const html=readFileSync("docs/index.html","utf8");
assert.ok(ui.includes("data-import"));
assert.ok(ui.includes("data-edit"));
assert.ok(ui.includes("data-adopt"));
assert.ok(ui.includes("mergeEntries(entries,incoming)"));
assert.ok(ui.includes("localStorage.setItem(KEY"));
assert.ok(html.includes("zoroark-ideas.mjs?v=20261115-management1"));
const check=[rows[0],next.entries[1],{...rows[0],a:"コラッタ",b:"ラッタ",status:"archived"}];
assert.deepEqual(ideaStatusCounts(check),{total:3,draft:1,adopted:1,archived:1});
assert.deepEqual(ideaVisibleIndexes(check,"draft"),[0]);
assert.deepEqual(ideaVisibleIndexes(check,"all","ラッタ"),[2]);
assert.equal(parseImport(JSON.stringify(exportDocument([check[2]])))[0].status,"archived");
assert.equal(normalizeEntry({...check[0],status:"something"}).status,"draft");
assert.throws(()=>ideaVisibleIndexes(check,"invalid"));
assert.ok(ui.includes("ゲームとの接続：未実装")&&ui.includes("採用候補・ゲーム未反映"));
assert.ok(ui.includes("data-archive")&&ui.includes("data-restore"));

/* Synthetic mobile-host review flow: preserve all local entries, hide handled items, archive reversibly. */
const savedGlobals={document:globalThis.document,window:globalThis.window,localStorage:globalThis.localStorage};
try {
 const k="ca-zoroark-admin-ideas-v1",store=new Map();
 const cases=[
  {a:"ピカチュウ",b:"イーブイ",note:"下書き",status:"draft"},
  {a:"ヤクデ",b:"マルヤクデ",note:"候補",status:"adopted"},
  {a:"コラッタ",b:"ラッタ",note:"保管",status:"archived"},
 ];
 store.set(k,JSON.stringify(cases));
 globalThis.localStorage={getItem(x){return store.get(x)||null},setItem(x,v){store.set(x,v)}};
 const handlers={},style={remove(){}},dialog={addEventListener(){},removeEventListener(){},close(){},remove(){}};
 globalThis.document={createElement(n){return n==="style"?style:dialog},head:{append(){}},body:{append(){}}};
 globalThis.window={scrollTo(){}};
 let searchValue="";
 const host={innerHTML:"",addEventListener(k,v){handlers[k]=v},removeEventListener(){},querySelector(k){if(k==="#zim-query")return {value:searchValue};return null}};
 const destroy=mountIdeaMemo({host,role:"admin",onBack(){}});
 const click=(selector,dataset={})=>handlers.click({target:{closest(k){return k===selector?{dataset}:null}}});
 assert.ok(host.innerHTML.includes("ゲームとの接続：未実装"),"memo is not claimed to be live");
 assert.ok(host.innerHTML.includes("採用候補 1"),"existing adopted memo counted");
 assert.ok(host.innerHTML.includes("ピカチュウ × イーブイ"),"default pending list includes draft");
 assert.ok(!host.innerHTML.includes("ヤクデ × マルヤクデ"),"default pending list hides accepted candidates");
 click("[data-view]",{view:"adopted"});
 assert.ok(host.innerHTML.includes("ヤクデ × マルヤクデ"),"adopted tab reveals candidate");
 click("[data-archive]",{archive:"1"});
 assert.equal(JSON.parse(store.get(k))[1].status,"archived","candidate is archived without deletion");
 click("[data-view]",{view:"archived"});
 assert.ok(host.innerHTML.includes("ヤクデ × マルヤクデ"),"archived item can be recovered");
 click("[data-restore]",{restore:"1"});
 assert.equal(JSON.parse(store.get(k))[1].status,"draft","restore returns to pending");
 click("[data-view]",{view:"all"});
 searchValue="ピカチュウ";click("[data-filter-search]");
 assert.ok(host.innerHTML.includes("ピカチュウ × イーブイ"),"name search finds an item");
 assert.ok(!host.innerHTML.includes("ヤクデ × マルヤクデ"),"search filters non-matching item");
 assert.equal(JSON.parse(store.get(k)).length,3,"no stored memo is deleted by filters");
 destroy();
} finally {
 for(const [k,v] of Object.entries(savedGlobals)){if(v===undefined)delete globalThis[k];else globalThis[k]=v}
}

const completed=normalizeEntry({...legacy[0],difference:"進化のしかたが違う",level:"easy"});
assert.equal(candidateForServer(completed).common,"人気","completed candidate forwards the reviewed common feature");
assert.equal(candidateForServer(legacy[0]),null,"old 8 memo records are not published before completing review");
assert.equal(parseImport(JSON.stringify(exportDocument([completed])))[0].level,"easy","new review fields survive old JSON backup format");
assert.equal(topicNameKey("イーブイ","ピカチュウ"),topicNameKey("ピカチュウ","イーブイ"),"pair status is order-independent");
const statusFixture={baseKeys:[topicNameKey("デデンネ","エモンガ")],
 entries:[{id:3,a:"ピカチュウ",b:"イーブイ",status:"published",version:2,activeInGame:false},
 {id:4,a:"ガーディ",b:"ヒスイガーディ",status:"approved",version:0,activeInGame:false},
 {id:5,a:"ヤクデ",b:"マルヤクデ",status:"published",version:3,activeInGame:true}]};
assert.equal(compareServerCatalog({a:"デデンネ",b:"エモンガ"},statusFixture).state,"live","server-confirmed built-in is truly live");
assert.equal(compareServerCatalog(completed,statusFixture).state,"queued","published DB topic is not called live while runtime gate is off");
assert.equal(compareServerCatalog({a:"ガーディ",b:"ヒスイガーディ"},statusFixture).state,"approved","approved not live");
assert.equal(compareServerCatalog({a:"ヤクデ",b:"マルヤクデ"},statusFixture).state,"live","server-confirmed active published topic");
assert.equal(compareServerCatalog({a:"マッギョ",b:"カイリキー"},statusFixture).state,"missing","unregistered pair is not live");
assert.equal(compareServerCatalog(completed,null).state,"unchecked","network error never implies publication");
console.log("ZOROARK_JSON_LIBRARY_PASS");
