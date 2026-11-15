import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {OFFICIAL_ZOROARK_42,OFFICIAL_ZOROARK_LEVELS,findOfficialZoroarkPairs} from "../../docs/zoroark-official42.mjs";
import {mountIdeaMemo} from "../../docs/zoroark-ideas.mjs";

assert.equal(OFFICIAL_ZOROARK_42.length,42);
const counts=Object.fromEntries(["easy","normal","hard"].map(level=>[level,findOfficialZoroarkPairs({level}).length]));
assert.deepEqual(counts,{easy:12,normal:15,hard:15});
assert.equal(new Set(OFFICIAL_ZOROARK_42.map(x=>x.id)).size,42);
const keys=OFFICIAL_ZOROARK_42.map(x=>[x.a,x.b].sort().join("|"));
assert.equal(new Set(keys).size,42,"game pair keys must be unique");
for(const row of OFFICIAL_ZOROARK_42){
 assert.ok(Object.isFrozen(row));
 assert.ok(["easy","normal","hard"].includes(row.level));
 for(const field of ["id","a","b","common","difference"])assert.ok(typeof row[field]==="string"&&row[field].trim(),field);
}
assert.ok(Object.isFrozen(OFFICIAL_ZOROARK_42));
assert.equal(findOfficialZoroarkPairs({query:"ピカチュウ"}).length>=2,true);
assert.equal(findOfficialZoroarkPairs({query:"エモンガ"}).length>=2,true);
assert.equal(findOfficialZoroarkPairs({level:"easy",query:"デデンネ"}).length,1);
assert.equal(findOfficialZoroarkPairs({level:"hard",query:"デデンネ"}).length,0);
assert.equal(findOfficialZoroarkPairs({query:"  ﾋﾟｶﾁｭｳ  "}).length>=2,true,"NFKC search works");
assert.throws(()=>findOfficialZoroarkPairs({level:"invalid"}));

const gameModule=readFileSync("docs/zoroark-ideas.mjs","utf8");
const html=readFileSync("docs/index.html","utf8");
assert.ok(html.includes('if(profile?.role!=="admin")'),"ADMIN guard remains");
assert.ok(gameModule.includes('if(role!=="admin")throw Error'),"UI rejects non-admin");
assert.ok(!gameModule.includes("ZOROARK_CATALOG_QA_URL"),"no unpublished API dependency");
assert.ok(!gameModule.includes("zoroark_topic_submit"),"no publication writes");
assert.ok(gameModule.includes("data-catalog-view")&&gameModule.includes("data-official-level"));
assert.ok(html.includes("zoroark-ideas.mjs?v=20261115-readonly42-v1"));

const backup={document:globalThis.document,window:globalThis.window,localStorage:globalThis.localStorage};
try{
 const storageKey="ca-zoroark-admin-ideas-v1";
 const sample=[{a:"ピカチュウ",b:"イーブイ",note:"端末内のメモは保持",status:"draft"}];
 const data=new Map([[storageKey,JSON.stringify(sample)]]);
 let writes=0;
 globalThis.localStorage={
  getItem(key){return data.get(key)||null},
  setItem(key,value){writes++;data.set(key,value)}
 };
 const style={remove(){}};
 const dialog={addEventListener(){},removeEventListener(){},close(){},remove(){}};
 globalThis.document={createElement(type){return type==="style"?style:dialog},head:{append(){}},body:{append(){}}};
 globalThis.window={scrollTo(){}};
 const events={},search={value:""};
 const host={
  innerHTML:"",
  addEventListener(kind,callback){events[kind]=callback},
  removeEventListener(){},
  querySelector(selector){return selector==="#zim-official-query"?search:null}
 };
 assert.throws(()=>mountIdeaMemo({host,role:"ca",onBack(){}}),/ADMIN only/);
 const destroy=mountIdeaMemo({host,role:"admin",onBack(){}});
 const click=(selector,dataset={})=>events.click({target:{closest(k){return k===selector?{dataset}:null}}});
 assert.ok(host.innerHTML.includes("端末内のメモは保持"));
 click("[data-catalog-view]",{catalogView:"official"});
 assert.ok(host.innerHTML.includes("正式お題 42組"));
 assert.equal((host.innerHTML.match(/class="zim-official-card"/g)||[]).length,42);
 assert.ok(host.innerHTML.includes("デデンネ × エモンガ"));
 click("[data-official-level]",{officialLevel:"normal"});
 assert.equal((host.innerHTML.match(/class="zim-official-card"/g)||[]).length,15);
 search.value="ガーディ";click("[data-official-search]");
 assert.equal((host.innerHTML.match(/class="zim-official-card"/g)||[]).length,1);
 click("[data-official-clear]");
 assert.equal((host.innerHTML.match(/class="zim-official-card"/g)||[]).length,15);
 click("[data-catalog-view]",{catalogView:"memo"});
 assert.ok(host.innerHTML.includes("端末内のメモは保持"));
 assert.equal(writes,0,"official browsing never writes localStorage");
 assert.deepEqual(JSON.parse(data.get(storageKey)),sample);
 destroy();
}finally{
 for(const [k,v] of Object.entries(backup)){if(v===undefined)delete globalThis[k];else globalThis[k]=v}
}
console.log("ZOROARK_OFFICIAL42_PAGES_PASS");
