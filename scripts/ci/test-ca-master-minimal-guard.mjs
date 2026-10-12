// Static guard checks for minimal CA master release, no live endpoints.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";

const read = p => readFileSync(p,"utf8");
const main=read("supabase/functions/sync-ca-master/index.ts");
const coord=read("supabase/functions/sync-ca-master-coordinates/index.ts");
const admin=read("supabase/functions/sync-ca-master-admin/index.ts");
const auto=read("supabase/functions/sync-campfire-auto/index.ts");
const migration=read("supabase/migrations/20261013_ca_master_minimal_barrier.sql");
const nextRoute=read("src/app/api/sync/ca-master/route.ts");
assert.match(nextRoute,/CA_MASTER_LEGACY_SYNC_DISABLED/,"Next.js legacy route must remain retired");
assert.match(nextRoute,/status:\s*410/,"Next.js legacy route must return HTTP 410");
assert.doesNotMatch(nextRoute,/\.from\(|\.delete\(|createSupabaseAdminClient|CA_MASTER_SOURCE_URL/,"No Next.js CA master DB or source access");

for (const [name, source] of [["master",main],["coordinates",coord]]) {
  assert.match(source, /function isLegacyMasterWriterRetired\(\):boolean \{ return true; \}/, name+": permanent retirement flag");
  assert.match(source, /if\(isLegacyMasterWriterRetired\(\)\)\s*\{\s*return json\(/, name+": abort writer");
  assert.match(source, /status:"retired"/, name+": retired status");
  assert.match(source, /ca_master_sync_enabled,last_ca_master_at/, name+": DB gate read");
  assert.match(source, /masterGate\.ca_master_sync_enabled!==true/, name+": OFF fail-closed");
  assert.ok(source.includes('return json({error:"unauthorized"},401)'),name+": original secret validation");
  assert.ok(source.indexOf('if(isLegacyMasterWriterRetired())') < source.indexOf('const response=await fetch(CA_MASTER_URL'),name+": retire before fetch");
}
assert.match(admin, /masterGate\.ca_master_sync_enabled!==true/, "ADMIN blocked by OFF gate");
assert.ok(admin.indexOf('masterGate.ca_master_sync_enabled') < admin.indexOf('const response=await fetch'),"ADMIN gate before master call");
assert.match(migration,/ON DELETE RESTRICT NOT DEFERRABLE/);
assert.match(migration,/ca_master_sync_enabled boolean NOT NULL DEFAULT false/);
assert.match(migration,/2099-01-01T00:00:00Z/);
assert.doesNotMatch(migration,/UPDATE\s+public\.sync_automation_state\s+SET\s+ca_master_sync_enabled\s*=\s*true/i);

const oldRef="bc7ad70582e219c69fbe512d0c30dad3c4e1ad81";
const file="supabase/functions/sync-campfire-auto/index.ts";
const preserved=execFileSync("git",["show",oldRef+":"+file],{encoding:"utf8"});
const original='    if(coordinateRefreshDue){';
assert.equal(preserved.split(original).length,2,"baseline must contain exactly one condition");
const expected=preserved.replace(original,
'    // Fail closed if the dedicated CA-master gate is absent, false or unreadable.\n'+
'    // General Campfire jobs continue independently.\n'+
'    if(state.ca_master_sync_enabled===true && coordinateRefreshDue){');
assert.equal(auto,expected,"Auto must equal exactly preserved deployed source plus master-only guard");
console.log("MINIMAL_MASTER_GUARD_STATIC_PASS");
