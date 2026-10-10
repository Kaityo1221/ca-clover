import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {pauseAndAuditCaMasterFailure,shouldReleaseCaMasterLease}
  from "../supabase/functions/_shared/ca-master-recovery.mjs";

function client({pause="ok",audit="ok"}={}){
  const calls=[];
  const admin={
    from(table){
      assert.ok(["sync_automation_state","sync_runs"].includes(table),
        "Failure handler must never write CA, identity or medal tables");
      if(table==="sync_automation_state"){
        return {
          update(body){
            calls.push({op:"pause",table,body,filters:[]});
            const last=calls[calls.length-1];
            return {
              eq(column,value){last.filters.push([column,value]);return this;},
              select(columns){assert.equal(columns,"id");return this;},
              async maybeSingle(){
                if(pause==="throw") throw new Error("mock REST transport failed");
                if(pause==="error") return {data:null,error:{code:"XX001"}};
                if(pause==="no-row") return {data:null,error:null};
                return {data:{id:1},error:null};
              },
            };
          },
        };
      }
      return {
        async insert(body){
          calls.push({op:"audit",table,body});
          if(audit==="throw") throw new Error("mock audit transport failed");
          return {error:audit==="error"?{code:"XX002"}:null};
        },
      };
    },
  };
  return {admin,calls};
}

const cases=[
  {label:"owner pause and audit",pause:"ok",audit:"ok",expected:true},
  {label:"owner pause but audit returns SQL error",pause:"ok",audit:"error",expected:true},
  {label:"owner pause but audit network fails",pause:"ok",audit:"throw",expected:true},
  {label:"lease owner changed, pause does not match",pause:"no-row",audit:"ok",expected:false},
  {label:"pause SQL error",pause:"error",audit:"ok",expected:false},
  {label:"pause network exception",pause:"throw",audit:"ok",expected:false},
];
const oldConsoleError=console.error;
try{
  console.error=()=>{};
  for(const test of cases){
    const {admin,calls}=client(test);
    const paused=await pauseAndAuditCaMasterFailure({
      admin,
      owner:"30000000-0000-4000-8000-000000000001",
      stage:"community-metadata",
      finishedAt:"2026-10-10T10:52:00.000Z",
    });
    assert.equal(paused,test.expected,test.label);
    assert.equal(calls.length,2,"Always attempt pause AND audit");
    assert.deepEqual(calls[0].body,{ca_master_sync_enabled:false},
      "Must pause dedicated CA master only");
    assert.deepEqual(calls[0].filters,[
      ["id",1],["ca_master_lease_owner","30000000-0000-4000-8000-000000000001"]
    ],"Only the current owner can confirm the dedicated pause");
    assert.equal(calls[1].table,"sync_runs");
    assert.equal(calls[1].body.status,"partial");
    assert.equal(calls[1].body.details.code,"CA_MASTER_WRITE_INTERRUPTED");
    assert.equal(calls[1].body.details.stage,"community-metadata");
    assert.equal(calls[1].body.details.requires_admin_review,true);
    assert.equal(
      shouldReleaseCaMasterLease({
        writeStarted:true,writeFailed:true,pauseConfirmed:paused,
      }),
      test.expected,"Do not release lease if pause is unconfirmed"
    );
  }
}finally{
  console.error=oldConsoleError;
}

const edge=readFileSync(new URL("../supabase/functions/sync-ca-master/index.ts",import.meta.url),"utf8");
// Preflight failures occur before metadata writes but must still pause
// dedicated CA-master (or keep a lease until it expires when pause fails).
{
  const {admin,calls}=client({pause:"ok",audit:"ok"});
  const stopped=await pauseAndAuditCaMasterFailure({
    admin,owner:"30000000-0000-4000-8000-000000000001",
    stage:"source-preflight",code:"CA_MASTER_SOURCE_INVALID",
    finishedAt:"2026-10-10T11:00:00.000Z",
  });
  assert.equal(stopped,true);
  assert.equal(calls[1].body.details.code,"CA_MASTER_SOURCE_INVALID");
  assert.equal(calls[1].body.details.stage,"source-preflight");
}
assert.ok(edge.includes('code:"CA_MASTER_SOURCE_INVALID"'),
  "Incomplete CA source must cause an operator-reviewed dedicated stop");
assert.ok(edge.includes('code:"CA_MASTER_MAPPING_AMBIGUOUS"'),
  "Ambiguous DB mapping must cause an operator-reviewed dedicated stop");
assert.ok(edge.includes("retainLeaseForReview=!stopped"),
  "Failed preflight stop must retain the active lease");
assert.ok(edge.includes("!retainLeaseForReview&&shouldReleaseCaMasterLease"),
  "Cannot release preflight lease if dedicated stop was not confirmed");

assert.ok(edge.includes("pauseAndAuditCaMasterFailure({"),
  "The Edge function must use the tested failure handler, not a duplicate");
assert.ok(edge.includes("if(!writeStarted)return false"),
  "No metadata write means no need to issue failure state writes");
assert.ok(edge.includes("shouldReleaseCaMasterLease({writeStarted,writeFailed,pauseConfirmed})"),
  "Release decision must depend on confirmed pause");

console.log("CA master Edge REST failure injection: 7 pause/audit scenarios and fail-closed source contracts PASS");
