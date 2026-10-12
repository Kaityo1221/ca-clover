/**
 * Phase D: actual Deno Edge HTTP entrypoints against a local fake PostgREST/Auth/API.
 * NO production credentials, NO external network access for Edge child processes.
 * The master Google CSV URL is never fetched because these are negative cases.
 * This is mocked HTTP safety E2E, not a restored production-schema test.
 */
import assert from "node:assert/strict";
import http from "node:http";
import {spawn} from "node:child_process";
import {once} from "node:events";

const EDGE="http://127.0.0.1:8000";
const SECRET="synthetic-only-secret";
const USER_ID="00000000-0000-4000-8000-000000000001";
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const baseState=()=>({
  id:1, enabled:true, ca_master_sync_enabled:false,
  last_ca_master_at:"2000-01-01T00:00:00Z",
  last_started_at:null,last_finished_at:null,last_event_calendar_at:null,
  last_public_at:null, last_public_imported:0,
  last_icon_at:null,last_icon_processed:0,last_icon_changed:0,
  last_history_at:null,last_history_imported:0,
  public_offset:0,public_batch_size:10, icon_offset:0,icon_batch_size:10
});
const fixture={state:baseState(),missingGateColumn:false,role:"admin",calls:[],writes:[]};

function send(res,status,value,req){
  res.statusCode=status;
  if(status===204){res.end();return;}
  res.setHeader("content-type","application/json");
  res.end(JSON.stringify(value));
}
function selectable(req,records){
  const accept=String(req.headers.accept??"");
  return accept.includes("application/vnd.pgrst.object+json")
    ?(Array.isArray(records)?records[0]??null:records)
    :(Array.isArray(records)?records:[records]);
}
function localBackend(req,res){
  const url=new URL(req.url,"http://127.0.0.1");
  const path=url.pathname;
  fixture.calls.push(req.method+" "+path);
  if(path==="/auth/v1/user"&&req.method==="GET"){
    return send(res,200,{id:USER_ID,email:"fake@example.invalid"},req);
  }
  if(path==="/rest/v1/rpc/internal_get_sync_cron_secret"&&req.method==="POST"){
    return send(res,200,SECRET,req);
  }
  if(path==="/rest/v1/rpc/internal_begin_ca_master_lease"&&req.method==="POST"){
    // A deliberate refusal ensures never entering any CSV/network/write path.
    return send(res,200,false,req);
  }
  if(path==="/rest/v1/sync_automation_state"&&req.method==="GET"){
    if(fixture.missingGateColumn && url.searchParams.get("select")?.includes("ca_master_sync_enabled")){
      return send(res,400,{code:"42703",message:"column not found"},req);
    }
    return send(res,200,selectable(req,fixture.state),req);
  }
  if(path==="/rest/v1/profiles"&&req.method==="GET"){
    return send(res,200,selectable(req,{role:fixture.role}),req);
  }
  if(path==="/rest/v1/watch_settings"&&req.method==="GET"){
    return send(res,200,selectable(req,{enabled:false,normal_scan_interval_minutes:15,
      event_calendar_sync_interval_minutes:360}),req);
  }
  if(path==="/rest/v1/campfire_connection_state"&&req.method==="GET"){
    return send(res,200,selectable(req,{status:"ready",expires_at:"2099-01-01T00:00:00Z"}),req);
  }
  if(path==="/rest/v1/communities"&&req.method==="GET"){
    return send(res,200,selectable(req,[]),req);
  }
  if(path.startsWith("/rest/v1/") && (req.method==="PATCH"||req.method==="POST")){
    fixture.writes.push(req.method+" "+path);
    return send(res,204,null,req);
  }
  if(path.startsWith("/functions/v1/")&&req.method==="POST"){
    if(path==="/functions/v1/sync-ca-master"){
      // An admin wrapper can forward only into the dummy local stub.
      return send(res,423,{ok:false,error:"synthetic master always paused"},req);
    }
    return send(res,200,{ok:true,processed:0,total:0,changed:0,importedEvents:0},req);
  }
  return send(res,404,{error:"Unhandled isolated mock: "+path},req);
}
async function startBackend(){
  const server=http.createServer(localBackend);
  server.listen(0,"127.0.0.1");
  await once(server,"listening");
  return {server,port:server.address().port};
}
async function startEdge(entry,port){
  const env={
    PATH:process.env.PATH??"",HOME:process.env.HOME??"",
    DENO_DIR:process.env.DENO_DIR??"",
    SUPABASE_URL:"http://127.0.0.1:"+port,
    SUPABASE_ANON_KEY:"synthetic-anon-key",
    SUPABASE_SERVICE_ROLE_KEY:"synthetic-service-key",
  };
  const child=spawn("deno",[
    "run","--cached-only","--allow-net=127.0.0.1,0.0.0.0:8000",
    "--allow-env=SUPABASE_URL,SUPABASE_ANON_KEY,SUPABASE_SERVICE_ROLE_KEY",
    entry
  ],{env,stdio:["ignore","pipe","pipe"]});
  let logs="";
  child.stdout.on("data",c=>logs=(logs+String(c)).slice(-1500));
  child.stderr.on("data",c=>logs=(logs+String(c)).slice(-1500));
  for(let i=0;i<100;i++){
    if(child.exitCode!==null)throw Error("Edge boot failed: "+entry+" "+logs);
    try{
      const response=await fetch(EDGE+"/ping",{signal:AbortSignal.timeout(250)});
      if(response.status>0)return child;
    }catch{}
    await delay(100);
  }
  child.kill("SIGTERM");
  throw Error("Edge did not start "+entry+" "+logs);
}
async function stopEdge(child){
  if(!child)return;
  child.kill("SIGTERM");
  await Promise.race([once(child,"exit").catch(()=>{}),delay(2000)]);
  if(child.exitCode===null&&child.signalCode===null)child.kill("SIGKILL");
  // Verify the port is released before starting the next handler.
  for(let i=0;i<25;i++){
    try{await fetch(EDGE+"/ping",{signal:AbortSignal.timeout(150)});}catch{return;}
    await delay(80);
  }
}
function reset({enabled=false,sentinel=false,missing=false,role="admin"}={}){
  fixture.state=baseState();
  fixture.state.ca_master_sync_enabled=enabled;
  if(sentinel)fixture.state.last_ca_master_at="2099-01-01T00:00:00Z";
  fixture.missingGateColumn=missing;
  fixture.role=role;
  fixture.calls.length=0;fixture.writes.length=0;
}
async function request(headers={}){
  const response=await fetch(EDGE+"/functions/v1/qa",{
    method:"POST",
    headers:{"x-ca-clover-cron-secret":SECRET,...headers},
    signal:AbortSignal.timeout(8000)
  });
  return {status:response.status,body:await response.json()};
}
function assertMasterUntouched(label){
  assert.equal(fixture.writes.length,0,label+": no PostgREST mutation");
  assert.equal(fixture.calls.filter(x=>x.includes("/functions/v1/sync-ca-master")).length,0,
    label+": no master forwarding");
}
async function main(){
  const {server,port}=await startBackend();
  let child=null;
  try{
    child=await startEdge("supabase/functions/sync-ca-master/index.ts",port);
    reset();
    let a=await request();
    assert.equal(a.status,423,"direct master paused");
    assertMasterUntouched("master gate false");

    reset({enabled:true,sentinel:true});
    a=await request();
    assert.equal(a.status,423,"2099 sentinel is independent backstop");
    assertMasterUntouched("master sentinel");

    reset({missing:true});
    a=await request();
    assert.equal(a.status,503,"missing gate schema fails closed");
    assertMasterUntouched("master missing gate");

    reset({enabled:true});
    a=await request();
    assert.equal(a.status,410,"legacy master remains retired even when gate enabled");
    assertMasterUntouched("master always retired");

    reset();
    a=await request({"x-ca-clover-cron-secret":"incorrect"});
    assert.equal(a.status,401,"direct master rejects unauthorized caller");
    assertMasterUntouched("master unauthorized");
    await stopEdge(child);child=null;
    console.log("PASS: actual direct master Edge handler HTTP 401/423/503/410, no writes");

    child=await startEdge("supabase/functions/sync-ca-master-coordinates/index.ts",port);
    reset();
    a=await request();
    assert.equal(a.status,423,"coordinate writer paused");
    assertMasterUntouched("coordinate gate OFF");

    reset({missing:true});
    a=await request();
    assert.equal(a.status,503,"coordinate writer missing gate fails closed");
    assertMasterUntouched("coordinate missing gate");

    reset({enabled:true});
    a=await request();
    assert.equal(a.status,410,"coordinate writer remains retired with flag ON");
    assertMasterUntouched("coordinate legacy retired");

    reset();
    a=await request({"x-ca-clover-cron-secret":"incorrect"});
    assert.equal(a.status,401,"coordinates unauthorized");
    assertMasterUntouched("coordinate unauthorized");
    await stopEdge(child);child=null;
    console.log("PASS: actual coordinate legacy Edge handler 401/423/503/410, no writes");

    child=await startEdge("supabase/functions/sync-ca-master-admin/index.ts",port);
    reset();
    a=await request();
    assert.equal(a.status,401,"manual admin missing bearer");
    assertMasterUntouched("admin missing bearer");

    reset({role:"member"});
    a=await request({Authorization:"Bearer fake-user-token"});
    assert.equal(a.status,403,"manual admin nonadmin role");
    assertMasterUntouched("admin nonadmin");

    reset();
    a=await request({Authorization:"Bearer fake-user-token"});
    assert.equal(a.status,423,"manual admin paused");
    assertMasterUntouched("admin paused");

    reset({missing:true});
    a=await request({Authorization:"Bearer fake-user-token"});
    assert.equal(a.status,503,"manual admin missing gate");
    assertMasterUntouched("admin missing gate");

    reset({enabled:true});
    a=await request({Authorization:"Bearer fake-user-token"});
    assert.equal(a.status,423,"local master stub refuses every forwarded request");
    assert.equal(fixture.calls.filter(x=>x.includes("/functions/v1/sync-ca-master")).length,1,
      "Admin forwards ONLY to local fake master stub");
    assert.equal(fixture.writes.length,0);
    await stopEdge(child);child=null;
    console.log("PASS: actual admin Edge handler HTTP 401/403/423/503 and local-only forward");

    child=await startEdge("supabase/functions/sync-campfire-auto/index.ts",port);
    for(const mode of [{label:"master-off",cfg:{}},
                       {label:"master-flag-absent",cfg:{},omitFlag:true},
                       {label:"2099-sentinel",cfg:{enabled:true,sentinel:true}}]){
      reset(mode.cfg);
      if(mode.omitFlag)delete fixture.state.ca_master_sync_enabled;
      a=await request();
      assert.equal(a.status,200,mode.label+": general scheduler should continue");
      assert.equal(a.body.ok,true,mode.label);
      assert.equal(a.body.masterResult,null,mode.label+": no master sync");
      assert.ok(fixture.calls.some(x=>x.includes("/functions/v1/sync-campfire-public")),
        mode.label+": public Meetup sync continues");
      assert.ok(fixture.calls.some(x=>x.includes("/functions/v1/sync-community-icons")),
        mode.label+": icon sync continues");
      assert.ok(fixture.calls.some(x=>x.includes("/functions/v1/meetup-watch-notify")),
        mode.label+": notification processing continues");
      assert.ok(fixture.calls.some(x=>x.includes("/functions/v1/community-claim-notify")),
        mode.label+": claim notifications continue");
      assert.equal(fixture.calls.some(x=>x.includes("/functions/v1/sync-ca-master")),false,
        mode.label+": no master sync");
      assert.ok(fixture.writes.some(x=>x.includes("/rest/v1/sync_automation_state")),
        mode.label+": unrelated scheduler state continues");
      assert.ok(fixture.writes.some(x=>x.includes("/rest/v1/sync_runs")),
        mode.label+": unrelated scheduler audit continues");
    }
    await stopEdge(child);child=null;
    console.log("PASS: actual automatic Edge handler HTTP retains public/icons/notifications while CA master paused");
    console.log("MINIMAL_MASTER_GUARD_ISOLATED_EDGE_HTTP_PASS (mock backend only)");
  }finally{
    if(child)await stopEdge(child);
    await new Promise(resolve=>server.close(resolve));
  }
}
await main();
