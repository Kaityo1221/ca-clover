// Unified CA Clover release-candidate contracts.
// These are regression guards, not a substitute for real Supabase E2E.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const auto=read("supabase/functions/sync-campfire-auto/index.ts");
const master=read("supabase/functions/sync-ca-master/index.ts");
const coordinates=read("supabase/functions/sync-ca-master-coordinates/index.ts");
const legacyMaster=read("src/app/api/sync/ca-master/route.ts");
const sourcePreflight=read("supabase/functions/_shared/ca-master-source-preflight.mjs");
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
assert.ok(atomic.includes("CA_MASTER_LINK_CHANGE_REVIEW_REQUIRED") &&
  !atomic.includes("delete from public.community_ca_members"),
  "Link RPC must preserve ALL links including verified identities");
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

assert.ok(master.includes("CA_MASTER_BASELINE_REVIEW_REQUIRED"),"Unknown baseline or unusual source size must stop master");
assert.ok(master.includes("CA_MASTER_LINK_CHANGE_REVIEW_REQUIRED"),"Existing CA-link changes must stop before metadata writes");
assert.ok(master.includes("CA master emergency sentinel is active"),"2099 emergency sentinel must be independent of dedicated flag");
assert.ok(sourcePreflight.includes("SKIPPED_OR_MALFORMED_SOURCE_ROWS"),"Rows dropped by parser must be rejected");
assert.ok(!sourcePreflight.includes("latitude:record.latitude"),"Metadata upsert must not overwrite valid coordinates with null");
assert.ok(coordinates.includes("CA_MASTER_COORDINATES_RETIRED") && !coordinates.includes(".rpc("),"Old coordinate writer must be disabled");
assert.ok(legacyMaster.includes("CA_MASTER_LEGACY_SYNC_DISABLED") && !legacyMaster.includes(".delete("),"Old Next.js destructive writer must be disabled");
assert.ok(atomic.includes("CA_MASTER_LINK_CHANGE_REVIEW_REQUIRED"),"All stale links must be rejected in atomic RPC");
assert.ok(!atomic.includes("delete from public.community_ca_members"),"Atomic link reconcile must never delete old links");

console.log("Unified master sync / actual deployed scheduler / medal approval contracts PASS (36 checks)");
