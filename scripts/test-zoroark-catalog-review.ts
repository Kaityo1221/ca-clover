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
console.log("ZOROARK_CATALOG_REVIEW_PASS");
