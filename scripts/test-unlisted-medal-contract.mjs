// Static deployment contract tests. These do NOT replace Postgres rollback,
// trigger, RLS, concurrent approval or real medal issuance tests in staging.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Script} from "node:vm";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const edge=read("supabase/functions/community-claim/index.ts");
const admin=read("docs/admin.html");
const sql=read("supabase/review/unlisted_ca_self_medal_atomic_approval.review.sql");

const fallback=edge.indexOf('if(mapFallback){\n        if(Deno.env.get("CA_CLOVER_UNLISTED_OWN_MEDAL")');
const promotion=edge.indexOf('if(requesterProfile.role==="pending"){');
assert.ok(fallback>=0 && promotion>fallback,"fallback must run before normal CA promotion");
const beforePromotion=edge.slice(fallback,promotion);
assert.ok(beforePromotion.includes("UNLISTED_MEDAL_APPROVAL_NOT_READY"),"fail closed until rollout");
assert.ok(beforePromotion.includes("MANUAL_CA_LEVEL_REQUIRED"),"require explicit admin level evidence");
assert.ok(beforePromotion.includes("internal_approve_unlisted_ca_claim"),"use atomic DB RPC");

assert.ok(admin.includes('data-ca-level-confirm='),"ADMIN confirmation checkbox required");
assert.ok(admin.includes('data-ca-level='),"ADMIN must select 1st/2nd");
assert.ok(admin.includes("body.confirmedCaLevelEvidence=true"),"confirmation must travel to Edge");

assert.match(sql,/create or replace function public\.internal_approve_unlisted_ca_claim\(/i);
assert.match(sql,/security definer/i);
assert.match(sql,/from public, anon, authenticated/i);
assert.match(sql,/to service_role/i);
assert.match(sql,/where r\.id=p_request_id for update/i);
assert.match(sql,/where p\.id=v_request\.user_id for update/i);
assert.match(sql,/on conflict \(user_id,ca_member_id,community_id\) do update/i);
assert.match(sql,/own medal was not granted; approval rolled back/);
assert.ok(!/delete\s+from\s+public\.stamp_collections/i.test(sql),"existing medals must not be deleted");
const identityAt=sql.indexOf("insert into public.user_ca_identities");
const medalAt=sql.indexOf("own medal was not granted; approval rolled back");
const finalizeAt=sql.indexOf("set status='approved'");
assert.ok(identityAt>=0 && medalAt>identityAt && finalizeAt>medalAt,
  "identity insert and medal verification must happen before claim approval");

const inline=[...admin.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)]
  .map(m=>m[1]).filter(Boolean);
assert.ok(inline.length>=1,"expected an inline ADMIN script");
for(const [i,script] of inline.entries()) new Script(script,{filename:"docs/admin.html#script"+i});

console.log("Unlisted CA medal review contracts PASS (static only, not DB-tested)");
