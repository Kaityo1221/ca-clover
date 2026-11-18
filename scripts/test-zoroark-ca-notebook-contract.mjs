// Contract-only tests. Run in the isolated source tree; never connects to DB or production.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

const read=p=>readFileSync(p,"utf8");
const files=[
 "src/lib/zoroark-ca-notebook.server.ts",
 "src/app/api/zoroark/notebook/route.ts"
];
for(const filename of files){
 const result=ts.transpileModule(read(filename),{
  fileName:filename,
  reportDiagnostics:true,
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}
 });
 const errors=(result.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
 assert.equal(errors.length,0,filename+": "+errors.map(d=>ts.flattenDiagnosticMessageText(d.messageText," ")).join("; "));
 assert.ok(result.outputText.length>100);
}
const auth=read(files[0]),route=read(files[1]),catalog=read("src/lib/zoroark-catalog-management.server.ts");
assert.match(auth,/ZOROARK_NOTEBOOK_ISOLATED_SUPABASE_URL/);
assert.match(auth,/ZOROARK_NOTEBOOK_ISOLATED_PUBLISHABLE_KEY/);
assert.match(auth,/wgiittrvgtiosogyhfcl/,"canonical production DB ref pinned");
assert.match(auth,/ZOROARK_NOTEBOOK_PRODUCTION_ENABLED/,"production is explicit opt-in");
assert.match(auth,/notebook_api_disabled/);
assert.match(auth,/client\.auth\.getUser/);
assert.match(auth,/from\("profiles"\)/);
assert.match(auth,/profile\?\.role!=="ca"/);
assert.match(route,/scope==="all" && auth\.role!=="admin"/,"CA cannot list others");
assert.match(route,/zoroark_topic_list_mine/,"CA uses secure status-private owner RPC");
assert.match(route,/zoroark_topic_admin_list/,"ADMIN list independently checked by DB");
assert.match(route,/privateView/,"CA response excludes review state");
assert.match(route,/zoroark_topic_move_status/,"CAS admin transitions");
assert.match(route,/zoroark_topic_edit_published/,"published edit backed by protected RPC");
assert.ok(!route.includes('rpc("zoroark_topic_decide"'),"legacy non-CAS RPC not callable");
assert.match(auth,/ZOROARK_NOTEBOOK_PRODUCTION_ENABLED/,"production opt-in is independent and off by default");
assert.match(route,/validateTopicCandidate\(input\.topic\)/);
assert.match(route,/zoroark_topic_submit/);
assert.match(route,/zoroark_topic_update/);
assert.ok(!route.includes("zoroark_topic_decide"),"legacy decision action removed from V8 route");
assert.match(route,/catalogPublishEnabled\(\)/);
assert.match(catalog,/ZOROARK_CATALOG_RUNTIME_ENABLED/);
assert.ok(!route.includes("service_role") && !auth.includes("service_role"),"no privileged client key");
assert.ok(!route.includes("ca-clover.vercel.app"),"no production API target");
const official=read("src/app/api/zoroark/official/route.ts");
assert.match(official,/notebookConfig\(\)/,"local official42 QA origin must check isolated Auth gate");
assert.match(official,/trustedOrigin/,"official42 local origin must be opt-in and fail closed");
const round=read("src/app/api/zoroark/round/route.ts");
assert.match(round,/notebookConfig\(\)/,"local QA round must validate QA credentials");
assert.match(round,/roundOriginAllowed/,"local QA round only allowed with current gate");

assert.match(auth,/ZOROARK_NOTEBOOK_LOCAL_STACK_ENABLED/,"local GoTrue requires explicit opt-in");
assert.match(auth,/^const LOCAL_URL=\/\^http:/m,"local GoTrue URL limited to loopback");
assert.match(auth,/localStackAllowed\(\)/,"local mode isolated from production");

const js=ts.transpileModule(auth,{
 fileName:"src/lib/zoroark-ca-notebook.server.ts",
 compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}
}).outputText.replace(/^import .*;$/mg,"").replace(/\bexport (?=(?:class|function|const|async|type))/g,"");
const config=(env)=>{
 const fn=new Function("process",js+"\nreturn notebookConfig;");
 return fn({env})();
};
const defaults={
 NODE_ENV:"development",ZOROARK_CATALOG_LOCAL_TEST:"true",
 ZOROARK_NOTEBOOK_API_ENABLED:"true",ZOROARK_NOTEBOOK_LOCAL_STACK_ENABLED:"true",
 ZOROARK_NOTEBOOK_ISOLATED_SUPABASE_URL:"http://127.0.0.1:54321",
 ZOROARK_NOTEBOOK_ISOLATED_PUBLISHABLE_KEY:"dummy-local-anon-key",
 NEXT_PUBLIC_SUPABASE_URL:"http://127.0.0.1:54321",
 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"dummy-local-anon-key"
};
const local=config(defaults);
assert.equal(local.url,"http://127.0.0.1:54321","explicit loopback local stack accepted");
const errors=(delta)=>{try{config({...defaults,...delta});return "ACCEPTED"}catch(e){return e.code||e.message}};
assert.equal(errors({ZOROARK_NOTEBOOK_LOCAL_STACK_ENABLED:"false"}),"notebook_auth_unconfigured","no local stack without opt-in");
assert.equal(errors({VERCEL_ENV:"preview"}),"notebook_auth_unconfigured","preview must reject local target");
assert.equal(errors({VERCEL_ENV:"production"}),"notebook_api_disabled","production must not use local config");
assert.equal(errors({ZOROARK_NOTEBOOK_ISOLATED_SUPABASE_URL:"http://192.168.1.6:54321",NEXT_PUBLIC_SUPABASE_URL:"http://192.168.1.6:54321"}),"notebook_auth_unconfigured","LAN endpoints forbidden");
assert.equal(errors({ZOROARK_NOTEBOOK_ISOLATED_SUPABASE_URL:"http://evil.example:54321",NEXT_PUBLIC_SUPABASE_URL:"http://evil.example:54321"}),"notebook_auth_unconfigured","remote HTTP forbidden");
assert.equal(errors({NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"other"}),"notebook_catalog_auth_mismatch","public client must match");
assert.equal(errors({ZOROARK_NOTEBOOK_API_ENABLED:"false"}),"notebook_api_disabled","global write gate remains fail closed");
console.log("ZOROARK_V8_LOCAL_AUTH_GATE_MATRIX_PASS cases=8");
console.log("ZOROARK_CA_NOTEBOOK_CONTRACT_PASS isolated_auth=on current_role=on owner_filter=on admin_gate=on");
