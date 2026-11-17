import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { randomBytes } from "node:crypto";
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
const privateRoot=process.env.ZOROARK_V8_BACKEND_SQL_ROOT;
if(!privateRoot||!process.env.ZOROARK_V8_BACKEND_EXPECTED_SHA){
 throw Error("V8_REAL_AUTH_STOP: pinned private SQL root required");
}
assert.equal(spawnSync("git",["rev-parse","HEAD"],{cwd:privateRoot,encoding:"utf8"}).stdout?.trim(),
 process.env.ZOROARK_V8_BACKEND_EXPECTED_SHA,"pinned private SQL SHA mismatch");
const v8sql=[
 "feature-candidates/zoroark-catalog-review-20261115/zoroark_topic_catalog_isolated.sql",
 "feature-candidates/zoroark-ca-notebook-20261116/zoroark_ca_notebook_extension.sql",
 "feature-candidates/zoroark-v8-20261117/zoroark_v8_five_status_isolated.sql"
];
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
try {
  console.log("ZOROARK_REAL_AUTH_INIT: disposable local Supabase only");
  cli(["init"],60000);
  const file=path.join(scratch,"supabase","config.toml");
  let cfg=readFileSync(file,"utf8");
  cfg=cfg.replace(/^project_id\s*=\s*".*"/m,
    'project_id = "zoroark-real-'+randomBytes(4).toString("hex")+'"');
  // Use actual GoTrue-signed JWTs with enough lifetime for integrated QA.
  const expiry=cfg.match(/^\s*jwt_expiry\s*=\s*\d+/m);
  if(!expiry)throw Error("Local CLI auth.jwt_expiry setting not found");
  cfg=cfg.replace(/^\s*jwt_expiry\s*=\s*\d+/m,"jwt_expiry = 300");
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
  // Local-only miniature contract fixture. The *actual* private SQL is separately
  // tested in the isolated Neon database; never import private SQL into this public repo.
  sql(db,[
    "CREATE TABLE public.zoroark_official_topic_state(topic_id text PRIMARY KEY, disabled boolean NOT NULL, revision integer NOT NULL, changed_by uuid NOT NULL REFERENCES auth.users(id));",
    "ALTER TABLE public.zoroark_official_topic_state ENABLE ROW LEVEL SECURITY;",
    "REVOKE ALL ON public.zoroark_official_topic_state FROM PUBLIC,anon,authenticated;",
    "GRANT SELECT (topic_id,disabled,revision) ON public.zoroark_official_topic_state TO authenticated;",
    "GRANT INSERT (topic_id,disabled,revision,changed_by) ON public.zoroark_official_topic_state TO authenticated;",
    "GRANT UPDATE (disabled,revision,changed_by) ON public.zoroark_official_topic_state TO authenticated;",
    "CREATE POLICY official_read ON public.zoroark_official_topic_state FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.role IN ('ca','admin')));",
    "CREATE POLICY official_insert ON public.zoroark_official_topic_state FOR INSERT TO authenticated WITH CHECK (changed_by=(SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.role='admin'));",
    "CREATE POLICY official_update ON public.zoroark_official_topic_state FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.role='admin')) WITH CHECK (changed_by=(SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.role='admin'));",
    "CREATE SCHEMA zoroark_fixture_private;",
    "REVOKE ALL ON SCHEMA zoroark_fixture_private FROM PUBLIC,anon,authenticated;",
    "CREATE TABLE zoroark_fixture_private.gate(writes_enabled boolean NOT NULL DEFAULT false);",
    "INSERT INTO zoroark_fixture_private.gate DEFAULT VALUES;",
    "REVOKE ALL ON zoroark_fixture_private.gate FROM PUBLIC,anon,authenticated;",
    "CREATE TABLE public.zoroark_fixture_audit(topic_id text, disabled boolean, revision integer, actor uuid);",
    "ALTER TABLE public.zoroark_fixture_audit ENABLE ROW LEVEL SECURITY;",
    "REVOKE ALL ON public.zoroark_fixture_audit FROM PUBLIC,anon,authenticated;",
    "CREATE FUNCTION zoroark_fixture_private.guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fixture$ BEGIN IF NOT EXISTS(SELECT 1 FROM zoroark_fixture_private.gate WHERE writes_enabled) THEN RAISE EXCEPTION 'DB gate disabled' USING errcode='42501'; END IF; IF NEW.changed_by<>auth.uid() THEN RAISE EXCEPTION 'actor mismatch'; END IF; IF TG_OP='INSERT' AND NEW.revision<>1 THEN RAISE EXCEPTION 'version mismatch'; END IF; IF TG_OP='UPDATE' AND (NEW.revision<>OLD.revision+1 OR NEW.disabled=OLD.disabled) THEN RAISE EXCEPTION 'version mismatch'; END IF; INSERT INTO public.zoroark_fixture_audit VALUES(NEW.topic_id,NEW.disabled,NEW.revision,auth.uid()); RETURN NEW; END; $fixture$;",
    "REVOKE ALL ON FUNCTION zoroark_fixture_private.guard() FROM PUBLIC,anon,authenticated;",
    "CREATE TRIGGER zoroark_fixture_guard BEFORE INSERT OR UPDATE ON public.zoroark_official_topic_state FOR EACH ROW EXECUTE FUNCTION zoroark_fixture_private.guard();",
    "NOTIFY pgrst, 'reload schema';"
  ].join("\n"));
  // Apply exact pinned private V8 schema after profiles and local fixture.
  // This never reaches production Supabase. Test data are generated by GoTrue.
  for(const p of v8sql){
   const source=readFileSync(path.join(privateRoot,p),"utf8");
   assert.ok(source.length>2000,"Private V8 SQL missing "+p);
   sql(db,source);
  }
  sql(db,"NOTIFY pgrst, 'reload schema';");
  console.log("ZOROARK_V8_REAL_AUTH_PRIVATE_SQL_PASS pinned="+process.env.ZOROARK_V8_BACKEND_EXPECTED_SHA);
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
  const nextEnv={...env,NEXT_PUBLIC_SUPABASE_URL:api,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:anon,
   ZOROARK_OFFICIAL_CONTROL_ENABLED:"true",ZOROARK_OFFICIAL_WRITE_ENABLED:"true",
   ZOROARK_CATALOG_LOCAL_TEST:"true",ZOROARK_NOTEBOOK_LOCAL_STACK_ENABLED:"true",
   ZOROARK_NOTEBOOK_API_ENABLED:"true",
   ZOROARK_NOTEBOOK_ISOLATED_SUPABASE_URL:api,
   ZOROARK_NOTEBOOK_ISOLATED_PUBLISHABLE_KEY:anon,
   ZOROARK_CATALOG_MANAGEMENT_ENABLED:"true",
   ZOROARK_CATALOG_PUBLISH_ENABLED:"true",
   ZOROARK_CATALOG_RUNTIME_ENABLED:"false"};
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
  // Explicit JWT is essential: auth.persistSession=false does not persist the sign-in session.
  const userDb=(token)=>createClient(api,anon,{
    global:{headers:{Authorization:"Bearer "+token}},
    auth:{persistSession:false,autoRefreshToken:false},
  });
  const upgrade=await userDb(people.pending.token).from("profiles").update({role:"admin"})
    .eq("id",people.pending.id).select();
  assert.ok(upgrade.error,"client cannot upgrade own role");
  await check("own role escalation rejected",base,people.pending.token,403);
  sql(db,"UPDATE public.profiles SET role='pending' WHERE id=:'uid'::uuid;",
    [["uid",people.revoked.id]]);
  await check("same signed JWT after role revocation",base,people.revoked.token,403);
  const mine=await userDb(people.ca.token).from("profiles").select("id,role");
  assert.equal(mine.error,null);assert.equal(mine.data?.length,1);
  assert.equal(mine.data[0].id,people.ca.id);
  const other=await userDb(people.pending.token).from("profiles").select("id,role");
  assert.equal(other.error,null,"pending RLS read");
  assert.equal(other.data?.length,1,"pending can only read own row");
  assert.equal(other.data[0].id,people.pending.id,"pending self identity");
  // Real signed JWT + actual PostgREST permission checks for the NEW official
  // topic stop/restore API. The SQL above is a local TEST fixture, not production.
  const manage=async(token,method="GET",body)=>{
    const headers={"Origin":"https://kaityo1221.github.io"};
    if(token)headers.Authorization="Bearer "+token;
    if(body)headers["Content-Type"]="application/json";
    const r=await fetch(base+"/api/zoroark/official",{
      method,headers,...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(12000)
    });
    return {status:r.status,body:await r.json()};
  };
  assert.equal((await manage(null)).status,401,"official API unauthenticated");
  assert.equal((await manage(people.ca.token)).status,403,"CA cannot manage official topics");
  assert.equal((await manage(people.pending.token)).status,403,"pending cannot manage official topics");
  assert.equal((await manage(people.revoked.token)).status,403,"revoked CA cannot manage");
  const initial=await manage(people.admin.token);
  assert.equal(initial.status,200,"ADMIN reads real PostgREST official rows");
  assert.equal(initial.body.states.length,0);
  assert.equal(initial.body.writeEnabled,true);
  const deniedGate=await manage(people.admin.token,"POST",{topicId:"e01",disabled:true,expectedRevision:0});
  assert.equal(deniedGate.status,409,"private DB gate OFF blocks valid ADMIN");
  const emptyAfterDeny=await manage(people.admin.token);
  assert.equal(emptyAfterDeny.body.states.length,0,"no phantom success with DB gate OFF");
  sql(db,"UPDATE zoroark_fixture_private.gate SET writes_enabled=true;");
  // Public game policy intentionally limits recent to 6. Seed the OTHER five
  // candidates as disabled to make e01 selection deterministic without violating it.
  for(let i=2;i<=6;i++){
    const id="e"+String(i).padStart(2,"0");
    const seed=await manage(people.admin.token,"POST",{topicId:id,disabled:true,expectedRevision:0});
    assert.equal(seed.status,200,"fixture seed "+id+" through real ADMIN API");
  }
  const onlyE01=Array.from({length:6},(_,i)=>"e"+String(i+7).padStart(2,"0"));
  const beforeDisable=await request(base,people.ca.token,{count:6,difficulty:"easy",recent:onlyE01});
  assert.equal(beforeDisable.code,200,"deterministic e01 allowed");
  assert.equal(beforeDisable.json.round.pair.id,"e01");
  const deniedCA=await manage(people.ca.token,"POST",{topicId:"e01",disabled:true,expectedRevision:0});
  assert.equal(deniedCA.status,403,"CA cannot disable topics even when DB gate ON");
  const stopped=await manage(people.admin.token,"POST",{topicId:"e01",disabled:true,expectedRevision:0});
  assert.equal(stopped.status,200,"real ADMIN POST stops topic");
  assert.equal(stopped.body.gameConfirmed,true);
  assert.equal(stopped.body.state.revision,1);
  const stale=await manage(people.admin.token,"POST",{topicId:"e01",disabled:true,expectedRevision:0});
  assert.equal(stale.status,409,"replayed version cannot update");
  const changed=await request(base,people.ca.token,{count:6,difficulty:"easy",recent:onlyE01});
  assert.equal(changed.code,200);
  assert.notEqual(changed.json.round.pair.id,"e01","disabled e01 never selected by another CA");
  const restored=await manage(people.admin.token,"POST",{topicId:"e01",disabled:false,expectedRevision:1});
  assert.equal(restored.status,200,"ADMIN restores the same topic");
  assert.equal(restored.body.state.revision,2);
  const afterRestore=await request(base,people.ca.token,{count:6,difficulty:"easy",recent:onlyE01});
  assert.equal(afterRestore.code,200);
  assert.equal(afterRestore.json.round.pair.id,"e01","restored e01 eligible for next round");
  const audit=await admin.from("zoroark_fixture_audit").select("topic_id,disabled,revision,actor").eq("topic_id","e01").order("revision");
  assert.equal(audit.error,null);
  assert.deepEqual(audit.data?.map(x=>[x.topic_id,x.disabled,x.revision,x.actor]),[
    ["e01",true,1,people.admin.id],["e01",false,2,people.admin.id]
  ]);
  sql(db,"UPDATE zoroark_fixture_private.gate SET writes_enabled=false;");
  const deniedAfterOff=await manage(people.admin.token,"POST",{topicId:"e01",disabled:true,expectedRevision:2});
  assert.equal(deniedAfterOff.status,409,"gate OFF after restoration protects next round");
  console.log("ZOROARK_OFFICIAL_REAL_AUTH_LOCAL_PASS real_gotrue=true admin_ca_rls=true live_exclusion=true restore=true audit=true private_fixture=true");

  const apiRequest=async(token,method="GET",payload,scope="mine")=>{
   const headers={"Origin":"http://localhost:5588"};
   if(token)headers.Authorization="Bearer "+token;
   if(payload)headers["Content-Type"]="application/json";
   const r=await fetch(base+"/api/zoroark/notebook"+(method==="GET"?"?scope="+scope:""),{
    method,headers,...(payload?{body:JSON.stringify(payload)}:{}),signal:AbortSignal.timeout(20000)
   });
   return {status:r.status,body:await r.json()};
  };
  const sample={a:"ヤクデ",b:"マルヤクデ",aNo:"850",bNo:"851",
   common:"むしタイプ",difference:"進化",level:"normal"};
  assert.equal((await apiRequest(null)).status,401,"notebook anonymous denied");
  assert.equal((await apiRequest(people.pending.token)).status,403,"notebook pending role denied");
  assert.equal((await apiRequest(people.ca.token)).status,200,"CA notebook list allowed");
  assert.equal((await apiRequest(people.ca.token,"GET",null,"all")).status,403,"CA global list denied");
  assert.equal((await apiRequest(people.ca.token,"POST",{action:"submit",topic:sample})).status,403,
   "DB write gate initially OFF");
  sql(db,"UPDATE public.zoroark_topic_notebook_control SET writes_enabled=true WHERE singleton;");
  sql(db,"UPDATE public.zoroark_topic_catalog_control SET publish_enabled=true WHERE singleton;");
  const submitted=await apiRequest(people.ca.token,"POST",{action:"submit",topic:sample});
  assert.equal(submitted.status,201,"real GoTrue CA POST "+JSON.stringify(submitted.body));
  assert.ok(!Object.hasOwn(submitted.body.entry,"status"),"CA submit response lacks review metadata");
  const id=submitted.body.entry.id;
  const caMine=await apiRequest(people.ca.token);
  assert.equal(caMine.body.entries.length,1);assert.ok(!Object.hasOwn(caMine.body.entries[0],"status"));
  const direct=await userDb(people.ca.token).from("zoroark_topic_candidates").select("id,status").eq("id",id);
  assert.equal(direct.error,null);assert.equal(direct.data.length,0,"direct PostgREST cannot leak unpublished status");
  const adminAll=await apiRequest(people.admin.token,"GET",null,"all");
  assert.equal(adminAll.status,200);assert.equal(adminAll.body.entries.find(x=>x.id===id).status,"pending");
  assert.equal((await apiRequest(people.ca.token,"POST",{
   action:"move-status",id,targetStatus:"published",expectedStatus:"pending",
   expectedRevision:0,confirmPublish:true})).status,403,"CA cannot publish");
  const move=payload=>apiRequest(people.admin.token,"POST",payload);
  const published=await move({action:"move-status",id,targetStatus:"published",
   expectedStatus:"pending",expectedRevision:0,confirmPublish:true});
  assert.equal(published.status,200,JSON.stringify(published.body));assert.equal(published.body.entry.status,"published");
  assert.equal((await move({action:"move-status",id,targetStatus:"rejected",
   expectedStatus:"pending",expectedRevision:0})).status,409,"CAS rejects stale status");
  const revised=await move({action:"edit-published",id,topic:{...sample,common:"長い体"},
   expectedRevision:1,expectedVersion:published.body.entry.version,confirmPublishEdit:true});
  assert.equal(revised.status,200,JSON.stringify(revised.body));assert.equal(revised.body.entry.status,"published");
  assert.equal((await move({action:"edit-published",id,topic:sample,
   expectedRevision:1,expectedVersion:published.body.entry.version,confirmPublishEdit:true})).status,409);
  assert.equal((await move({action:"move-status",id,targetStatus:"deleted",
   expectedStatus:"published",expectedRevision:2,confirmDelete:true})).status,200);
  assert.equal((await move({action:"move-status",id,targetStatus:"approved",
   expectedStatus:"deleted",expectedRevision:3})).status,200);
  sql(db,"UPDATE public.zoroark_topic_notebook_control SET writes_enabled=false WHERE singleton;");
  sql(db,"UPDATE public.zoroark_topic_catalog_control SET publish_enabled=false WHERE singleton;");
  console.log("ZOROARK_V8_REAL_GOTRUE_NEXT_PASS signedJWT=true statusPrivate=true CAS=true publishedEdit=true gatesOFF=true");

} catch(error) {
  exit=1;
  console.error("ZOROARK_V8_REAL_AUTH_LOCAL_FAIL",error?.message||String(error));
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
