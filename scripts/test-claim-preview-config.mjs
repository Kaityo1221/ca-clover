import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import {stripTypeScriptTypes} from "node:module";

const file="src/lib/supabase.ts";
const raw=readFileSync(file,"utf8");
const noImport=raw.replace(/^import[^\n]+;\r?\n/gm,"").replace(/export function/g,"function");
const code=stripTypeScriptTypes(noImport,{mode:"transform"});
const resolve=vm.runInNewContext(code+"\nresolveBrowserSupabaseConfig;",{process:{env:{}},URL,createClient:()=>{throw Error("no network")}}, {timeout:2000});
const prod="https://wgiittrvgtiosogyhfcl.supabase.co";
const preview="https://isolated-preprod-only.supabase.co";
const key="sb_publishable_test_key";
const cases=[
 [{},false,false],
 [{url:prod,key,deployment:"preview"},false,false],
 [{url:prod+"/",key,deployment:"preview"},false,false],
 [{url:"HTTPS://WGIITTRVGTIOSOGYHFCL.SUPABASE.CO/",key,deployment:"preview"},false,false],
 [{url:"http://isolated-preprod-only.supabase.co",key,deployment:"preview"},false,false],
 [{url:prod,key,deployment:"development"},false,false],
 [{url:prod,key},false,false],
 [{url:prod,key,deployment:"production"},true,false],
 [{url:preview,key,deployment:"preview"},true,true],
 [{url:preview,key,deployment:"development"},true,true],
];
let n=0;
for(const [env,canConnect,isolated] of cases){
 const c=resolve(env);
 assert.equal(Boolean(c.url && c.url!=="https://ca-clover-no-auth.invalid"),canConnect);
 assert.equal(c.isolated,isolated);
 n++;
}
assert.ok(!raw.includes("DEFAULT_SUPABASE_PUBLISHABLE_KEY"),"no production-key fallback allowed");
console.log("CLAIM_PREVIEW_AUTH_ISOLATION_PASS "+n+" cases; no network");
