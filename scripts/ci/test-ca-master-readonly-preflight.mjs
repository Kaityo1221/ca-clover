import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const sql=readFileSync("supabase/review/phase-e-production-readonly-stop-preflight-20261013.sql","utf8");
const active=sql.replace(/^\s*--[^\n]*$/gm,"");
assert.match(active,/BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY;/i);
assert.match(active,/\bCOMMIT;/i);
assert.match(active,/PASS:MASTER_OFF/);
assert.match(active,/PASS:PAUSED_2099/);
assert.match(active,/PASS:RESTRICT_VALIDATED_NONDEFERRABLE/);
assert.match(active,/STOP:NO_VERIFIED_BASELINE/);
for (const needle of [
 "state/dedicated_ca_master_gate","state/master_emergency_pause",
 "schema/identity_link_fk","data/orphan_identity_links",
 "data/ca_identities","data/medals","data/exchange_sessions"
]) assert.ok(active.includes(needle),"Missing required observation: "+needle);
assert.doesNotMatch(active,/^\s*(?:INSERT|UPDATE|DELETE|MERGE|DROP|CREATE|ALTER|TRUNCATE|GRANT|REVOKE|CALL|DO|COPY|EXECUTE|VACUUM|ANALYZE)\b/im,
  "Review preflight may only use SELECT inside READ ONLY transaction");
console.log("CA_MASTER_PRODUCTION_PREFLIGHT_STATIC_PASS: SQL is read-only and checks OFF, 2099, RESTRICT, record preservation");
