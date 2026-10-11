/** Phase D fail-closed wiring regression. Static contract only, not Edge E2E. */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const master=read("supabase/functions/sync-ca-master/index.ts");
const admin=read("supabase/functions/sync-ca-master-admin/index.ts");
const auto=read("supabase/functions/sync-campfire-auto/index.ts");
const legacy=read("src/app/api/sync/ca-master/route.ts");
const position=(source,needle,label)=>{
  const index=source.indexOf(needle);
  assert.ok(index>=0,`Missing ${label}: ${needle}`);
  return index;
};

const masterAuth=position(master,'internal_get_sync_cron_secret',"master caller auth");
const masterOff=position(master,'if(masterGate?.ca_master_sync_enabled!==true)',"master gate OFF/missing guard");
const masterSentinel=position(master,'lastMasterTime>Date.now()+365*86400000',"2099 sentinel guard");
const lease=position(master,'internal_begin_ca_master_lease',"exclusive lease");
const csv=position(master,'fetch(CA_MASTER_URL',"CSV request");
const recheck=position(master,'if(writeGate?.ca_master_sync_enabled!==true)',"gate recheck");
const recheckSentinel=position(master,'writeSentinelTime>Date.now()+365*86400000',"sentinel recheck");
const stale=position(master,'if(staleKnownLinks.length>0)',"stale link rejection");
const baseline=master.lastIndexOf('assessCaMasterBaseline(');
const writes=position(master,'writeStarted=true;',"first metadata-write marker");
assert.ok(masterAuth<masterOff&&masterOff<masterSentinel&&masterSentinel<lease&&lease<csv,
  "Fail-closed master checks must run before CSV fetch and lease acquisition");
assert.ok(csv<recheck&&recheck<writes&&csv<recheckSentinel&&recheckSentinel<writes,
  "Master gate/sentinel must be rechecked after source fetch, before writes");
assert.ok(stale<writes&&baseline>stale&&baseline<writes,
  "Mapping and human-attested baseline validation must precede writes");
assert.ok(master.includes('CA_MASTER_LINK_CHANGE_REVIEW_REQUIRED'),
  "Detected stale link changes must pause");
assert.ok(master.includes('internal_reconcile_ca_master_links'),
  "Protected reconciliation RPC must remain in use");

const profile=position(admin,'profile?.role!=="admin"',"admin role requirement");
const adminGuard=position(admin,'if(masterGate?.ca_master_sync_enabled!==true)',"manual gate check");
const adminCall=position(admin,'supabaseUrl+"/functions/v1/sync-ca-master"',"manual forwarding");
assert.ok(profile<adminGuard&&adminGuard<adminCall,
  "Manual sync must validate ADMIN role and dedicated gate before forwarding");

const autoGuard=position(auto,'if(state.ca_master_sync_enabled===true&&coordinateRefreshDue)',"automatic gate check");
const autoMaster=position(auto,'"sync-ca-master",{}',"auto master invocation");
const afterBlock=position(auto,'const calendarInterval=',"independent scheduling");
assert.ok(autoGuard<autoMaster&&autoMaster<afterBlock,
  "Auto master must only run in dedicated gated block");
const gatedBlock=auto.slice(autoGuard,afterBlock);
assert.equal((gatedBlock.match(/invokeInternal\(/g)||[]).length,1,
  "Only master invocation is permitted in master-gated section");
for(const feature of ['"sync-campfire-public"','"sync-community-icons"','notificationResult=await invokeInternal',
                       'claimNotificationResult=await invokeInternal']){
  assert.ok(auto.indexOf(feature)>afterBlock,`Unrelated scheduler flow must remain outside master gate: ${feature}`);
}
assert.ok(auto.includes('if(!state.enabled) return json({ok:true,status:"disabled"})'),
  "General scheduler enabled state must remain separate");

assert.ok(legacy.includes('CA_MASTER_LEGACY_SYNC_DISABLED')&&legacy.includes('{ status: 410 }'),
  "Legacy unsafe Next.js writer must stay retired");

console.log("PASS: Phase D static gate wiring contract (direct/admin/scheduler/legacy)");
// This never connects to Supabase, Campfire, Google, or any external service.
