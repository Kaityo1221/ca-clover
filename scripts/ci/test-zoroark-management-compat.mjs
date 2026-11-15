import assert from "node:assert/strict";
import {normalizeEntry,ideaStatusCounts,ideaVisibleIndexes} from "../../docs/zoroark-idea-library.mjs";
import {mountIdeaMemo} from "../../docs/zoroark-ideas.mjs";

const seed=[
 {a:"ピカチュウ",b:"イーブイ",note:"未処理",status:"draft"},
 {a:"ヤクデ",b:"マルヤクデ",note:"候補",status:"adopted"},
 {a:"コラッタ",b:"ラッタ",note:"旧版の非採用",status:"archived"}
];
assert.equal(normalizeEntry(seed[2]).status,"archived","legacy archive must survive normalization");
assert.deepEqual(ideaStatusCounts(seed),{total:3,draft:1,adopted:1,archived:1});
assert.deepEqual(ideaVisibleIndexes(seed,"archived"),[2]);
const previous={document:globalThis.document,window:globalThis.window,localStorage:globalThis.localStorage};
const store=new Map([["ca-zoroark-admin-ideas-v1",JSON.stringify(seed)]]);
const handlers={};
const style={remove(){},textContent:""};
const dialog={className:"",addEventListener(){},removeEventListener(){},close(){},remove(){},showModal(){}};
const host={innerHTML:"",addEventListener(name,fn){handlers[name]=fn;},removeEventListener(){},
 querySelector(selector){if(selector==="#zim-book-search")return {value:""};return null;}};
try{
 globalThis.localStorage={getItem:k=>store.get(k)||null,setItem(k,v){store.set(k,v)}};
 globalThis.document={createElement(tag){return tag==="style"?style:dialog},
  head:{append(){}},body:{append(){}}};
 globalThis.window={confirm:()=>true,scrollTo(){}};
 const stop=mountIdeaMemo({host,role:"admin",onBack(){}});
 const click=(selector,dataset={})=>handlers.click({target:{
  closest(test){return test===selector?{dataset}:null}
 }});
 assert.ok(host.innerHTML.includes("正式 42組"),"official baseline remains present");
 assert.ok(host.innerHTML.includes("未処理 1件")&&host.innerHTML.includes("採用候補 1件"),
   "management counters survive notebook integration");
 assert.ok(!host.innerHTML.includes("コラッタ × ラッタ"),"legacy archive hidden from active view");
 click("[data-book-kind]",{bookKind:"trash"});
 assert.ok(host.innerHTML.includes("コラッタ × ラッタ"),"old archive visible in trash");
 assert.ok(host.innerHTML.includes("📦 非採用で保管中"),"archive remains distinct from game-wide stop");
 click("[data-memo-restore]",{memoRestore:"2"});
 assert.equal(JSON.parse(store.get("ca-zoroark-admin-ideas-v1"))[2].status,"draft",
  "legacy archive restore is persistent");
 click("[data-book-kind]",{bookKind:"memo"});
 click("[data-memo-status]",{memoStatus:"adopted"});
 assert.ok(host.innerHTML.includes("ヤクデ × マルヤクデ"),"adopted filter includes candidate");
 assert.ok(!host.innerHTML.includes("ピカチュウ × イーブイ"),"adopted filter excludes drafts");
 click("[data-memo-archive]",{memoArchive:"1"});
 assert.equal(JSON.parse(store.get("ca-zoroark-admin-ideas-v1"))[1].status,"archived",
  "non-adopted state is reversible, not deleted");
 click("[data-book-kind]",{bookKind:"trash"});
 assert.ok(host.innerHTML.includes("ヤクデ × マルヤクデ"),"new archive is visible in trash");
 click("[data-memo-restore]",{memoRestore:"1"});
 assert.equal(JSON.parse(store.get("ca-zoroark-admin-ideas-v1"))[1].status,"draft");
 assert.equal(JSON.parse(store.get("ca-zoroark-admin-ideas-v1")).length,3,
  "never delete or replace existing user data");
 assert.ok(!store.has("ca-zoroark-notebook-trash-v1"),
  "legacy archive restore must not force local tombstone writes");
 stop();
 console.log("ZOROARK_MANAGEMENT_LEGACY_ARCHIVE_PASS old_state_preserved=true restore=true live_game_untouched=true");
}finally{
 for(const [key,val] of Object.entries(previous)){
  if(val===undefined)delete globalThis[key];else globalThis[key]=val;
 }
}
