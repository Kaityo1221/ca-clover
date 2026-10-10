import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {assessCaMasterSource} from "../supabase/functions/_shared/ca-master-source-preflight.mjs";

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
];
for(const c of cases){
  const result=assessCaMasterSource(c.records,{
    unresolvedCount:c.unresolvedCount,conflictCount:c.conflictCount,
  });
  assert.equal(result.ok,c.ok,c.label);
  if(c.reason)assert.equal(result.reason,c.reason,c.label);
  if(c.ok){
    assert.equal(result.caRows.length,c.rows,c.label);
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

console.log("CA master source preflight: 12 source cases and Edge write-order checks PASS");
