// Phase E: offline-only, no production API calls, DB reads, or live writes.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  assessCaMasterSource,
  assessCaMasterBaseline,
} from "../../supabase/functions/_shared/ca-master-source-preflight.mjs";
import {
  shouldReleaseCaMasterLease,
  pauseAndAuditCaMasterFailure,
} from "../../supabase/functions/_shared/ca-master-recovery.mjs";

const source = path => readFileSync(path, "utf8");
const master = source("supabase/functions/sync-ca-master/index.ts");
const coordinate = source("supabase/functions/sync-ca-master-coordinates/index.ts");
const auto = source("supabase/functions/sync-campfire-auto/index.ts");
const admin = source("supabase/functions/sync-ca-master-admin/index.ts");
const legacy = source("src/app/api/sync/ca-master/route.ts");
const migration = source("supabase/migrations/20261013_ca_master_minimal_barrier.sql");

// Strongly pin *current* safety, independent of tests against the future writer.
for (const [name, file] of [["master", master], ["coordinates", coordinate]]) {
  assert.match(file, /function isLegacyMasterWriterRetired\(\):boolean \{ return true; \}/, name);
  assert.match(file, /if\(isLegacyMasterWriterRetired\(\)\)\s*\{\s*return json\(/, name);
  assert.match(file, /masterGate\.ca_master_sync_enabled!==true/, name);
  assert.ok(file.indexOf("if(isLegacyMasterWriterRetired())") > -1 &&
            file.indexOf("if(isLegacyMasterWriterRetired())") < file.indexOf("const response=await fetch(CA_MASTER_URL"),
            name + " must retire before requesting CA master CSV");
}
assert.match(auto, /state\.ca_master_sync_enabled===true && coordinateRefreshDue/,
             "CA-master gate must not disable unrelated Campfire jobs");
assert.match(admin, /masterGate\.ca_master_sync_enabled!==true/,
             "admin trigger must fail-closed");
assert.match(legacy, /CA_MASTER_LEGACY_SYNC_DISABLED/);
assert.match(legacy, /status:\s*410/);
assert.match(migration, /ON DELETE RESTRICT NOT DEFERRABLE/);
assert.match(migration, /ca_master_sync_enabled boolean NOT NULL DEFAULT false/);
assert.match(migration, /2099-01-01T00:00:00Z/);

// Imported Phase D pure helpers are staged for tests but NOT wired into
// production-bound Edge Functions. Unsafe auto-merge cannot enable a writer.
assert.doesNotMatch(master, /ca-master-source-preflight|ca-master-recovery/,
  "Phase D helpers remain isolated; do not wire into a write-capable writer");
const ca = overrides => ({
  sourceKey:"test-ca",trainerName:"Trainer",caLevel:"1st",
  communityId:"11111111-1111-4111-8111-111111111111",
  communityName:"Test",prefecture:"Tokyo",status:"active",joinDate:null,
  ...overrides,
});
const scenarios = [
  [[],0,0,"EMPTY_MASTER"],
  [[ca()],1,0,"UNRESOLVED_CAMPFIRE_COMMUNITY"],
  [[ca()],0,1,"AMBIGUOUS_COMMUNITY_MAPPING"],
  [[ca({status:"unknown"})],0,0,"INVALID_CA_RECORD"],
  [[ca({sourceKey:""})],0,0,"INVALID_CA_RECORD"],
  [[ca(),ca({caLevel:"2nd"})],0,0,"INCONSISTENT_DUPLICATE_CA"],
];
for (const [records,unresolvedCount,conflictCount,reason] of scenarios) {
  const result=assessCaMasterSource(records,{unresolvedCount,conflictCount});
  assert.equal(result.ok,false,reason);
  assert.equal(result.reason,reason);
  assert.ok(!("caRows" in result),"invalid source must not produce write plan");
}
const same=assessCaMasterSource([ca(),ca({communityId:"22222222-2222-4222-8222-222222222222"})],
  {unresolvedCount:0,conflictCount:0});
assert.equal(same.ok,true);
assert.equal(same.uniqueCaRecords,1);
assert.ok(!("latitude" in same.caRows[0]) && !("longitude" in same.caRows[0]));
assert.equal(assessCaMasterSource([ca()],{unresolvedCount:0,conflictCount:0,inputRowCount:2}).ok,false);

const approved={manually_verified:true,source_rows:100,unique_ca_members:80};
assert.equal(assessCaMasterBaseline(null,100,80).ok,false);
assert.equal(assessCaMasterBaseline({...approved,manually_verified:false},100,80).ok,false);
assert.equal(assessCaMasterBaseline(approved,89,80).reason,"SOURCE_COUNT_DROPPED");
assert.equal(assessCaMasterBaseline(approved,100,71).reason,"SOURCE_COUNT_DROPPED");
assert.equal(assessCaMasterBaseline(approved,201,80).reason,"SOURCE_COUNT_SPIKED");
assert.equal(assessCaMasterBaseline(approved,100,80).ok,true);

assert.equal(shouldReleaseCaMasterLease({writeStarted:true,writeFailed:true,pauseConfirmed:false}),false);
assert.equal(shouldReleaseCaMasterLease({writeStarted:true,writeFailed:true,pauseConfirmed:true}),true);
assert.equal(shouldReleaseCaMasterLease({writeStarted:false,writeFailed:true,pauseConfirmed:false}),true);

// Synthetic Supabase stub; method exercises error path only, no real connection.
const calls=[];
const mocked={from(table){
  assert.ok(["sync_automation_state","sync_runs"].includes(table));
  if(table==="sync_automation_state"){
    return {update(value){
      calls.push(["pause",value]);
      return {eq(){return this;},select(){return this;},async maybeSingle(){
        return {data:null,error:{code:"MOCK_FAIL"}};
      }};
    }};
  }
  return {async insert(value){calls.push(["audit",value]);return {error:null};}};
}};
const oldConsoleError=console.error;
let paused;
try {
  console.error=()=>{};
  paused=await pauseAndAuditCaMasterFailure({
    admin:mocked,owner:"synthetic-owner",stage:"test-stage",
    finishedAt:"2026-10-13T00:00:00.000Z"});
} finally { console.error=oldConsoleError; }
assert.equal(paused,false,"unconfirmed pause must not count as stopped");
assert.deepEqual(calls.map(x=>x[0]),["pause","audit"]);
assert.equal(calls[0][1].ca_master_sync_enabled,false);
assert.equal(calls[1][1].details.requires_admin_review,true);
console.log("CA_MASTER_INTEGRATION_OFF_PASS: live stop guards unchanged; Phase D helpers isolated");
