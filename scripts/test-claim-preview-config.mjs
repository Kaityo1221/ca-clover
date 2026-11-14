import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import {stripTypeScriptTypes} from "node:module";

function load(path, expression, extra={}) {
  const raw=readFileSync(path,"utf8");
  const js=stripTypeScriptTypes(raw.replace(/^import[^\n]+;\r?\n/gm,"")
    .replace(/export function/g,"function").replace(/export const/g,"const").replace(/export default nextConfig;/,""),{mode:"transform"});
  return vm.runInNewContext(js+"\n"+expression,{URL,atob,...extra},{timeout:2000});
}
const {resolveSupabaseEndpoint,isSupabaseKeyForRole}=load("src/lib/supabase-connection.ts","({resolveSupabaseEndpoint,isSupabaseKeyForRole})");
const helpers={resolveSupabaseEndpoint,isSupabaseKeyForRole};
const resolve=load("src/lib/supabase.ts","resolveBrowserSupabaseConfig",helpers);
const ref="abcdefghijabcdefghij", prodRef="wgiittrvgtiosogyhfcl";
const prod="https://"+prodRef+".supabase.co", preview="https://"+ref+".supabase.co";
const key="sb_publishable_synthetic_offline_key";
const valid={url:preview,key,deployment:"preview",isolatedRef:ref};
const jwt=(role,project=ref)=>"eyJhbGciOiJIUzI1NiJ9."+Buffer.from(JSON.stringify({role,ref:project})).toString("base64url")+".synthetic";
const cases=[
  [{},false], [valid,true], [{...valid,deployment:"development"},true],
  [{...valid,deployment:undefined},true],
  [{...valid,url:prod},false], [{...valid,url:prod+"/"},false],
  [{...valid,url:"HTTPS://WGIITTRVGTIOSOGYHFCL.SUPABASE.CO/"},false],
  [{...valid,url:prod,isolatedRef:prodRef},false],
  [{...valid,isolatedRef:undefined},false], [{...valid,isolatedRef:"bbbbbbbbbbbbbbbbbbbb"},false],
  [{...valid,url:"https://azkshxjgsbtjgwbapcfw.supabase.co",isolatedRef:"azkshxjgsbtjgwbapcfw"},false],
  [{...valid,url:"http://"+ref+".supabase.co"},false],
  [{...valid,url:preview+"/rest/v1"},false], [{...valid,url:preview+"?redirect=x"},false],
  [{...valid,url:preview+"#fragment"},false], [{...valid,url:"https://user:password@"+ref+".supabase.co"},false],
  [{...valid,url:"https://"+ref+".supabase.co:444"},false],
  [{...valid,url:"https://"+ref+".supabase.co.evil.invalid"},false],
  [{...valid,key:"sb_secret_synthetic_server_key"},false],
  [{...valid,key:jwt("service_role")},false], [{...valid,key:jwt("anon",prodRef)},false],
  [{...valid,key:jwt("anon")},true], [{...valid,key:"invalid"},false],
  [{url:prod,key,deployment:"production"},true],
  [{url:prod,key,deployment:"production",isolatedRef:ref},false],
  [{...valid,deployment:"production"},false],
];
let checks=0;
for (const [env,allowed] of cases) {
  const actual=resolve(env);
  assert.equal(actual.url!=="https://ca-clover-no-auth.invalid",allowed,JSON.stringify({...env,key:"[redacted]"}));
  checks++;
}
// Run the actual admin factory: reject before creating a network client.
for(const [env,allowed] of [
  [{NEXT_PUBLIC_SUPABASE_URL:prod,SUPABASE_SERVICE_ROLE_KEY:jwt("service_role",prodRef),VERCEL_ENV:"preview",NEXT_PUBLIC_VERCEL_ENV:"production"},false],
  [{NEXT_PUBLIC_SUPABASE_URL:preview,SUPABASE_SERVICE_ROLE_KEY:jwt("service_role"),VERCEL_ENV:"preview",CA_CLOVER_ISOLATED_SUPABASE_REF:ref,NEXT_PUBLIC_CA_CLOVER_ISOLATED_SUPABASE_REF:ref},true],
  [{NEXT_PUBLIC_SUPABASE_URL:preview,SUPABASE_SERVICE_ROLE_KEY:jwt("service_role",prodRef),VERCEL_ENV:"preview",CA_CLOVER_ISOLATED_SUPABASE_REF:ref,NEXT_PUBLIC_CA_CLOVER_ISOLATED_SUPABASE_REF:ref},false],
  [{NEXT_PUBLIC_SUPABASE_URL:preview,SUPABASE_SERVICE_ROLE_KEY:jwt("service_role"),VERCEL_ENV:"preview",CA_CLOVER_ISOLATED_SUPABASE_REF:ref,NEXT_PUBLIC_CA_CLOVER_ISOLATED_SUPABASE_REF:"bbbbbbbbbbbbbbbbbbbb"},false],
  [{NEXT_PUBLIC_SUPABASE_URL:prod,SUPABASE_SERVICE_ROLE_KEY:jwt("service_role",prodRef),VERCEL_ENV:"production"},true],
  [{NEXT_PUBLIC_SUPABASE_URL:prod,SUPABASE_SERVICE_ROLE_KEY:jwt("anon",prodRef),VERCEL_ENV:"production"},false],
]) {
  let created=0;
  const factory=load("src/lib/supabase-admin.ts","createSupabaseAdminClient",{...helpers,process:{env},createClient:()=>{created++;return {};}});
  assert.equal(Boolean(factory()),allowed); assert.equal(created,allowed?1:0); checks+=2;
}
const branch="feature/claim-discord-apac-ui-isolated-20261114";
for (const [env,isolated] of [
  [{VERCEL_ENV:"preview",VERCEL_GIT_COMMIT_REF:branch,NEXT_PUBLIC_VERCEL_ENV:"production"},true],
  [{VERCEL_ENV:"production",VERCEL_GIT_COMMIT_REF:branch},false],
  [{VERCEL_ENV:"preview",VERCEL_GIT_COMMIT_REF:"other-development"},false],
  [{},false],
]) {
  const config=load("next.config.ts","nextConfig",{process:{env}});
  const routes=await config.redirects();
  assert.equal(routes.length,isolated?0:6); checks++;
  assert.equal(config.env.NEXT_PUBLIC_VERCEL_ENV,env.VERCEL_ENV??"development"); checks++;
  const guard=load("src/proxy.ts","({proxy,config})",{
    process:{env:config.env},NextResponse:{json:Response.json,next:()=>null},
  });
  const response=guard.proxy();
  assert.equal(response?.status??null,isolated?503:null);checks++;
  assert.equal(JSON.stringify(guard.config.matcher),JSON.stringify(["/api/:path*"]));checks++;
  const headers=(await config.headers())[0];
  assert.equal(headers.source,"/discord-ca/callback");
  assert.ok(headers.headers.some(h=>h.key==="Referrer-Policy"&&h.value==="no-referrer")); checks++;
}
console.log("CLAIM_PREVIEW_CONNECTION_PASS checks="+checks+" network=0 client_creation_guard=PASS same_origin_routes=PASS");

