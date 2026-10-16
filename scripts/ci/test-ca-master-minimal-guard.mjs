// Static guard checks for minimal CA master release, no live endpoints.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

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

// Pin exact protected scheduler source. This replaces a broken git-show
// lookup to an older commit without the file at that path.
const {createHash}=await import("node:crypto");
const schedulerBytes=Buffer.from(auto,"utf8");
const schedulerGitSha=createHash("sha1")
  .update(Buffer.from("blob "+schedulerBytes.length+"\0","utf8"))
  .update(schedulerBytes).digest("hex");
assert.equal(schedulerGitSha,"91c5395c11d3406d29af2f050262f4deaecc1b28",
  "Protected Campfire scheduler must remain byte-for-byte unchanged");
console.log("MINIMAL_MASTER_GUARD_STATIC_PASS");
