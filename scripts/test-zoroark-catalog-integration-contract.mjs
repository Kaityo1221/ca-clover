import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

function loadIsolatedTypeScript(filename){
 const source=readFileSync(new URL("../"+filename,import.meta.url),"utf8");
 const compiled=ts.transpileModule(source,{compilerOptions:{
   module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022
 }}).outputText;
 const mod={exports:{}};
 const requireOnly=(name)=>{
   if(name==="server-only")return {};
   if(name==="node:crypto")return {randomInt:()=>0};
   throw new Error("Unexpected source dependency: "+name);
 };
 new Function("require","module","exports",compiled)(requireOnly,mod,mod.exports);
 return mod.exports;
}
const {PAIRS,chooseZoroarkPair}=loadIsolatedTypeScript("src/lib/zoroark-catalog.server.ts");
const {publishedTopicToPair}=loadIsolatedTypeScript("src/lib/zoroark-catalog-review.ts");
const officialIds=PAIRS.map(p=>p.id);
assert.equal(PAIRS.length,42,"official catalog stays 42");
assert.deepEqual(["easy","normal","hard"].map(l=>PAIRS.filter(p=>p.level===l).length),[12,15,15]);
assert.equal(chooseZoroarkPair("easy",[],()=>0).id,"e01",
 "three-argument/legacy selection must remain compatible");
const disabled=new Set(["e01"]);
assert.equal(chooseZoroarkPair("easy",[],()=>0,[],disabled).id,"e02",
 "disabled official topic never selected");
assert.equal(chooseZoroarkPair("easy",["e02"],()=>0,[],disabled).id,"e03",
 "recent suppression remains intact after disable");
const preview=publishedTopicToPair({
 id:1,status:"published",version:1,a:"候補A",b:"候補B",aNo:"25",bNo:"133",
 level:"easy",common:"共通点",difference:"違うところ"
});
assert.equal(preview.id,"x0001");
assert.equal(chooseZoroarkPair("easy",[],()=>12,[preview]).id,"x0001",
 "published preview topic is supplied as the FOURTH argument");
assert.equal(chooseZoroarkPair("easy",[],()=>11,[preview],disabled).id,"x0001",
 "official disable is supplied as the FIFTH argument, and does not delete preview candidates");
const allDisabled=new Set(PAIRS.filter(p=>p.level==="easy").map(p=>p.id));
assert.equal(chooseZoroarkPair("easy",[],()=>0,[preview],allDisabled).id,"x0001",
 "preview can still be used when all official topics of a difficulty are disabled");
assert.throws(()=>chooseZoroarkPair("easy",[],()=>0,[],allDisabled),/No catalog entries/,
 "all official topics disabled must fail closed without a fallback");
assert.throws(()=>chooseZoroarkPair("hard",[],()=>0,[preview],
 new Set(PAIRS.filter(p=>p.level==="hard").map(p=>p.id))),/No catalog entries/,
 "candidate difficulty cannot bypass the official selector");
assert.deepEqual(PAIRS.map(p=>p.id),officialIds,"selection never edits the canonical topic list");

const round=readFileSync("src/app/api/zoroark/round/route.ts","utf8");
const management=readFileSync("src/lib/zoroark-catalog-management.server.ts","utf8");
assert.match(round,/chooseZoroarkPair\(input\.difficulty,input\.recent,undefined,published,disabledIds\)/,
 "round API must pass both data sources in the correct argument positions");
assert.match(management,/process\.env\.VERCEL_ENV==="preview"/,
 "candidate catalog remains preview-only");
assert.match(management,/ZOROARK_CATALOG_RUNTIME_ENABLED/,
 "candidate catalog must remain independently feature-gated");
console.log("ZOROARK_CATALOG_OFFICIAL_INTEGRATION_PASS 42=12/15/15 official_disable=true preview_isolated=true");
