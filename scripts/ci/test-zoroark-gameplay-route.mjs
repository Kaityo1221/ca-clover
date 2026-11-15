import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import {createRequire} from "node:module";
import {webcrypto} from "node:crypto";
import ts from "typescript";
const require=createRequire(import.meta.url);
const room="11111111-1111-4111-8111-111111111111";
const gm="22222222-2222-4222-8222-222222222222";
const guest="33333333-3333-4333-8333-333333333333";
const jwt="synthetic";
const secret="a".repeat(64),device="b".repeat(64);
const official={round:{pair:{id:"a01"},wolf:1,prompts:["ピカチュウ","イーブイ","ピカチュウ"]}};
function harness(options={}){
 const env={VERCEL_ENV:"preview",VERCEL_GIT_COMMIT_REF:"feature/zoroark-qr-gameplay-preprod-20261115",
  ZOROARK_GAMEPLAY_ENABLED:"true",NEXT_PUBLIC_SUPABASE_URL:"https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"sb_publishable_synthetic",
  ZOROARK_NEON_GM_DATABASE_URL:"postgresql://zoroark_runtime_gm:synthetic@ep-frosty-grass-betfuvsp-pooler.c-9.us-east-2.aws.neon.tech/zoroark_prod?sslmode=require",
  ZOROARK_NEON_GUEST_DATABASE_URL:"postgresql://zoroark_runtime_guest:synthetic@ep-frosty-grass-betfuvsp-pooler.c-9.us-east-2.aws.neon.tech/zoroark_prod?sslmode=require",
  ...options.env};
 const calls=[];let canonicalCalls=0;
 const neon=url=>async(strings,...args)=>{
  const q=strings.join("?");calls.push({q,args});
  if(q.includes("runtime_identity"))return [{database_name:"zoroark_prod",role_name:new URL(url).username,target:"preview",version:3}];
  if(q.includes("guest_rate_gate"))return [{allowed:true}];
  if(q.includes("gm_room"))return options.foreignRoom?[]:[{id:room,state:"lobby",max_players:6}];
  if(q.includes("gm_participants"))return [
   {id:guest,state:"approved"},{id:"44444444-4444-4444-8444-444444444444",state:"approved"},
   {id:"55555555-5555-4555-8555-555555555555",state:"approved"}];
  if(q.includes("gm_game_start"))return [{ok:true}];
  if(q.includes("gm_game_state"))return [{game:{phase:"talk",players:[{id:guest,name:"Trainer",number:1}],voted:0}}];
  if(q.includes("gm_game_advance"))return [{phase:"vote"}];
  if(q.includes("gm_game_finish"))return [{ok:true}];
  if(q.includes("guest_game_state"))return [{game:{phase:"talk",myId:guest,role:"villager",prompt:"ピカチュウ",players:[{id:guest,name:"Trainer",number:1}]}}];
  if(q.includes("guest_game_vote")||q.includes("guest_game_question"))return [{ok:true}];
  return [];
 };
 const auth={auth:{getUser:async()=>({data:{user:options.invalidAuth?null:{id:gm}},error:null})},
  from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{role:options.role??"ca"},error:null})})})})};
 const cached=new Map();
 function load(path){
  if(cached.has(path))return cached.get(path);
  const js=ts.transpileModule(fs.readFileSync(path,"utf8"),{compilerOptions:{
   module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const module={exports:{}};cached.set(path,module.exports);
  const localRequire=x=>x==="@neondatabase/serverless"?{neon}:x==="@supabase/supabase-js"?{createClient:()=>auth}:
   x==="@/lib/zoroark/runtime"?load("src/lib/zoroark/runtime.ts"):require(x);
  vm.runInNewContext(js,{module,exports:module.exports,require:localRequire,process:{env},Request,Response,
   Headers,URL,TextEncoder,TextDecoder,Uint8Array,AbortController,crypto:webcrypto,setTimeout,clearTimeout,console,
   fetch:async()=>{canonicalCalls++;return Response.json(options.official??official)}},{filename:path});
  return module.exports;
 }
 return {calls,route:name=>load("src/app/api/zoroark/game/"+name+"/route.ts"),getCanonicalCalls:()=>canonicalCalls};
}
function request(name,data,headers={}){
 return new Request("https://preview.example/api/zoroark/game/"+name,{method:"POST",headers:{
  origin:"https://preview.example","content-type":"application/json","x-zoroark-request":"game-v1",
  authorization:"Bearer "+jwt,...headers},body:JSON.stringify(data)});
}
test("production and feature gates fail closed without DB access",async()=>{
 for(const env of [{ZOROARK_GAMEPLAY_ENABLED:"false"},{VERCEL_ENV:"production",VERCEL_GIT_COMMIT_REF:"main"}]){
  for(const name of ["gm","guest"]){const h=harness({env});const res=await h.route(name).POST(request(name,{action:"status",roomId:room}));
   assert.equal(res.status,503);assert.equal(h.calls.length,0)}
 }
});
test("both APIs reject cross-site and malformed requests before DB",async()=>{
 for(const name of ["gm","guest"])for(const headers of [{origin:"https://evil.example"},{"sec-fetch-site":"cross-site"},{"x-zoroark-request":"fake"}]){
  const h=harness();const response=await h.route(name).POST(request(name,{action:"status",roomId:room},headers));
  assert.equal(response.status,403);assert.equal(h.calls.length,0);
 }
});
test("GM requires current Auth identity, role, and owned room",async()=>{
 for(const [opt,status] of [[{invalidAuth:true},401],[{role:"trainer"},403],[{foreignRoom:true},404]]){
  const h=harness(opt);
  const res=await h.route("gm").POST(request("gm",{action:"status",roomId:room}));
  assert.equal(res.status,status);assert.equal(h.getCanonicalCalls(),0);
 }
});
test("GM start fetches canonical round once; never returns prompts or role indices",async()=>{
 const h=harness();
 const res=await h.route("gm").POST(request("gm",{action:"start",roomId:room,difficulty:"all",enableMimikyu:false}));
 assert.equal(res.status,200,JSON.stringify({body:await res.clone().json(),calls:h.calls.map(x=>x.q)}));assert.deepEqual(await res.json(),{ok:true,phase:"talk"});
 assert.equal(h.getCanonicalCalls(),1);
 const start=h.calls.find(x=>x.q.includes("gm_game_start"));
 assert.ok(start);assert.equal(start.args[2],"a01");assert.equal(start.args[3],"ピカチュウ");assert.equal(start.args[4],"イーブイ");
 assert.ok(!JSON.stringify(await h.route("gm").POST(request("gm",{action:"status",roomId:room}))).includes("イーブイ"));
});
test("malformed official pair fails closed without writing a round",async()=>{
 const h=harness({official:{round:{pair:{id:"a01"},wolf:1,prompts:["ピカチュウ","イーブイ","フシギダネ"]}}});
 const res=await h.route("gm").POST(request("gm",{action:"start",roomId:room,difficulty:"all",enableMimikyu:false}));
 assert.equal(res.status,503);assert.equal(h.calls.some(x=>x.q.includes("gm_game_start")),false);
});
test("guest requires exactly one pair of valid HttpOnly session cookies",async()=>{
 for(const cookie of ["", "__Host-zg_guest="+secret, "__Host-zg_guest="+secret+"; __Host-zg_device="+device+"; __Host-zg_device="+device]){
  const h=harness();const res=await h.route("guest").POST(request("guest",{action:"state"},{cookie}));
  assert.equal(res.status,401);assert.equal(h.calls.length,0);
 }
});
test("guest status uses hashed session+device, returns only the authenticated player secret",async()=>{
 const h=harness();const cookie="__Host-zg_guest="+secret+"; __Host-zg_device="+device;
 const res=await h.route("guest").POST(request("guest",{action:"state"},{cookie}));
 assert.equal(res.status,200);
 const value=await res.json();assert.equal(value.game.role,"villager");assert.equal(value.game.prompt,"ピカチュウ");
 assert.ok(!JSON.stringify(value.game.players).includes("role"));
 const call=h.calls.find(x=>x.q.includes("guest_game_state"));assert.ok(call);
 assert.notEqual(call.args[0],secret);assert.notEqual(call.args[1],device);
 assert.match(call.args[0],/^[a-f0-9]{64}$/);assert.match(call.args[1],/^[a-f0-9]{64}$/);
 assert.ok(!JSON.stringify(value).includes(secret));
});
test("guest own vote only; no room ID or role accepted from caller",async()=>{
 const h=harness();const cookie="__Host-zg_guest="+secret+"; __Host-zg_device="+device;
 const bad=await h.route("guest").POST(request("guest",{action:"vote",targetId:"bad"},{cookie}));
 assert.equal(bad.status,400);
 const res=await h.route("guest").POST(request("guest",{action:"vote",targetId:room,roomId:"untrusted",role:"zoroark"},{cookie}));
 assert.equal(res.status,200);
 const call=h.calls.find(x=>x.q.includes("guest_game_vote"));assert.equal(call.args.length,3);
 assert.equal(call.args[2],room);
});
