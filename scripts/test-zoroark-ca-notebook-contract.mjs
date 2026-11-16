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
assert.match(auth,/wgiittrvgtiosogyhfcl/,"production project is blocked");
assert.match(auth,/notebook_api_disabled/);
assert.match(auth,/client\.auth\.getUser/);
assert.match(auth,/from\("profiles"\)/);
assert.match(auth,/profile\?\.role!=="ca"/);
assert.match(route,/scope==="all" && auth\.role!=="admin"/,"CA cannot list others");
assert.match(route,/\.eq\("submitted_by",auth\.user\.id\)/,"CA sees own submissions");
assert.match(route,/validateTopicCandidate\(input\.topic\)/);
assert.match(route,/zoroark_topic_submit/);
assert.match(route,/zoroark_topic_update/);
assert.match(route,/zoroark_topic_decide/);
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
console.log("ZOROARK_CA_NOTEBOOK_CONTRACT_PASS isolated_auth=on current_role=on owner_filter=on admin_gate=on");
