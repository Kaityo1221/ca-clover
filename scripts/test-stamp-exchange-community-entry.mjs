import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const rally=readFileSync("docs/stamp-rally.html","utf8");
const page=readFileSync("docs/stamp-exchange-community.html","utf8");
const link='<a class="community-record-card" href="./stamp-exchange-community.html?v=20261109"';
assert.ok(rally.includes(link),"New CTA missing from medal rally");
assert.ok(rally.indexOf(link)<rally.indexOf('href="./stamp-exchange.html"'),"CTA must precede QR exchange");
assert.match(rally,/\.admin-catalog \.community-record-card/,"Admin showcase must hide CTA");
assert.match(page,/href="\.\/stamp-rally\.html"/,"Return to Medal Rally link missing");
assert.match(page,/id="privateContent" hidden/,"Initial private panel must be hidden");
assert.doesNotMatch(page,/stamp_exchange_transactions|user_a_id|user_b_id|service_role|\.rpc\(/,"Private exchange data must not be fetched from new page");
assert.doesNotMatch(page,/\.insert\(|\.upsert\(|\.delete\(|\.update\(/);
const scripts=[...page.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x=>x[1]);
assert.equal(scripts.length,1);
assert.doesNotThrow(()=>new vm.Script(scripts[0]));
async function checkAccess(role,authed,error){
 const els=new Map();
 for(const id of ["authState","privateContent","authTitle","authMessage"]){
  els.set(id,{hidden:id==="privateContent",textContent:""});
 }
 let reads=0;
 const client={
  auth:{getUser:async()=>({data:{user:authed?{id:"test-user"}:null},error:null})},
  from:table=>{
   assert.equal(table,"profiles");reads++;
   return {select:columns=>{
    assert.equal(columns,"role");
    return {eq:(col,id)=>{
     assert.equal(col,"id");assert.equal(id,"test-user");
     return {maybeSingle:async()=>({data:{role},error:error?new Error("offline"):null})};
    }};
   }};
  }
 };
 const context={
  document:{getElementById:id=>{
   assert.ok(els.has(id));
   return els.get(id);
  }},
  window:{supabase:{createClient:()=>client}}
 };
 vm.runInNewContext(scripts[0],context);
 await new Promise(resolve=>setImmediate(resolve));
 return {shown:!els.get("privateContent").hidden,reads,title:els.get("authTitle").textContent};
}
for(const role of ["ca","admin"]){
 const x=await checkAccess(role,true,false);
 assert.equal(x.shown,true,role+" should be approved");
 assert.equal(x.reads,1);
}
for(const role of ["pending","user",null]){
 const x=await checkAccess(role,true,false);
 assert.equal(x.shown,false,role+" must not be approved");
}
const loggedOut=await checkAccess(null,false,false);
assert.equal(loggedOut.shown,false);
assert.equal(loggedOut.reads,0);
const profileError=await checkAccess("ca",true,true);
assert.equal(profileError.shown,false);
process.stdout.write("PASS: Medal Rally CTA order, destination, access guard, no private reads/writes\n");
