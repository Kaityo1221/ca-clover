// Real PostgREST HTTP boundaries on a disposable GitHub Actions DB.
// No project URL, Supabase API key, real tokens or user records.
import assert from "node:assert/strict";

const base=process.env.QA_POSTGREST_URL??"http://127.0.0.1:3000";
const owner="60000000-0000-4000-8000-000000000001";
const headers={"Content-Type":"application/json","Prefer":"return=representation"};

async function call(path,options={}){
  const r=await fetch(base+path,options);
  const raw=await r.text();
  let body;try{body=raw?JSON.parse(raw):null;}catch{body=raw;}
  return {status:r.status,body};
}
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
for(let attempt=0;attempt<90;attempt++){
  try{
    const probe=await call("/ca_members?select=source_key,status");
    if(probe.status===200&&Array.isArray(probe.body)&&probe.body.length===1)break;
  }catch{}
  if(attempt===89)throw Error("Disposable PostgREST fixture did not become ready");
  await delay(1000);
}
const beforeIdentity=await call("/user_ca_identities?select=*&order=user_id.asc");
const beforeMedals=await call("/stamp_collections?select=*&order=id.asc");
assert.equal(beforeIdentity.status,200);
assert.equal(beforeMedals.status,200);
assert.equal(beforeIdentity.body.length,1);
assert.equal(beforeMedals.body.length,1);

// REST request #1 commits CA metadata as its own DB transaction.
const first=await call("/ca_members?source_key=eq.synthetic-ca",{
  method:"PATCH",headers,body:JSON.stringify({status:"inactive"}),
});
assert.equal(first.status,200,JSON.stringify(first.body));
assert.equal(first.body.length,1);
assert.equal(first.body[0].status,"inactive");

// REST request #2 fails AFTER #1 has already committed.
const second=await call("/communities?id=eq.10000000-0000-4000-8000-000000000001",{
  method:"PATCH",headers,body:JSON.stringify({name:null}),
});
assert.equal(second.status,400,"DB NOT NULL violation must surface as HTTP 400");
assert.equal(second.body?.code,"23502","Expected real PostgreSQL constraint error");

// The handler would now pause only CA-master on the same owner fence.
const wrongOwner=await call(
  "/sync_automation_state?id=eq.1&ca_master_lease_owner=eq.60000000-0000-4000-8000-000000000002",
  {method:"PATCH",headers,body:JSON.stringify({ca_master_sync_enabled:false})},
);
assert.equal(wrongOwner.status,200);
assert.deepEqual(wrongOwner.body,[],"Stale/wrong owner must not pause or release");

const confirmedStop=await call(
  "/sync_automation_state?id=eq.1&ca_master_lease_owner=eq."+owner,
  {method:"PATCH",headers,body:JSON.stringify({ca_master_sync_enabled:false})},
);
assert.equal(confirmedStop.status,200,JSON.stringify(confirmedStop.body));
assert.equal(confirmedStop.body.length,1,"Owner-specific pause must confirm one row");
assert.equal(confirmedStop.body[0].ca_master_sync_enabled,false);
assert.equal(confirmedStop.body[0].enabled,true,"Independent Cron must stay active");

// Committed write #1 remains; failed REST request #2 rolled back.
const ca=await call("/ca_members?select=status");
const community=await call("/communities?select=name");
assert.equal(ca.body[0].status,"inactive","Committed stage must not be silently undone");
assert.equal(community.body[0].name,"Original Community",
  "Failed stage must not modify Community metadata");
const afterIdentity=await call("/user_ca_identities?select=*&order=user_id.asc");
const afterMedals=await call("/stamp_collections?select=*&order=id.asc");
assert.deepEqual(afterIdentity.body,beforeIdentity.body,"Identity record must be identical");
assert.deepEqual(afterMedals.body,beforeMedals.body,"Existing medal must be identical");

// A failed transport must not be misreported as a successful HTTP write.
let transportError=false;
try{
  await fetch("http://127.0.0.1:39999/communities",{signal:AbortSignal.timeout(500)});
}catch{transportError=true;}
assert.equal(transportError,true,"Network failure must be distinguishable from a DB commit");

console.log("Isolated PostgREST HTTP QA PASS: independent commits, 400 rollback, owner-fenced pause, unaffected identities/medals, network fault");
