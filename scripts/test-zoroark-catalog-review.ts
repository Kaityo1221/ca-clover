import assert from "node:assert/strict";
import {validateTopicCandidate,topicPairKey,isExistingCatalogPair,publishedTopicToPair} from "../src/lib/zoroark-catalog-review.ts";

const base={a:"マッギョ",b:"カイリキー",aNo:"618",bNo:"68",
 common:"マッチョ",difference:"タイプと姿",level:"normal"};
const parsed=validateTopicCandidate(base);
assert.ok(parsed);
assert.equal(topicPairKey(" カイリキー ","マッギョ"),topicPairKey(base.a,base.b));
assert.equal(publishedTopicToPair({...base,id:27,status:"published",version:4}).id,"x0027");
assert.equal(publishedTopicToPair({...base,id:27,status:"published",version:4}).level,"normal");
assert.equal(isExistingCatalogPair(parsed,[{id:"m01",level:"normal",a:"カイリキー",b:"マッギョ",common:"",difference:""}]),true);
for(const value of [
 {...base,a:" "},{...base,b:"マッギョ"},{...base,difference:""},{...base,level:"all"},
 {...base,common:""},{...base,aNo:"no"},{...base,bNo:"123456"},{...base,a:42}
])assert.equal(validateTopicCandidate(value),null);
for(const row of [{...base,id:27,status:"pending"},{...base,id:10000,status:"published"},
 {...base,id:27,status:"published",difference:""}])
 assert.throws(()=>publishedTopicToPair(row));
import {readFileSync} from "node:fs";
const management=readFileSync(new URL("../src/lib/zoroark-catalog-management.server.ts",import.meta.url),"utf8");
const route=readFileSync(new URL("../src/app/api/zoroark/catalog/route.ts",import.meta.url),"utf8");
const round=readFileSync(new URL("../src/app/api/zoroark/round/route.ts",import.meta.url),"utf8");
for(const token of ["ZOROARK_CATALOG_MANAGEMENT_ENABLED","ZOROARK_CATALOG_PUBLISH_ENABLED",
 "ZOROARK_CATALOG_RUNTIME_ENABLED","VERCEL_ENV","runtimePublishedPairs"])
 assert.ok(management.includes(token),"feature gate "+token);
for(const token of ["profiles","admin","allowedZoroarkOrigin","published","runtimeEnabled",
 "auth.getUser","publishing_disabled","already_in_base_catalog"])
 assert.ok(route.includes(token),"admin API boundary "+token);
assert.ok(route.includes("baseKeys:PAIRS.map"),"ADMIN statuses cover baseline 42 exact pairs");
assert.ok(route.includes("basePairs:PAIRS.map"),"ADMIN response includes official pair details");
for(const field of ["id:x.id","level:x.level","a:x.a","b:x.b","common:x.common","difference:x.difference"])
 assert.ok(route.includes(field),"official field "+field);
const officialSource=readFileSync(new URL("../src/lib/zoroark-catalog.server.ts",import.meta.url),"utf8");
assert.equal((officialSource.match(/\{ id: "[emh]\d{2}"/g)||[]).length,42,"canonical game catalog stays 42 pairs");
assert.equal((officialSource.match(/level: "easy"/g)||[]).length,12);
assert.equal((officialSource.match(/level: "normal"/g)||[]).length,15);
assert.equal((officialSource.match(/level: "hard"/g)||[]).length,15);
assert.ok(route.indexOf("const auth=await authorize(req)")<route.indexOf("basePairs:PAIRS.map"),"ADMIN auth precedes list serialization");
assert.ok(round.includes("catalogRuntimeEnabled() ? await runtimePublishedPairs"),"round uses staged catalog only when gated");
console.log("ZOROARK_CATALOG_REVIEW_PASS");
