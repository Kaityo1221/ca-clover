// Unified CA Clover release-candidate contracts.
// These are regression guards, not a substitute for real Supabase E2E.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const auto=read("supabase/functions/sync-campfire-auto/index.ts");
const master=read("supabase/functions/sync-ca-master/index.ts");
const recovery=read("supabase/functions/_shared/ca-master-recovery.mjs");
const medalDesign=read("supabase/review/qa-production-medal-design-functions.review.sql");
const admin=read("supabase/functions/sync-ca-master-admin/index.ts");
const claim=read("supabase/functions/community-claim/index.ts");
const adminUI=read("docs/admin.html");
const lease=read("supabase/review/ca-master-exclusive-lease.review.sql");
const atomic=read("supabase/review/ca-master-atomic-link-reconcile.review.sql");
const medal=read("supabase/review/unlisted_ca_self_medal_atomic_approval.review.sql");
const preflight=read("supabase/review/release-candidate-readonly-schema-preflight.review.sql");

assert.ok(auto.includes("sync-community-icons"),"Preserve production icon sync");
assert.ok(auto.includes("community-claim-notify"),"Preserve claim notification");
assert.ok(auto.includes("ca_master_sync_enabled"),"Scheduler must use dedicated master gate");
assert.ok(admin.includes("ca_master_sync_enabled"),"ADMIN manual sync must use master gate");
assert.ok(master.includes("ca_master_sync_enabled"),"Master API must also use master gate");
assert.ok(master.includes("internal_begin_ca_master_lease"),"Master API must claim run lease");
assert.ok(master.includes("internal_reconcile_ca_master_links"),"CA links must use atomic RPC");
assert.ok(recovery.includes("CA_MASTER_WRITE_INTERRUPTED"),"Failed writes must be audited");
assert.ok(master.includes("pauseAndAuditCaMasterFailure"),"Must call actual failure handler");
assert.ok(medalDesign.includes("stamp_grant_acquisition_design"),"Preserve production medal acquisition design");
assert.ok(master.includes("shouldReleaseCaMasterLease"),"Failures must keep lease if pause not confirmed");
assert.ok(lease.includes("ca_master_sync_enabled=false"),"Lease must fail closed");
assert.ok(lease.includes("v_expires<=clock_timestamp()"),"Stale run detection required");
assert.ok(atomic.includes("confdeltype='r'"),"Link RPC must require RESTRICT foreign key");
assert.ok(atomic.includes("p_owner uuid"),"Link RPC must fence stale workers");
assert.ok(atomic.includes("from public.user_ca_identities"),"Link RPC must preserve verified links");
assert.ok(claim.includes("CA_CLOVER_UNLISTED_OWN_MEDAL"),"New medal workflow remains opt-in");
assert.ok(claim.includes("internal_approve_unlisted_ca_claim"),"Use transactional medal approval");
assert.equal((claim.match(/\.getAnonymousClaimEvent\(/g)||[]).length,3,
  "All 3 Community claim Event reads use deployed v14 fields");
assert.ok(!claim.includes(".getAnonymousEvent("),
  "No Community claim read should use newer Meetup query");
const campfireClient=read("supabase/functions/_shared/campfire/client.ts");
assert.ok(campfireClient.includes("CLAIM_LEGACY_EVENT_QUERY"),
  "Claim-specific v14 query is separate from regular Event queries");
assert.ok(campfireClient.includes("EVENT_QUERY.replace("),
  "Only the later GraphQL field is excluded from claim path");
assert.ok(adminUI.includes("data-ca-level-confirm="),"Require human level confirmation in ADMIN");
assert.ok(medal.includes("internal_approve_unlisted_ca_claim"),"Reviewed approval function exists");
assert.ok(medal.includes("stamp_collections"),"Awarded medal must be verified");
assert.ok(preflight.includes("CASCADE_UNSAFE_NOT_READY"),"Production baseline must alert unsafe FK");
assert.ok(!/^\s*(?:insert\s+into|delete\s+from|update\s+public\.|alter\s+table|create\s+or\s+replace)/im.test(
 preflight.replace(/^\s*--[^\n]*$/gm,"")
),"Production schema preflight must remain read-only");

console.log("Unified master sync / actual deployed scheduler / medal approval contracts PASS (27 checks)");
