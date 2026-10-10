import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {shouldReleaseCaMasterLease} from "../supabase/functions/_shared/ca-master-recovery.mjs";

const cases=[
  ["normal completion",true,false,false,true],
  ["normal preflight rejection",false,true,false,true],
  ["partial write and confirmed stop",true,true,true,true],
  ["partial write with failed safety stop",true,true,false,false],
  ["no writes, pause status not applicable",false,false,false,true],
];
for(const [label,writeStarted,writeFailed,pauseConfirmed,expected] of cases){
  assert.equal(shouldReleaseCaMasterLease({writeStarted,writeFailed,pauseConfirmed}),
    expected,label);
}
const code=readFileSync(new URL("../supabase/functions/sync-ca-master/index.ts",import.meta.url),"utf8");
assert.ok(code.includes("shouldReleaseCaMasterLease({writeStarted,writeFailed,pauseConfirmed})"),
  "Edge function must actually use the tested fail-closed lease-release policy");
assert.ok(code.includes('.eq("ca_master_lease_owner",owner)'),
  "Only the active lease owner may pause a failing CA-master run");
assert.ok(code.includes("recordWriteFailure=async()=>"),
  "Partial failures must attempt a dedicated safety pause");
assert.ok(code.includes("CA_MASTER_WRITE_INTERRUPTED"),
  "Partial failures must be audit-recorded");
assert.ok(code.includes("internal_finish_ca_master_lease"),
  "Successful requests must release the execution lease");
console.log("CA master crash-recovery lease policy: 5 scenarios and Edge integration contracts PASS");
