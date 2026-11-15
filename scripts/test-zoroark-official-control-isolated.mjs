import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import {spawn} from "node:child_process";

const UID="00000000-0000-4000-8000-000000000001";
const TOKENS={admin:"synthetic-official-admin-token-000001",ca:"synthetic-official-ca-token-00000001",
 pending:"synthetic-official-pending-token-01",invalid:"synthetic-official-invalid-token-01"};
const roles=new Map([[TOKENS.admin,"admin"],[TOKENS.ca,"ca"],[TOKENS.pending,"pending"]]);
let unavailable=false,dbWrites=0,wrongWrites=0;
const status=new Map();
function reply(res,n,obj){
 res.writeHead(n,{"content-type":"application/json"});
 res.end(JSON.stringify(obj));
}
const mock=http.createServer(async(req,res)=>{
 const url=new URL(req.url||"/","http://127.0.0.1");
 const token=(req.headers.authorization||"").replace(/^Bearer /,"");
 if(url.pathname==="/auth/v1/user"){
  if(!roles.has(token))return reply(res,401,{msg:"invalid"});
  return reply(res,200,{id:UID,aud:"authenticated",role:"authenticated",email:"test@example.invalid",
   app_metadata:{},user_metadata:{},created_at:"2026-01-01T00:00:00Z"});
 }
 if(url.pathname==="/rest/v1/profiles"){
  if(!roles.has(token))return reply(res,401,{message:"invalid"});
  return reply(res,200,{role:roles.get(token)});
 }
 if(url.pathname==="/rest/v1/zoroark_official_topic_state"){
  if(unavailable)return reply(res,503,{code:"PGRST000",message:"unavailable"});
  if(!["admin","ca"].includes(roles.get(token)))return reply(res,403,{message:"forbidden"});
  if(req.method==="GET"){
   const rows=[...status.values()].filter(x=>url.searchParams.get("disabled")!=="eq.true"||x.disabled);
   return reply(res,200,rows);
  }
  if(roles.get(token)!=="admin"){wrongWrites++;return reply(res,403,{message:"forbidden"})}
  let raw="";for await(const chunk of req){raw+=chunk.toString()}
  const input=JSON.parse(raw||"{}");
  const key=req.method==="PATCH"?String(url.searchParams.get("topic_id")||"").replace("eq.",""):input.topic_id;
  const existing=status.get(key);
  if(req.method==="POST"){
   if(existing)return reply(res,409,{code:"23505",message:"duplicate"});
   const row={topic_id:key,disabled:input.disabled,revision:input.revision};
   status.set(key,row);dbWrites++;return reply(res,201,row);
  }
  if(req.method==="PATCH"){
   const rev=Number(String(url.searchParams.get("revision")).replace("eq.",""));
   if(!existing||existing.revision!==rev)return reply(res,200,null);
   if(input.revision!==rev+1)return reply(res,409,{message:"revision"});
   Object.assign(existing,{disabled:input.disabled,revision:input.revision});dbWrites++;
   return reply(res,200,existing);
  }
  return reply(res,405,{message:"unsupported"});
 }
 reply(res,404,{message:"unexpected"});
});
async function listen(server){
 await new Promise((res,rej)=>{server.once("error",rej);server.listen(0,"127.0.0.1",res)});
 return server.address().port;
}
async function port(){
 const server=net.createServer();const p=await listen(server);
 await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));return p;
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let child,logs="";
try{
 const mockPort=await listen(mock),nextPort=await port(),base="http://127.0.0.1:"+nextPort;
 child=spawn(process.execPath,["node_modules/next/dist/bin/next","dev","--hostname","127.0.0.1","--port",String(nextPort)],
  {cwd:process.cwd(),stdio:["ignore","pipe","pipe"],env:{
    ...process.env,NEXT_PUBLIC_SUPABASE_URL:"http://127.0.0.1:"+mockPort,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"sb_publishable_synthetic_only",
    ZOROARK_OFFICIAL_CONTROL_ENABLED:"true",ZOROARK_OFFICIAL_WRITE_ENABLED:"true",
    SUPABASE_SERVICE_ROLE_KEY:"",NEXT_TELEMETRY_DISABLED:"1"
  }});
 child.stdout.on("data",data=>logs+=data.toString());
 child.stderr.on("data",data=>logs+=data.toString());
 const until=Date.now()+90000;
 while(Date.now()<until){
  if(child.exitCode!==null)throw Error("Next stopped early "+child.exitCode);
  try{const x=await fetch(base+"/api/zoroark/official");if(x.status===401)break}
  catch{}
  await sleep(350);
 }
 if(Date.now()>=until)throw Error("Next startup timeout: "+logs.slice(-1000));
 const origin="https://kaityo1221.github.io";
 async function query(url,token,body){
  const opts={method:body?"POST":"GET",headers:{Origin:origin,...(token?{Authorization:"Bearer "+token}:{})}};
  if(body){opts.headers["Content-Type"]="application/json";opts.body=JSON.stringify(body)}
  const r=await fetch(base+url,opts);return {status:r.status,data:await r.json()};
 }
 assert.equal((await query("/api/zoroark/official",undefined)).status,401,"anonymous denied");
 assert.equal((await query("/api/zoroark/official",TOKENS.ca)).status,403,"CA cannot manage");
 assert.equal((await query("/api/zoroark/official",TOKENS.pending)).status,403,"pending cannot manage");
 const init=await query("/api/zoroark/official",TOKENS.admin);
 assert.equal(init.status,200);assert.equal(init.data.states.length,0);assert.equal(init.data.writeEnabled,true);
 assert.equal((await query("/api/zoroark/official",TOKENS.admin,
  {topicId:"wrong",disabled:true,expectedRevision:0})).status,400);
 assert.equal((await query("/api/zoroark/official",TOKENS.admin,
  {topicId:"e01",disabled:false,expectedRevision:0})).status,409);
 const first=await query("/api/zoroark/official",TOKENS.admin,
  {topicId:"e01",disabled:true,expectedRevision:0});
 assert.equal(first.status,200);assert.equal(first.data.state.revision,1);assert.equal(first.data.gameConfirmed,true);
 const replay=await query("/api/zoroark/official",TOKENS.admin,
  {topicId:"e01",disabled:true,expectedRevision:0});assert.equal(replay.status,409);
 const snapshot=await query("/api/zoroark/official",TOKENS.admin);
 assert.equal(snapshot.data.states.find(x=>x.topic_id==="e01").disabled,true);
 // All other easy pairs disabled except e02, proving global server round selection excludes them.
 for(let n=3;n<=12;n++)status.set("e"+String(n).padStart(2,"0"),
  {topic_id:"e"+String(n).padStart(2,"0"),disabled:true,revision:1});
 const round=await query("/api/zoroark/round",TOKENS.ca,{count:6,difficulty:"easy",recent:[]});
 assert.equal(round.status,200);assert.equal(round.data.round.pair.id,"e02");
 const disabled=await query("/api/zoroark/official",TOKENS.admin,
  {topicId:"e02",disabled:true,expectedRevision:0});assert.equal(disabled.status,200);
 const exhausted=await query("/api/zoroark/round",TOKENS.ca,{count:6,difficulty:"easy",recent:[]});
 assert.equal(exhausted.status,503,"no fallback to disabled official questions");
 const restored=await query("/api/zoroark/official",TOKENS.admin,
  {topicId:"e01",disabled:false,expectedRevision:1});
 assert.equal(restored.status,200);assert.equal(restored.data.state.disabled,false);
 assert.equal(restored.data.state.revision,2);
 const newRound=await query("/api/zoroark/round",TOKENS.ca,{count:6,difficulty:"easy",recent:[]});
 assert.equal(newRound.status,200);assert.equal(newRound.data.round.pair.id,"e01");
 unavailable=true;
 assert.equal((await query("/api/zoroark/round",TOKENS.ca,{count:6,difficulty:"easy"})).status,503);
 assert.equal((await query("/api/zoroark/official",TOKENS.admin)).status,503);
 assert.equal(wrongWrites,0);assert.equal(dbWrites,3);
 console.log("ZOROARK_OFFICIAL_ISOLATED_HTTP_PASS round exclusion restore admin RLS proxy fail_closed");
}catch(e){
 console.error("ZOROARK_OFFICIAL_ISOLATED_HTTP_FAIL",e?.message||e);
 console.error("NEXT_LOG_TAIL",logs.slice(-2000));process.exitCode=1;
}finally{
 child?.kill("SIGTERM");
 await new Promise(resolve=>mock.close(()=>resolve()));
}
