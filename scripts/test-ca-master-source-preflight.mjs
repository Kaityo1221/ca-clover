import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {assessCaMasterSource,assessCaMasterBaseline} from "../supabase/functions/_shared/ca-master-source-preflight.mjs";

const ca=(changes={})=>({
  sourceKey:"ca-one",
  trainerName:"CA One",
  caLevel:"1st",
  communityName:"Community One",
  communityId:"10000000-0000-4000-8000-000000000001",
  prefecture:"東京都",
  joinDate:null,
  status:"active",
  latitude:null,
  longitude:null,
  ...changes,
});
const cases=[
  {label:"ordinary source",records:[ca()],unresolvedCount:0,conflictCount:0,ok:true,rows:1},
  {label:"same CA in multiple Communities",records:[ca(),ca({communityId:"10000000-0000-4000-8000-000000000002",communityName:"Community Two"})],unresolvedCount:0,conflictCount:0,ok:true,rows:1},
  {label:"different CAs",records:[ca(),ca({sourceKey:"ca-two",trainerName:"CA Two"})],unresolvedCount:0,conflictCount:0,ok:true,rows:2},
  {label:"empty CSV",records:[],unresolvedCount:0,conflictCount:0,ok:false,reason:"EMPTY_MASTER"},
  {label:"unresolved Campfire Community",records:[ca({communityId:null})],unresolvedCount:1,conflictCount:0,ok:false,reason:"UNRESOLVED_CAMPFIRE_COMMUNITY"},
  {label:"contradictory Community mapping",records:[ca()],unresolvedCount:0,conflictCount:1,ok:false,reason:"AMBIGUOUS_COMMUNITY_MAPPING"},
  {label:"same CA conflicting level",records:[ca(),ca({caLevel:"2nd"})],unresolvedCount:0,conflictCount:0,ok:false,reason:"INCONSISTENT_DUPLICATE_CA"},
  {label:"same CA conflicting status",records:[ca(),ca({status:"inactive"})],unresolvedCount:0,conflictCount:0,ok:false,reason:"INCONSISTENT_DUPLICATE_CA"},
  {label:"same CA conflicting prefecture",records:[ca(),ca({prefecture:"神奈川県"})],unresolvedCount:0,conflictCount:0,ok:false,reason:"INCONSISTENT_DUPLICATE_CA"},
  {label:"invalid level",records:[ca({caLevel:"3rd"})],unresolvedCount:0,conflictCount:0,ok:false,reason:"INVALID_CA_RECORD"},
  {label:"invalid source ID",records:[ca({sourceKey:""})],unresolvedCount:0,conflictCount:0,ok:false,reason:"INVALID_CA_RECORD"},
  {label:"invalid counts",records:[ca()],unresolvedCount:-1,conflictCount:0,ok:false,reason:"INVALID_PREFLIGHT_COUNTS"},
  {label:"missing status must not activate",records:[ca({status:"unknown"})],unresolvedCount:0,conflictCount:0,ok:false,reason:"INVALID_CA_RECORD"},
  {label:"dropped input CSV row rejected",records:[ca()],unresolvedCount:0,conflictCount:0,inputRowCount:2,ok:false,reason:"SKIPPED_OR_MALFORMED_SOURCE_ROWS"},
];
for(const c of cases){
  const result=assessCaMasterSource(c.records,{
    unresolvedCount:c.unresolvedCount,conflictCount:c.conflictCount,
    inputRowCount:c.inputRowCount??c.records.length,
  });
  assert.equal(result.ok,c.ok,c.label);
  if(c.reason)assert.equal(result.reason,c.reason,c.label);
  if(c.ok){
    assert.equal(result.caRows.length,c.rows,c.label);
    assert.ok(result.caRows.every(r=>!("latitude" in r)&&!("longitude" in r)),
      "CA metadata upsert may not erase coordinates from an incomplete CSV");
    assert.equal(new Set(result.caRows.map(r=>r.source_key)).size,c.rows,
      "PostgREST onConflict upsert must never contain duplicate source_key");
  }else assert.ok(!("caRows" in result),"Rejected sources must not return a write plan");
}

const code=readFileSync(
  new URL("../supabase/functions/sync-ca-master/index.ts",import.meta.url),"utf8");
const beforeWrite=code.indexOf('writeStarted=true;');
const p1=code.indexOf("assessCaMasterSource(records");
const p2=code.indexOf('if(conflicts.length){');
const caRead=code.indexOf('.select("id,campfire_community_id,name,prefecture,campfire_url")');
const caWrite=code.indexOf('.upsert(caRows,{onConflict:"source_key"})');
assert.ok(p1>0 && p2>0 && beforeWrite>0 && caWrite>0,"Preflight and write anchor found");
assert.ok(p1<caRead && caRead<p2 && p2<beforeWrite && beforeWrite<caWrite,
 "All source AND database mapping preflights must run before first metadata write");
assert.ok(code.includes("CA_MASTER_VERIFIED_IDENTITY_ASSIGNMENT_REVIEW_REQUIRED"),
 "Verified Identity collision must trigger operator review");


const baseline={manually_verified:true,source_rows:100,unique_ca_members:80};
assert.equal(assessCaMasterBaseline(null,100,80).reason,"MISSING_VERIFIED_BASELINE");
assert.equal(assessCaMasterBaseline({...baseline,manually_verified:false},100,80).ok,false);
assert.equal(assessCaMasterBaseline(baseline,89,80).reason,"SOURCE_COUNT_DROPPED");
assert.equal(assessCaMasterBaseline(baseline,100,71).reason,"SOURCE_COUNT_DROPPED");
assert.equal(assessCaMasterBaseline(baseline,201,80).reason,"SOURCE_COUNT_SPIKED");
assert.equal(assessCaMasterBaseline(baseline,90,72).ok,true);
assert.equal(assessCaMasterBaseline(baseline,100,80).ok,true);

console.log("CA master source preflight: 14 source cases, 7 baseline cases and Edge write-order checks PASS");
