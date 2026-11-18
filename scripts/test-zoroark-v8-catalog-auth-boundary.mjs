// Synthetic, no-network environment boundary regression for the V8 catalog.
// All credentials are dummy; no real Supabase, Neon or Vercel access.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

function load(file,env,requireOnly){
 const source=readFileSync(file,"utf8");
 const code=ts.transpileModule(source,{
   fileName:file,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}
 }).outputText;
 const module={exports:{}};
 new Function("require","module","exports","process",code)(
   requireOnly,module,module.exports,{env}
 );
 return module.exports;
}
function run(vars){
 const env={...vars};
 const auth=load("src/lib/zoroark-ca-notebook.server.ts",env,(name)=>{
   if(name==="server-only")return {};
   if(name==="@supabase/supabase-js")return {};
   throw Error("Unexpected auth import "+name);
 });
 const management=load("src/lib/zoroark-catalog-management.server.ts",env,(name)=>{
   if(name==="server-only")return {};
   if(name==="./zoroark-ca-notebook.server")return auth;
   if(name==="./zoroark-catalog.server")return {PAIRS:[]};
   if(name==="./zoroark-catalog-review")return {};
   throw Error("Unexpected catalog import "+name);
 });
 return {
  management:management.catalogManagementEnabled(),
  publish:management.catalogPublishEnabled(),
  runtime:management.catalogRuntimeEnabled()
 };
}
const allTrue={management:true,publish:true,runtime:true};
const allFalse={management:false,publish:false,runtime:false};
const flags={
 ZOROARK_CATALOG_MANAGEMENT_ENABLED:"true",
 ZOROARK_CATALOG_PUBLISH_ENABLED:"true",
 ZOROARK_CATALOG_RUNTIME_ENABLED:"true",
 ZOROARK_NOTEBOOK_API_ENABLED:"true"
};
const preview={
 ...flags,VERCEL_ENV:"preview",
 ZOROARK_NOTEBOOK_ISOLATED_SUPABASE_URL:"https://qa-catalog-stage.supabase.co",
 ZOROARK_NOTEBOOK_ISOLATED_PUBLISHABLE_KEY:"synthetic-publishable-key",
 NEXT_PUBLIC_SUPABASE_URL:"https://qa-catalog-stage.supabase.co",
 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"synthetic-publishable-key"
};
assert.deepEqual(run(preview),allTrue,"isolated Preview same Auth/DB accepted");
assert.deepEqual(run({...preview,NEXT_PUBLIC_SUPABASE_URL:"https://other-stage.supabase.co"}),allFalse,
 "mismatched frontend Auth DB must fail closed");
assert.deepEqual(run({...preview,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"other-key"}),allFalse,
 "mismatched frontend key must fail closed");
assert.deepEqual(run({...preview,ZOROARK_NOTEBOOK_API_ENABLED:"false"}),allFalse,
 "catalog cannot bypass notebook API gate");
assert.deepEqual(run({...preview,ZOROARK_NOTEBOOK_ISOLATED_SUPABASE_URL:"https://wgiittrvgtiosogyhfcl.supabase.co",
 NEXT_PUBLIC_SUPABASE_URL:"https://wgiittrvgtiosogyhfcl.supabase.co"}),allFalse,
 "Preview cannot query known production Auth even if all catalog flags are ON");
assert.deepEqual(run({...preview,ZOROARK_NOTEBOOK_ISOLATED_SUPABASE_URL:"http://127.0.0.1:54321",
 NEXT_PUBLIC_SUPABASE_URL:"http://127.0.0.1:54321"}),allFalse,
 "Vercel Preview cannot use the local-only Auth endpoint");
const prod={
 ...flags,VERCEL_ENV:"production",
 ZOROARK_NOTEBOOK_PRODUCTION_ENABLED:"true",
 ZOROARK_CATALOG_PRODUCTION_ENABLED:"true",
 ZOROARK_NOTEBOOK_PRODUCTION_SUPABASE_URL:"https://wgiittrvgtiosogyhfcl.supabase.co",
 ZOROARK_NOTEBOOK_PRODUCTION_PUBLISHABLE_KEY:"dummy-protected-key",
 NEXT_PUBLIC_SUPABASE_URL:"https://wgiittrvgtiosogyhfcl.supabase.co",
 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"dummy-protected-key"
};
assert.deepEqual(run(prod),allTrue,"test-only explicit production gate contract");
assert.deepEqual(run({...prod,ZOROARK_CATALOG_PRODUCTION_ENABLED:"false"}),allFalse,
 "prod catalog requires a separate production opt-in");
assert.deepEqual(run({...prod,ZOROARK_NOTEBOOK_PRODUCTION_ENABLED:"false"}),allFalse,
 "prod catalog requires notebook production opt-in");
assert.deepEqual(run({...prod,ZOROARK_NOTEBOOK_PRODUCTION_SUPABASE_URL:"https://wrong-prod.supabase.co"}),allFalse,
 "production must use pinned canonical Supabase ref");
assert.deepEqual(run({...prod,ZOROARK_NOTEBOOK_API_ENABLED:"false"}),allFalse,
 "production also requires notebook API gate");
const local={
 ...flags,NODE_ENV:"development",ZOROARK_CATALOG_LOCAL_TEST:"true",
 ZOROARK_NOTEBOOK_LOCAL_STACK_ENABLED:"true",
 ZOROARK_NOTEBOOK_ISOLATED_SUPABASE_URL:"http://127.0.0.1:54321",
 ZOROARK_NOTEBOOK_ISOLATED_PUBLISHABLE_KEY:"synthetic-local-key",
 NEXT_PUBLIC_SUPABASE_URL:"http://127.0.0.1:54321",
 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"synthetic-local-key"
};
assert.deepEqual(run(local),allTrue,"opted-in ephemeral local stack accepted");
assert.deepEqual(run({...local,ZOROARK_NOTEBOOK_LOCAL_STACK_ENABLED:"false"}),allFalse,
 "local test requires explicit local-stack consent");
const legacyCatalog=readFileSync("src/app/api/zoroark/catalog/route.ts","utf8");
assert.match(legacyCatalog,/export async function GET/, "ADMIN catalog inspection remains available");
assert.match(legacyCatalog,/catalog_v8_use_notebook_api/, "V8 legacy write endpoint must retire");
assert.ok(!legacyCatalog.includes('rpc("zoroark_topic_decide"'),
 "revoked non-CAS legacy decide RPC must never be invoked by V8");
console.log("ZOROARK_V8_LEGACY_CATALOG_RETIRED_PASS");
console.log("ZOROARK_V8_CATALOG_AUTH_BOUNDARY_PASS cases=13 network=0 production_changes=0");
