// Local PC Auth QA launcher only. Never accepts an arbitrary endpoint or remote DB.
// No DB migrations, privileged keys, OAuth code exchange or deployments.
import {spawn,spawnSync} from "node:child_process";
import {readFileSync,existsSync} from "node:fs";
import {homedir} from "node:os";
import {join,resolve} from "node:path";
import {createServer} from "node:net";

const EXPECTED_BRANCH="feature/claim-pc-auth-ui-local-isolated-20261114";
const PROJECT="ca-clover-claim-pcqa-20261114";
const API="http://127.0.0.1:56321";
const PORT=56490;
const root=resolve(process.cwd());
const lab=join(homedir(),"Downloads","CA_Clover_PC_Isolated_Auth_Stage2_20261114",
 "CA_Clover_PC_Isolated_Auth_Stage2_20261114",PROJECT);
const bad=(reason)=>{console.error("PC_AUTH_QA_BLOCKED="+reason);process.exit(2);};
function cmd(bin,args,cwd,timeout=15000){
  const win=process.platform==="win32";
  if(win){
    // Only literal executable and arguments; no interpolated command text.
    const line=bin+" "+args.join(" ");
    return spawnSync("cmd.exe",["/d","/s","/c",line],{cwd,encoding:"utf8",timeout,maxBuffer:1048576});
  }
  return spawnSync(bin,args,{cwd,encoding:"utf8",timeout,maxBuffer:1048576});
}
function safeJwtAnon(key){
  try{
    const parts=key.split(".");
    if(parts.length!==3)return false;
    const payload=JSON.parse(Buffer.from(parts[1],"base64url").toString("utf8"));
    return payload.role==="anon" &&
      (payload.ref===undefined || payload.ref===PROJECT) &&
      (payload.exp===undefined || (Number.isSafeInteger(payload.exp) && payload.exp*1000>Date.now()));
  }catch{return false;}
}
if(!existsSync(join(root,"next.config.ts")) || !existsSync(join(root,"package.json")))
  bad("NOT_CA_CLOVER_SOURCE_ROOT");
const git=cmd("git",["rev-parse","--abbrev-ref","HEAD"],root);
if(git.error || git.status!==0 || git.stdout.trim()!==EXPECTED_BRANCH)
  bad("WRONG_GIT_BRANCH");
const cfg=join(lab,"supabase","config.toml");
if(!existsSync(cfg))bad("ISOLATED_PCQA_CONFIG_MISSING");
const body=readFileSync(cfg,"utf8");
if(!/^project_id\s*=\s*"ca-clover-claim-pcqa-20261114"\s*$/m.test(body))
  bad("ISOLATED_PCQA_PROJECT_MISMATCH");
const nextBin=join(root,"node_modules","next","dist","bin","next");
if(!existsSync(nextBin))bad("NEXT_DEPENDENCIES_NOT_INSTALLED_RUN_NPM_CI");
const status=cmd("npx",["--offline","--yes","supabase@2.122.0","status","--output","env"],lab,20000);
if(status.error || status.status!==0)bad("SUPABASE_STATUS_UNAVAILABLE");
function readVariable(name){
  const line=status.stdout.split(/\r?\n/).find(x=>x.startsWith(name+"="));
  if(!line)return "";
  const v=line.slice(name.length+1).trim();
  if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))
    return v.slice(1,-1);
  return v;
}
if(readVariable("API_URL").replace(/\/$/,"")!==API)bad("SUPABASE_API_NOT_EXPECTED_LOCAL_PORT");
const anon=readVariable("ANON_KEY");
if(!safeJwtAnon(anon))bad("MISSING_OR_INVALID_LOCAL_ANON_KEY");
try{
  const res=await fetch(API+"/auth/v1/health",{signal:AbortSignal.timeout(5000)});
  if(res.status!==200)bad("AUTH_HEALTH_NOT_200");
}catch{bad("AUTH_HEALTH_UNREACHABLE");}
// PC QA alone owns 56490. Do not kill whichever process is using it.
const free=await new Promise(ok=>{
  const s=createServer();
  s.once("error",()=>ok(false));
  s.listen(PORT,"127.0.0.1",()=>s.close(()=>ok(true)));
});
if(!free)bad("PORT_56490_OCCUPIED_STOP_READONLY_QA_SERVER_FIRST");
const env={...process.env,CA_CLOVER_PC_AUTH_QA:"enabled",
  NEXT_PUBLIC_SUPABASE_URL:API,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:anon,
  NEXT_PUBLIC_CA_CLOVER_ISOLATED_SUPABASE_REF:""};
delete env.VERCEL_ENV;
delete env.VERCEL;
delete env.VERCEL_GIT_COMMIT_REF;
delete env.SUPABASE_SERVICE_ROLE_KEY;
delete env.SUPABASE_SECRET_KEY;
console.log("PC_AUTH_QA_PREFLIGHT=PASS");
console.log("PC_AUTH_QA_URL=http://127.0.0.1:56490/login");
console.log("PC_AUTH_QA_SCOPE=FRONTEND_GOOGLE_ONLY");
console.log("PC_AUTH_QA_ADMIN_API=DISABLED");
console.log("PC_AUTH_QA_REGISTRATION_EDGE=NOT_CONNECTED");
console.log("PRODUCTION=NO-GO");
const child=spawn(process.execPath,[nextBin,"dev","-H","127.0.0.1","-p",String(PORT)],{
  cwd:root,env,stdio:"inherit",windowsHide:true,
});
child.on("error",()=>bad("NEXT_DEV_START_FAILED"));
process.on("SIGINT",()=>child.kill("SIGINT"));
process.on("SIGTERM",()=>child.kill("SIGTERM"));
child.on("exit",code=>process.exit(code??0));
