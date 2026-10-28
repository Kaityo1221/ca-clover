import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { createHmac, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

// Disposable local Supabase CLI (real Auth, signed JWT, PostgREST, RLS).
// No production project, remote DB, stored identity, or environment secret is used.
if(process.env.GITHUB_ACTIONS!=="true" || process.platform!=="linux" ||
   process.env.SUPABASE_ACCESS_TOKEN || process.env.DATABASE_URL ||
   process.env.SUPABASE_PROJECT_ID) {
  console.error("ZOROARK_REAL_AUTH_STOP: requires clean ephemeral Linux Actions");
  process.exit(1);
}
const scratch=mkdtempSync(path.join(tmpdir(),"zoroark-auth-gotrue-"));
const root=process.cwd();
const cliArgs=["-y","supabase@2.122.0"];
const env={...process.env,NEXT_TELEMETRY_DISABLED:"1",DO_NOT_TRACK:"1"};
for(const k of Object.keys(env)) {
  if(k.startsWith("SUPABASE_")||k.startsWith("POSTGRES_")||
    ["DATABASE_URL","PGHOST","PGPORT","PGUSER","PGPASSWORD"].includes(k))delete env[k];
}
let started=false,next=null,exit=0;
function cmd(bin,args,cwd=scratch,timeout=240000,input){
  const r=spawnSync(bin,args,{cwd,env,encoding:"utf8",timeout,input,maxBuffer:6*1024*1024});
  if(r.error||r.status!==0) {
    // Never echo locally generated test JWTs or keys.
    const err=(r.stderr||"").replace(/eyJ[A-Za-z0-9._-]{40,}/g,"[JWT]")
      .replace(/(postgres(?:ql)?:\/\/)[^\s"']+/gi,"$1[REDACTED]");
    throw Error("Isolated command failed "+path.basename(bin)+" "+
      args.filter(x=>!x.includes("postgresql://")).slice(0,3).join(" ")+
      " exit="+r.status+" "+(r.error?.message||"")+" "+err.slice(-900));
  }
  return r.stdout||"";
}
function cli(args,timeout){return cmd("npx",[...cliArgs,...args],scratch,timeout)}
function keys(s){
  const o={};
  for(const line of s.split(/\r?\n/)){
    const m=line.match(/^([A-Z_]+)=(.*)$/);
    if(m)o[m[1]]=m[2].trim().replace(/^["']|["']$/g,"");
  }
  return o;
}
function isLocal(input){
  try{return ["localhost","127.0.0.1"].includes(new URL(input).hostname)}
  catch{return false}
}
function sql(db,statements,vars=[]){
  assert.ok(isLocal(db),"remote DB prohibited");
  const args=[db,"-X","-v","ON_ERROR_STOP=1"];
  for(const [key,val] of vars)args.push("-v",key+"="+val);
  return cmd("psql",args,scratch,30000,statements);
}
function port(){
  return new Promise((ok,fail)=>{
    const s=createServer();s.once("error",fail);
    s.listen(0,"127.0.0.1",()=>{
      const p=s.address().port;s.close(e=>e?fail(e):ok(p));
    });
  });
}
const sleep=ms=>new Promise(ok=>setTimeout(ok,ms));
async function request(base,token,params={count:6,difficulty:"easy",recent:[]}){
  const headers={"Origin":"https://kaityo1221.github.io","Content-Type":"application/json"};
  if(token)headers.Authorization="Bearer "+token;
  const r=await fetch(base+"/api/zoroark/round",{
    method:"POST",headers,body:JSON.stringify(params),cache:"no-store",
    signal:AbortSignal.timeout(12000)
  });
  return {code:r.status,json:await r.json(),cache:r.headers.get("Cache-Control")};
}
async function check(label,base,token,expected){
  const r=await request(base,token);
  assert.equal(r.code,expected,label+" HTTP "+r.code);
  assert.ok(r.cache?.includes("no-store"),label+" no-store");
  if(expected!==200)assert.ok(!Object.hasOwn(r.json,"round"),label+" leak");
  else {
    const a=r.json.round;
    assert.equal(a.prompts.length,6);
    assert.equal(a.prompts.filter(x=>x===a.minority).length,1);
    assert.equal(a.prompts.filter(x=>x===a.majority).length,5);
    assert.equal(a.pair.level,"easy");
  }
  console.log("ZOROARK_REAL_AUTH",label,"PASS");
}
function expiredJWT(valid,secret){
  const parts=valid.split(".");
  assert.equal(parts.length,3);
  const header=JSON.parse(Buffer.from(parts[0],"base64url").toString());
  const payload=JSON.parse(Buffer.from(parts[1],"base64url").toString());
  assert.equal(header.alg,"HS256");
  const enc=x=>Buffer.from(JSON.stringify(x)).toString("base64url");
  const h=enc(header),b=enc({...payload,
    iat:Math.floor(Date.now()/1000)-7200,
    exp:Math.floor(Date.now()/1000)-3600
  });
  return h+"."+b+"."+createHmac("sha256",secret).update(h+"."+b).digest("base64url");
}
try {
  console.log("ZOROARK_REAL_AUTH_INIT: disposable local Supabase only");
  cli(["init"],60000);
  const file=path.join(scratch,"supabase","config.toml");
  let cfg=readFileSync(file,"utf8");
  cfg=cfg.replace(/^project_id\s*=\s*".*"/m,
    'project_id = "zoroark-real-'+randomBytes(4).toString("hex")+'"');
  writeFileSync(file,cfg);
  console.log("ZOROARK_REAL_AUTH_START: local Auth / REST / PostgreSQL");
  cli(["start","-x","studio,meta,storage,realtime,imgproxy,inbucket,edge-runtime,analytics,vector,supavisor"],360000);
  started=true;
  const s=keys(cli(["status","-o","env"],25000));
  const api=s.API_URL,db=s.DB_URL,anon=s.ANON_KEY,service=s.SERVICE_ROLE_KEY;
  if(!api||!db||!anon||!service||!isLocal(api)||!isLocal(db)){
    throw Error("Local API/DB URL or disposable keys not available");
  }
  sql(db,[
    "CREATE TABLE public.profiles (id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, role text NOT NULL DEFAULT 'pending',niantic_id text);",
    "ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;",
    "REVOKE ALL ON public.profiles FROM anon,authenticated;",
    "GRANT SELECT ON public.profiles TO authenticated;",
    "GRANT UPDATE (niantic_id) ON public.profiles TO authenticated;",
    "CREATE POLICY self_select ON public.profiles FOR SELECT TO authenticated USING (id=(SELECT auth.uid()));",
    "CREATE POLICY self_update ON public.profiles FOR UPDATE TO authenticated USING (id=(SELECT auth.uid())) WITH CHECK(id=(SELECT auth.uid()));",
  ].join("\n"));
  const admin=createClient(api,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const password="Synthetic-"+randomBytes(10).toString("hex")+"!";
  const people={};
  for(const role of ["ca","admin","pending","revoked"]){
    const email="zoroark-"+role+"-"+randomBytes(4).toString("hex")+"@example.com";
    const created=await admin.auth.admin.createUser({email,password,email_confirm:true});
    if(created.error||!created.data.user)throw Error("GoTrue createUser failed: "+role+" "+(created.error?.code||""));
    const id=created.data.user.id;
    sql(db,"INSERT INTO public.profiles(id,role) VALUES (:'uid'::uuid, :'role');",
      [["uid",id],["role",role==="revoked"?"ca":role]]);
    const client=createClient(api,anon,{auth:{persistSession:false,autoRefreshToken:false}});
    const login=await client.auth.signInWithPassword({email,password});
    if(login.error||!login.data.session?.access_token)throw Error("GoTrue signIn failed: "+role);
    const token=login.data.session.access_token;
    const verified=await client.auth.getUser(token);
    assert.equal(verified.data.user?.id,id,"real Auth validated actual signed JWT");
    people[role]={id,token,client};
  }
  const localPort=await port(),base="http://127.0.0.1:"+localPort;
  const nextEnv={...env,NEXT_PUBLIC_SUPABASE_URL:api,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:anon};
  next=spawn(process.execPath,["node_modules/next/dist/bin/next","dev",
    "--hostname","127.0.0.1","--port",String(localPort)],{
      cwd:root,env:nextEnv,stdio:["ignore","pipe","pipe"]
    });
  let log="";
  next.stdout.on("data",b=>{log=(log+b.toString()).slice(-1500)});
  next.stderr.on("data",b=>{log=(log+b.toString()).slice(-1500)});
  let healthy=false;
  const deadline=Date.now()+60000;
  while(Date.now()<deadline){
    if(next.exitCode!==null)throw Error("Next.js exited");
    try{
      const r=await request(base,null);
      if(r.code===401){healthy=true;break}
    }catch{}
    await sleep(750);
  }
  if(!healthy)throw Error("Next.js API did not start "+log.slice(-600));
  await check("no token",base,null,401);
  await check("real CA JWT",base,people.ca.token,200);
  await check("real ADMIN JWT",base,people.admin.token,200);
  await check("real pending JWT",base,people.pending.token,403);
  await check("real CA JWT before revocation",base,people.revoked.token,200);
  await check("invalid signature",base,people.ca.token.slice(0,-10)+"abcdefghij",401);
  const meta=await people.pending.client.auth.updateUser({data:{role:"admin"}});
  assert.equal(meta.error,null,"test user metadata editable");
  await check("user_metadata spoof rejected",base,people.pending.token,403);
  const upgrade=await people.pending.client.from("profiles").update({role:"admin"})
    .eq("id",people.pending.id).select();
  assert.ok(upgrade.error,"client cannot upgrade own role");
  await check("own role escalation rejected",base,people.pending.token,403);
  sql(db,"UPDATE public.profiles SET role='pending' WHERE id=:'uid'::uuid;",
    [["uid",people.revoked.id]]);
  await check("same signed JWT after role revocation",base,people.revoked.token,403);
  const mine=await people.ca.client.from("profiles").select("id,role");
  assert.equal(mine.error,null);assert.equal(mine.data?.length,1);
  assert.equal(mine.data[0].id,people.ca.id);
  if(s.JWT_SECRET){
    await check("signed expired JWT",base,expiredJWT(people.ca.token,s.JWT_SECRET),401);
  } else console.log("ZOROARK_REAL_AUTH_EXPIRED_JWT_SKIPPED: local CLI did not return JWT_SECRET");
  console.log("ZOROARK_REAL_AUTH_LOCAL_PASS real_gotrue=true jwt=true postgrest=true rls=true remote=false");
} catch(error) {
  exit=1;
  console.error("ZOROARK_REAL_AUTH_LOCAL_FAIL",error?.message||String(error));
} finally {
  if(next){
    next.kill("SIGTERM");
    await Promise.race([new Promise(ok=>next.once("exit",ok)),sleep(5000)]);
    if(next.exitCode===null)next.kill("SIGKILL");
  }
  if(started){
    try{cli(["stop","--no-backup"],100000);console.log("ZOROARK_LOCAL_STACK_STOPPED");}
    catch(error){exit=1;console.error("ZOROARK_LOCAL_CLEANUP_FAILED",error?.message||String(error))}
  }
  rmSync(scratch,{recursive:true,force:true});
}
process.exitCode=exit;
